#!/usr/bin/env python3
"""Add or update keys in apps/web/messages/en.json, safely under concurrent use.

Usage: python3 .impeccable/tools/add-web-i18n-keys.py <spec.json>
spec.json: {"Namespace.dotted.key": "English value", ...}
Dotted keys are nested. English only: the other locales are translated once
at the end of the redesign (pnpm check:i18n is run then).
Holds an exclusive lock so parallel agents never overwrite each other's keys.
"""
import fcntl
import json
import sys
from pathlib import Path

EN = Path(__file__).resolve().parents[2] / 'apps/web/messages/en.json'


def set_path(tree, dotted, value):
    parts = dotted.split('.')
    node = tree
    for part in parts[:-1]:
        # A numeric part indexes an existing list (e.g. Faq.items.3.answer).
        node = node[int(part)] if isinstance(node, list) and part.isdigit() else node.setdefault(part, {})
        if not isinstance(node, (dict, list)):
            raise SystemExit(f'{dotted}: "{part}" is a string, not an object')
    last = parts[-1]
    if isinstance(node, list):
        node[int(last)] = value
    else:
        node[last] = value


def main():
    spec = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    with open('/tmp/motovault-web-i18n.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        tree = json.loads(EN.read_text(encoding='utf-8'))
        for key, value in spec.items():
            set_path(tree, key, value)
        EN.write_text(json.dumps(tree, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'updated {len(spec)} key(s) in en.json')


if __name__ == '__main__':
    main()
