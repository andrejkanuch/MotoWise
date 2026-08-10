#!/usr/bin/env python3
"""QA gate for store/play/metadata. Run after any bulk listing edit.

Enforces the rules in README.md that came from real defects: character limits
(not bytes), no trailing newline, no hardcoded prices, "Google Play" not
"App Store", keyword-bearing titles, and no Latin letters stranded inside a
non-Latin script.
"""
import os, re, sys

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
                 'app', 'hello', 'com', 'privacy', 'terms', 'km', 'email', 'pdf',
                 'obd', 'ii'}
# The currency symbol may PRECEDE or FOLLOW the amount. An earlier version only
# matched prefix-$ and suffix €/EUR/USD, so the French listing's "3,99 $/mois" and
# "29,99 $/an" passed the gate and shipped.
CURRENCY = (r'(?:\$|€|£|¥|₹|₩|₺|₫|₱|USD|EUR|MXN|CHF|R\$|zł|kr|Kč|Ft|lei|лв|RM)')
PRICE = re.compile(rf'{CURRENCY}\s?\d|\d+(?:[.,]\d{{1,2}})?\s?{CURRENCY}')
# Figures that look like prices but are not: the model-catalogue count, the
# description limit quoted in copy, and the 24-hour cancellation deadline.
PRICE_FALSE_POSITIVES = re.compile(r'12[\s.,]?000|4[\s.,]?000|\b24\b')
REQUIRED = [('motovault.app/privacy', 'privacy URL'),
            ('motovault.app/terms', 'terms URL'),
            ('hello@motovault.app', 'support email')]
# Subscription terms Play expects a paid listing to state. Both patterns are
# deliberately loose because the wording differs per language:
#   - a bare "24" rather than \b24\b, because \b never matches inside CJK runs
#     ("の24時間前", "24시간 전") where the adjacent character is also a word char;
#   - "Google-Play" as well as "Google Play", because German compounds hyphenate
#     it ("Google-Play-Kontoeinstellungen").
RENEWAL_DISCLOSURE = re.compile(r'24')
CANCEL_LOCATION = re.compile(r'Google[\s-]?Play')

def field_problems(locale, fname, text):
    """Checks that apply to EVERY field, not just the full description.

    A hardcoded price or an "App Store" slip in a title or short description is
    exactly as wrong as one in the body, and those two fields are the ones users
    actually read in search results.
    """
    problems = []
    if 'App Store' in text:
        problems.append(f'{locale}/{fname}: says "App Store" on a Play listing')
    for match in PRICE.finditer(text):
        if not PRICE_FALSE_POSITIVES.search(match.group()):
            problems.append(f'{locale}/{fname}: hardcoded price {match.group()!r}')
            break
    if locale in NON_LATIN:
        body = re.sub(r'https?://\S+|\S+@\S+', '', text)
        stray = {w for w in re.findall(r'[A-Za-z]{2,}', body)
                 if w.lower() not in ALLOWED_LATIN}
        if stray:
            problems.append(
                f'{locale}/{fname}: Latin letters inside non-Latin script {sorted(stray)[:5]}')
    return problems


def main():
    problems = []
    locales = sorted(name for name in os.listdir(BASE)
                     if os.path.isdir(os.path.join(BASE, name)))

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
        # Subscription terms: auto-renewal deadline and where to cancel.
        if not RENEWAL_DISCLOSURE.search(full):
            problems.append(f'{locale}: no 24-hour auto-renewal/cancellation disclosure')
        if not CANCEL_LOCATION.search(full):
            problems.append(f'{locale}: never says where to manage/cancel (Google Play)')

    print(f'{len(locales)} locales checked, {len(problems)} problems')
    for p in problems:
        print(' -', p)
    return 1 if problems else 0

if __name__ == '__main__':
    sys.exit(main())
