import json, os, re, shutil, sys, importlib.util, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
# copy/_build -> aso-v4 -> store-previews -> marketing -> repo root
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
PLAYDIR = os.path.join(REPO, 'store', 'play')
sys.path.insert(0, PLAYDIR)
from free_tier_claims import render_block, read_limits
import en, es, eu, composer

OUT = os.path.join(REPO, 'marketing', 'store-previews', 'aso-v4', 'copy')
LIMITS = read_limits()
problems = []

SLOTS = ['ride_tracking', 'ride_stats', 'expenses', 'receipt_scan', 'maintenance_reminders',
         'service_history', 'garage', 'trip_planning', 'season_summary', 'costs_overview']


def cap_block(caps, ctx):
    out = {}
    for slot in SLOTS:
        head, sub = caps[slot]
        for line in head:
            if len(line) > 18:
                problems.append(f'{ctx} {slot}: headline line {len(line)} > 18: {line!r}')
        if '{' in sub:
            problems.append(f'{ctx} {slot}: placeholder in subline (composer does not fill them)')
        if len(sub) > 70:
            problems.append(f'{ctx} {slot}: subline {len(sub)} > 70: {sub!r}')
        out[slot] = {'headline': head, 'headline_chars': [len(l) for l in head],
                     'subline': sub, 'subline_chars': len(sub)}
    return out


def field(v, limit, ctx, name, unit='chars'):
    n = len(v.encode('utf-8')) if unit == 'bytes' else len(v)
    if n > limit:
        problems.append(f'{ctx} {name}: {n} {unit} > {limit}')
    return {'value': v, unit: n, 'limit': limit}


def words(s):
    return {w for w in re.split(r'[^\wÀ-ɏ]+', s.lower()) if w}


def apple(loc, meta, desc, caps, assets, mod_name):
    ctx = f'apple-{loc}'
    kw = meta['keywords']
    if ' ' in kw: problems.append(f'{ctx}: space in keywords')
    dup = words(kw) & (words(meta['name']) | words(meta['subtitle']))
    if dup: problems.append(f'{ctx}: keywords repeat name/subtitle words {sorted(dup)}')
    kws = kw.split(',')
    if len(set(kws)) != len(kws): problems.append(f'{ctx}: duplicate keyword')
    for bad in ('android', 'google', 'play store'):
        if bad in desc.lower() or bad in json.dumps(caps).lower():
            problems.append(f'{ctx}: mentions {bad}')
    doc = {
        'platform': 'apple', 'locale': loc,
        'name': field(meta['name'], 30, ctx, 'name'),
        'subtitle': field(meta['subtitle'], 30, ctx, 'subtitle'),
        'keywords': field(kw, 100, ctx, 'keywords', 'bytes'),
        'promotional_text': field(meta['promotional_text'], 170, ctx, 'promo'),
        'description': field(desc, 4000, ctx, 'description'),
        'whats_new': field(meta['whats_new'], 4000, ctx, 'whats_new'),
        'screenshot_captions': cap_block(caps, ctx),
        'product_page_header_headline': field(assets['header'], 40, ctx, 'header'),
        'search_results_asset_headline': field(assets['search'], 45, ctx, 'search'),
        'rationale': meta['rationale'],
    }
    write(f'apple-{loc}.json', doc)
    return doc


def play(loc, gate_loc, meta, desc, caps, assets, custom_country=None):
    ctx = f'play-{loc}'
    if 'App Store' in desc or 'CarPlay' in desc or 'CarPlay' in json.dumps(caps):
        problems.append(f'{ctx}: Apple-only term in Play copy')
    fg = assets['feature_graphic']
    if len(fg.split()) > 5: problems.append(f'{ctx}: feature graphic > 5 words')
    doc = {
        'platform': 'google_play', 'locale': loc,
        **({'listing_type': 'custom_store_listing', 'target_country': custom_country,
            'language': gate_loc} if custom_country else {'listing_type': 'default'}),
        'title': field(meta['title'], 30, ctx, 'title'),
        'short_description': field(meta['short_description'], 80, ctx, 'short'),
        'full_description': field(desc, 4000, ctx, 'full'),
        'screenshot_captions': cap_block(caps, ctx),
        'feature_graphic_headline': {'value': fg, 'words': len(fg.split()), 'limit_words': 5},
        'rationale': meta['rationale'],
    }
    name = f'play-{loc}.json' if not custom_country else f'play-custom-{custom_country}.json'
    write(name, doc)
    # stage for the QA gate
    stage = os.path.join(HERE, 'stage', custom_country or 'default', gate_loc)
    os.makedirs(stage, exist_ok=True)
    for f, v in (('title.txt', meta['title']), ('short_description.txt', meta['short_description']),
                 ('full_description.txt', desc)):
        open(os.path.join(stage, f), 'w', encoding='utf-8').write(v)
    return doc


def write(name, doc):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write('\n')


shutil.rmtree(os.path.join(HERE, 'stage'), ignore_errors=True)
docs = {}
# ---- Apple
for loc in ('en-US', 'en-CA', 'en-GB', 'en-AU'):
    docs['apple', loc] = apple(loc, en.APPLE[loc], en.apple_description(loc), composer.apply(loc, en.captions(loc)), en.ASSETS, 'en')
for loc in ('es-MX', 'es-ES'):
    docs['apple', loc] = apple(loc, es.APPLE[loc], es.apple_description(loc), composer.apply(loc, es.captions(loc)), es.ASSETS[loc], 'es')
for loc, src in (('pt-BR', 'pt-BR'), ('fr-FR', 'fr-FR'), ('it', 'it'), ('de-DE', 'de-DE')):
    d = eu.L[src]
    docs['apple', loc] = apple(loc, d['apple'], eu.apple_description(src), composer.apply(src, eu.captions(src)), d['assets'], 'eu')

# ---- Play defaults
for loc in ('en-US', 'en-CA', 'en-GB', 'en-AU'):
    docs['play', loc] = play(loc, loc, en.PLAY[loc], en.play_description(loc, render_block(loc, LIMITS)), composer.apply(loc, en.captions(loc)), en.ASSETS)
for loc in ('es-419', 'es-US', 'es-ES'):
    docs['play', loc] = play(loc, loc, es.PLAY[loc], es.play_description(loc, render_block(loc, LIMITS)), composer.apply(loc, es.captions(loc)), es.ASSETS[loc])
for loc, src in (('pt-BR', 'pt-BR'), ('fr-FR', 'fr-FR'), ('it-IT', 'it'), ('de-DE', 'de-DE'), ('fil', 'fil')):
    d = eu.L[src]
    docs['play', loc] = play(loc, loc, d['play'], eu.play_description(src, render_block(loc, LIMITS)), composer.apply(src, eu.captions(src)), d['assets'])

# ---- Play custom store listings (country-targeted)
docs['play', 'MX'] = play('es-MX', 'es-419', es.PLAY['es-MX-play'], es.play_description('es-MX-play', render_block('es-419', LIMITS)), composer.apply('es-MX', es.captions('es-MX')), es.ASSETS['es-MX-play'], 'MX')
docs['play', 'CO'] = play('es-CO', 'es-419', es.PLAY['es-CO'], es.play_description('es-CO', render_block('es-419', LIMITS)), composer.apply('es-CO', es.captions('es-CO')), es.ASSETS['es-CO'], 'CO')
docs['play', 'AR'] = play('es-AR', 'es-419', es.PLAY['es-AR'], es.play_description('es-AR', render_block('es-419', LIMITS)), composer.apply('es-AR', es.captions('es-AR')), es.ASSETS['es-AR'], 'AR')
docs['play', 'PH'] = play('en-PH', 'en-US', en.PLAY['en-PH'], en.play_description('en-PH', render_block('en-US', LIMITS)), composer.apply('en-PH', en.captions('en-PH')), en.ASSETS, 'PH')

# ---- Composer files (pipeline/SCHEMA.md section 3): copy/<store-locale>.json
COMPOSER = {  # file locale -> (caption variant, source doc)
    'en-US': ('en-US', ('apple', 'en-US')), 'en-CA': ('en-CA', ('apple', 'en-CA')), 'en-GB': ('en-GB', ('apple', 'en-GB')),
    'en-AU': ('en-AU', ('apple', 'en-AU')), 'es-MX': ('es-MX', ('apple', 'es-MX')), 'es-ES': ('es-ES', ('apple', 'es-ES')),
    'pt-BR': ('pt-BR', ('apple', 'pt-BR')), 'fr-FR': ('fr-FR', ('apple', 'fr-FR')), 'it': ('it', ('apple', 'it')),
    'it-IT': ('it', ('play', 'it-IT')), 'de-DE': ('de-DE', ('apple', 'de-DE')), 'es-419': ('es-419', ('play', 'es-419')),
    'es-US': ('es-US', ('play', 'es-US')), 'fil': ('fil', ('play', 'fil')),
    'es-MX-play': ('es-MX', ('play', 'MX')), 'es-CO': ('es-CO', ('play', 'CO')), 'es-AR': ('es-AR', ('play', 'AR')), 'en-PH': ('en-PH', ('play', 'PH')),
}
for fname, (variant, key) in COMPOSER.items():
    caps = docs[key]['screenshot_captions']
    a = composer.ASSETS[variant]
    for nm, lines in (('header', a['header']), ('feature_graphic', a['feature_graphic']), ('search', a['search'][0])):
        for line in lines:
            if len(line) > 18: problems.append(f'composer {fname} {nm}: line {len(line)} > 18: {line!r}')
    d = docs[key]
    _o = composer.ORDER_BY_FILE.get(fname, composer.ORDER_GLOBAL)
    d['screenshot_order'] = _o[:composer.APPLE_MAX] if key[0] == 'apple' else _o[:composer.PLAY_MAX]
    if key[0] == 'apple':
        d['product_page_header_headline'] = field(' '.join(a['header']), 40, fname, 'header')
        d['search_results_asset_headline'] = field(' '.join(a['search'][0]), 45, fname, 'search')
        write(f'apple-{key[1]}.json', d)
    else:
        fg = ' '.join(a['feature_graphic'])
        d['feature_graphic_headline'] = {'value': fg, 'words': len(fg.split()), 'limit_words': 5}
        write(f"play-{key[1]}.json" if key[1] not in ('CO', 'AR', 'PH', 'MX') else f'play-custom-{key[1]}.json', d)
    order = composer.ORDER_BY_FILE.get(fname, composer.ORDER_GLOBAL)
    if sorted(order) != sorted(SLOTS) or 'ai_diagnosis' in order:
        problems.append(f'composer {fname}: order must be the 10 slots, no AI diagnosis')
    write(f'{fname}.json', {
        'locale': fname,
        'slots': {slot: {'headline': c['headline'], 'sub': c['subline']} for slot, c in caps.items()},
        'order': composer.ORDER_BY_FILE.get(fname, composer.ORDER_GLOBAL)[:composer.APPLE_MAX],
        'order_play': composer.ORDER_BY_FILE.get(fname, composer.ORDER_GLOBAL)[:composer.PLAY_MAX],
        'feature_graphic': {'headline': a['feature_graphic']},
        'header': {'headline': a['header']},
        'search': {'headline': a['search'][0], 'sub': a['search'][1]},
    })

for (plat, k), d in docs.items():
    if plat == 'play' and 'screenshot_order' not in d:
        d['screenshot_order'] = composer.ORDER_GLOBAL[:composer.PLAY_MAX]
        write(f'play-{k}.json' if k not in ('CO', 'AR', 'PH', 'MX') else f'play-custom-{k}.json', d)

# ---- Cross-localization keyword overlap where Apple indexes two locales in one storefront
def idx(loc):
    m = docs['apple', loc]
    return words(m['name']['value']) | words(m['subtitle']['value']) | words(m['keywords']['value'])
PAIRS = [('en-US', 'es-MX', 'US'), ('en-US', 'pt-BR', 'US'), ('en-US', 'fr-FR', 'US'),
         ('es-MX', 'en-GB', 'MX/CO/AR'), ('en-AU', 'en-GB', 'AU'), ('es-ES', 'en-GB', 'ES'),
         ('pt-BR', 'en-GB', 'BR'), ('fr-FR', 'en-GB', 'FR'), ('it', 'en-GB', 'IT'), ('de-DE', 'en-GB', 'DE')]
overlap = {}
for a, b, sf in PAIRS:
    o = sorted((idx(a) & idx(b)) - {'motovault'})
    overlap[f'{sf}: {a} + {b}'] = o
json.dump(overlap, open(os.path.join(HERE, 'overlap.json'), 'w'), ensure_ascii=False, indent=1)

print('FIELD PROBLEMS:', len(problems))
for p in problems: print(' -', p)
print('OVERLAP:')
for k, v in overlap.items(): print(' ', k, v)

if problems:
    sys.exit(1)
