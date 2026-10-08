#!/usr/bin/env python3
"""Add or update i18n keys in all 13 mobile locales, safely under concurrent use.

Usage: python3 .impeccable/tools/add-i18n-keys.py <spec.json>

spec.json: {"bikeHub.notes.viewerTitle": {"en": "...", "de": "...", ... all 13 ...}, ...}
Dotted keys are nested. Plural keys use i18next suffixes (`_one`, `_other`, plus
`_few`/`_many` where the language needs them) as separate entries.
Holds an exclusive lock so parallel agents never overwrite each other's keys.
"""
import fcntl
import json
import sys
from pathlib import Path

LOCALES_DIR = Path(__file__).resolve().parents[2] / 'apps/mobile/src/i18n/locales'
LOCALES = ['en', 'de', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'pl', 'pt-BR', 'sk', 'th', 'tr']


def set_path(tree, dotted, value):
    parts = dotted.split('.')
    node = tree
    for part in parts[:-1]:
        node = node.setdefault(part, {})
        if not isinstance(node, dict):
            raise SystemExit(f'{dotted}: "{part}" is a string, not an object')
    node[parts[-1]] = value


def main():
    spec = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    missing = [f'{key}:{loc}' for key, values in spec.items() for loc in LOCALES if loc not in values]
    if missing:
        raise SystemExit('missing translations: ' + ', '.join(missing))
    with open('/tmp/motovault-i18n.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for loc in LOCALES:
            path = LOCALES_DIR / f'{loc}.json'
            tree = json.loads(path.read_text(encoding='utf-8'))
            for key, values in spec.items():
                set_path(tree, key, values[loc])
            path.write_text(json.dumps(tree, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'updated {len(spec)} key(s) in {len(LOCALES)} locales')


if __name__ == '__main__':
    main()
