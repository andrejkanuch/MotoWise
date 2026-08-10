#!/usr/bin/env python3
"""QA gate for store/play/metadata. Run after any bulk listing edit.

Enforces the rules in README.md that came from real defects: character limits
(not bytes), no trailing newline, no hardcoded prices, "Google Play" not
"App Store", keyword-bearing titles, and no Latin letters stranded inside a
non-Latin script.
"""
import os, re, sys

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'metadata')
LIMITS = {'title.txt': 30, 'short_description.txt': 80, 'full_description.txt': 4000}
NON_LATIN = {'bg', 'uk', 'ru-RU', 'sr', 'mk-MK', 'el-GR', 'th', 'hi-IN',
             'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'ar'}
# Latin tokens that legitimately appear inside non-Latin copy.
ALLOWED_LATIN = {'motovault', 'pro', 'gps', 'gpx', 'ai', 'google', 'play', 'https',
                 'app', 'hello', 'com', 'privacy', 'terms', 'km', 'email', 'pdf',
                 'obd', 'ii'}
PRICE = re.compile(r'\$\s?\d|\d+[.,]\d{2}\s?(?:€|EUR|USD|MXN)|R\$\s?\d|€\s?\d|zł|MXN')
REQUIRED = [('motovault.app/privacy', 'privacy URL'),
            ('motovault.app/terms', 'terms URL'),
            ('hello@motovault.app', 'support email')]

def main():
    problems = []
    locales = sorted(l for l in os.listdir(BASE) if os.path.isdir(os.path.join(BASE, l)))
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
        if values['title.txt'].strip() == 'MotoVault':
            problems.append(f'{locale}/title.txt: no keyword, just the app name')
        full = values['full_description.txt']
        for needle, label in REQUIRED:
            if needle not in full:
                problems.append(f'{locale}: missing {label}')
        if 'App Store' in full:
            problems.append(f'{locale}: says "App Store" on a Play listing')
        match = PRICE.search(full)
        if match:
            problems.append(f'{locale}: hardcoded price {match.group()!r}')
        if locale in NON_LATIN:
            body = re.sub(r'https?://\S+|\S+@\S+', '', full)
            stray = {w for w in re.findall(r'[A-Za-z]{2,}', body)
                     if w.lower() not in ALLOWED_LATIN}
            if stray:
                problems.append(f'{locale}: Latin letters inside non-Latin script {sorted(stray)[:5]}')

    print(f'{len(locales)} locales checked, {len(problems)} problems')
    for p in problems:
        print(' -', p)
    return 1 if problems else 0

if __name__ == '__main__':
    sys.exit(main())
