#!/usr/bin/env python3
"""QA gate for store/play/metadata. Run after any bulk listing edit.

Enforces the rules in README.md that came from real defects: character limits
(not bytes), no trailing newline, no hardcoded prices, "Google Play" not
"App Store", keyword-bearing titles, and no Latin letters stranded inside a
non-Latin script.

Free-tier claim accuracy lives in `free_tier_claims.py` and is called from here so
CI has a single entry point. That check exists because 43 of 46 locales shipped a
free tier that does not exist; see that module's header for the design.
"""
import os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from free_tier_claims import (
    authored_for_problems,
    free_tier_problems,
    read_limits,
    self_test as free_tier_self_test,
)

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'metadata')
# The locale set is a ratchet: adding or removing a listing is a deliberate edit
# here, so a directory vanishing can never silently shrink what gets checked.
EXPECTED_LOCALES = (
    'ar', 'bg', 'cs-CZ', 'da-DK', 'de-DE', 'el-GR', 'en-AU', 'en-CA', 'en-GB',
    'en-IN', 'en-US', 'es-419', 'es-ES', 'es-US', 'et', 'fi-FI', 'fil', 'fr-FR',
    'hi-IN', 'hr', 'hu-HU', 'id', 'it-IT', 'ja-JP', 'ko-KR', 'lt', 'lv', 'mk-MK',
    'ms', 'nl-NL', 'no-NO', 'pl-PL', 'pt-BR', 'pt-PT', 'ro', 'ru-RU', 'sk', 'sl',
    'sr', 'sv-SE', 'th', 'tr-TR', 'uk', 'vi', 'zh-CN', 'zh-TW',
)
LIMITS = {'title.txt': 30, 'short_description.txt': 80, 'full_description.txt': 4000}
NON_LATIN = {'bg', 'uk', 'ru-RU', 'sr', 'mk-MK', 'el-GR', 'th', 'hi-IN',
             'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'ar'}
# Latin tokens that legitimately appear inside non-Latin copy.
ALLOWED_LATIN = {'motovault', 'pro', 'gps', 'gpx', 'ai', 'google', 'play', 'https',
                 'app', 'support', 'com', 'privacy', 'terms', 'km', 'email', 'pdf',
                 'obd', 'ii'}
# The currency symbol may PRECEDE or FOLLOW the amount. An earlier version only
# matched prefix-$ and suffix €/EUR/USD, so the French listing's "3,99 $/mois" and
# "29,99 $/an" passed the gate and shipped.
#
# Alphabetic currency codes MUST be \b-anchored: unanchored, "kr" and "lei" match
# inside ordinary words, so Norwegian "24 krav" or "24 leiligheter" would be
# reported as prices. Symbols need no anchoring — they are not word characters.
# The symbol/code set must cover the currency of EVERY locale in EXPECTED_LOCALES,
# or a hardcoded price in that language slips through: Thai ฿99 and Indonesian
# Rp 99.000 both bypassed an earlier version. Native-script currency words
# (円/元/원/руб/грн/ден/дин) are listed as symbols rather than \b-anchored codes
# because \b does not work in CJK/Cyrillic runs; requiring an adjacent digit is
# what keeps 元素 or 円形 from matching.
CURRENCY_SYMBOL = r'[$€£¥₹₩₺₫₱฿₽₴₪₸]'
# Native-script currency words need a trailing non-word boundary of their own. \b
# cannot provide it inside a CJK/Cyrillic run, and requiring a preceding digit is
# not enough: without the lookahead, "30 元素" (30 elements), "980 円形" and
# "4900 원칙" all match as prices.
CURRENCY_WORD = r'(?:円|元|원|руб|грн|ден|дин)(?!\w)'
CURRENCY_CODE = (r'\b(?:USD|EUR|GBP|MXN|CHF|BRL|THB|IDR|RUB|UAH|INR|PHP|MYR|TRY'
                 r'|CZK|PLN|HUF|RON|DKK|NOK|SEK|JPY|CNY|KRW|TWD|VND|SGD|AUD|CAD'
                 r'|NZD|BGN|MKD|RSD|zł|kr|Kč|Ft|lei|лв|RM|Rp|Rs|TL)\b')
CURRENCY = rf'(?:{CURRENCY_SYMBOL}|{CURRENCY_WORD}|{CURRENCY_CODE})'
PRICE = re.compile(rf'{CURRENCY}\s?\d|\d+(?:[.,]\d{{1,2}})?\s?{CURRENCY}')
# No false-positive exemption list. PRICE only matches when a currency token is
# adjacent, so "12,000+ models", "4000 characters" and a bare "24 hours" cannot
# match it in the first place. An earlier version exempted `\b24\b`, which also
# suppressed the genuine prices "24 EUR" and "24 €".
# support@ is canonical, decided 2026-08-24. This constant said `hello@` for a
# while after all 46 listings were swept to support@, which turned the whole gate
# red on every locale at once — a required-token check is only as good as the token.
REQUIRED = [('motovault.app/privacy', 'privacy URL'),
            ('motovault.app/terms', 'terms URL'),
            ('support@motovault.app', 'support email')]
# Subscription terms Play expects a paid listing to state: that it auto-renews,
# the 24-hour cancellation deadline, and where to manage or cancel.
#
# Checking each token anywhere in the description is too weak — a listing with
# "24 bikes" in a feature bullet and "Google Play" in a footer would pass while
# stating neither. So both must appear in the SAME paragraph, which is what makes
# them one coherent disclosure sentence. That stays language-agnostic; per-locale
# grammars for 46 languages would be a large maintenance surface for little gain.
#
# The token patterns themselves are deliberately loose:
#   - a bare "24" rather than \b24\b, because \b never matches inside CJK runs
#     ("の24時間前", "24시간 전") where the adjacent character is also a word char;
#   - "Google-Play" as well as "Google Play", because German compounds hyphenate
#     it ("Google-Play-Kontoeinstellungen").
RENEWAL_DEADLINE = re.compile(r'24')
CANCEL_LOCATION = re.compile(r'Google[\s -]?Play')


def has_subscription_disclosure(full_description):
    """True when one paragraph carries both the 24-hour deadline and where to cancel."""
    return any(RENEWAL_DEADLINE.search(para) and CANCEL_LOCATION.search(para)
               for para in re.split(r'\n\s*\n', full_description))


# Negative fixtures: each must FAIL the disclosure check. These guard the gate's
# own logic, so a future loosening of the patterns breaks the gate loudly.
DISCLOSURE_FIXTURES = [
    ('', False),
    ('Track 24 bikes for free.\n\nAvailable on Google Play.', False),
    ('Cancel anytime in the Play Store.', False),
    ('Manage or cancel in your Google Play account settings.', False),
    ('Auto-renews unless cancelled 24 hours before the period ends.', False),
    ('Auto-renews unless cancelled at least 24 hours before the period ends. '
     'Manage or cancel in your Google Play account settings.', True),
    ('期間終了の24時間前までに解約しない限り自動更新されます。'
     '解約や管理はGoogle Playのアカウント設定から行えます。', True),
    ('Mindestens 24 Stunden vor Ende kündbar, in den '
     'Google-Play-Kontoeinstellungen.', True),
]


def self_test():
    """Verify the gate's own logic before trusting its verdict on real files."""
    failures = []
    for text, expected in DISCLOSURE_FIXTURES:
        if has_subscription_disclosure(text) != expected:
            failures.append(f'disclosure fixture expected {expected}: {text[:60]!r}')
    for text, expected in [('at least 24 hours before', False), ('12,000+ models', False),
                           ('4000 characters', False), ('24 krav', False),
                           ('24 leiligheter', False), ('24 EUR', True), ('24 €', True),
                           ('3,99 $/mois', True), ('$4 per month', True),
                           # Locale currencies an earlier pattern set missed entirely.
                           ('฿99 ต่อเดือน', True), ('Rp 99.000/bulan', True),
                           ('99 ₽ в месяц', True), ('99 ₴ на місяць', True),
                           ('月額980円', True), ('每月 30 元', True), ('월 4900원', True),
                           ('99 TL/ay', True), ('₹299/month', True),
                           # Native-script words that are NOT currencies. The second
                           # group is the harder case: a digit DOES precede them, so
                           # only the trailing boundary rules them out.
                           ('元素と円形のデザイン', False), ('디자인 원칙', False),
                           ('30 元素', False), ('980 円形', False), ('4900 원칙', False),
                           ('99 рубрика', False), ('50 грница', False)]:
        if bool(PRICE.search(text)) != expected:
            failures.append(f'price fixture expected {expected}: {text!r}')
    failures.extend(free_tier_self_test())
    return failures

def field_problems(locale, fname, text):
    """Checks that apply to EVERY field, not just the full description.

    A hardcoded price or an "App Store" slip in a title or short description is
    exactly as wrong as one in the body, and those two fields are the ones users
    actually read in search results.
    """
    problems = []
    if 'App Store' in text:
        problems.append(f'{locale}/{fname}: says "App Store" on a Play listing')
    match = PRICE.search(text)
    if match:
        problems.append(f'{locale}/{fname}: hardcoded price {match.group()!r}')
    if locale in NON_LATIN:
        body = re.sub(r'https?://\S+|\S+@\S+', '', text)
        stray = {w for w in re.findall(r'[A-Za-z]{2,}', body)
                 if w.lower() not in ALLOWED_LATIN}
        if stray:
            problems.append(
                f'{locale}/{fname}: Latin letters inside non-Latin script {sorted(stray)[:5]}')
    return problems


def main():
    problems = self_test()
    if problems:
        print(f'GATE SELF-TEST FAILED ({len(problems)}) — not checking listings')
        for p in problems:
            print(' -', p)
        return 1
    locales = sorted(name for name in os.listdir(BASE)
                     if os.path.isdir(os.path.join(BASE, name)))

    # Free-tier numbers come from the app's own constants. A mismatch between
    # those constants and what the copy was written for is fatal on its own: every
    # locale claim below would be unverifiable, so say so once instead of 46 times.
    limits = read_limits()
    authored = authored_for_problems(limits)
    if authored:
        print(f'FREE-TIER CONSTANTS CHANGED ({len(authored)}) — not checking listings')
        for problem in authored:
            print(' -', problem)
        return 1

    # Compare against the committed expected set, not just what happens to be on
    # disk: a deleted or renamed locale directory would otherwise shrink the
    # checked set and still report success.
    expected = set(EXPECTED_LOCALES)
    found = set(locales)
    for missing in sorted(expected - found):
        problems.append(f'{missing}: expected locale directory is missing')
    for unexpected in sorted(found - expected):
        problems.append(f'{unexpected}: unexpected locale directory — add it to EXPECTED_LOCALES')

    for locale in locales:
        d = os.path.join(BASE, locale)
        values = {}
        for fname, limit in LIMITS.items():
            path = os.path.join(d, fname)
            values[fname] = open(path, encoding='utf-8').read() if os.path.exists(path) else ''
            text = values[fname]
            if not text.strip():
                problems.append(f'{locale}/{fname}: empty or missing')
            elif len(text) > limit:
                problems.append(f'{locale}/{fname}: {len(text)} chars > {limit}')
            if text != text.rstrip('\n'):
                problems.append(f'{locale}/{fname}: trailing newline lands in the store field')
            problems.extend(field_problems(locale, fname, text))
        if values['title.txt'].strip() == 'MotoVault':
            problems.append(f'{locale}/title.txt: no keyword, just the app name')
        full = values['full_description.txt']
        for needle, label in REQUIRED:
            if needle not in full:
                problems.append(f'{locale}: missing {label}')
        if not has_subscription_disclosure(full):
            problems.append(f'{locale}: no single paragraph states both the 24-hour '
                            'cancellation deadline and where to manage/cancel')
        problems.extend(free_tier_problems(locale, full, limits))

    print(f'{len(locales)} locales checked, {len(problems)} problems')
    for p in problems:
        print(' -', p)
    return 1 if problems else 0

if __name__ == '__main__':
    sys.exit(main())
