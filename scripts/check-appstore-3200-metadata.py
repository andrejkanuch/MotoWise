#!/usr/bin/env python3
"""Validate the planned 3.20.0 App Store metadata before anyone applies it.

Three things Apple enforces or punishes that are easy to get wrong by hand:

  1. Field limits. subtitle <= 30, keywords <= 100. Counted in CHARACTERS, not
     bytes -- the Play work in #212 established that distinction the hard way, and
     the accented locales (de-DE 'Öl', fr-FR 'révision', pt-BR 'manutenção') are
     exactly where a byte count would produce a phantom failure.

  2. Token duplication across name + subtitle + keywords. Apple indexes all three
     TOGETHER, so a term repeated in two of them is wasted bytes in a field where
     bytes are the whole budget.

  3. Locale coverage. Subtitles live on appInfoLocalizations and keywords on
     appStoreVersionLocalizations -- different resources with different locale
     sets (15 vs 7). Mixing them up means a change that silently does nothing.

Run: python3 scripts/check-appstore-3200-metadata.py
Exit 0 = safe to apply. Exit 1 = do not apply.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

PLAN = Path(__file__).resolve().parent.parent / "outputs/appstore-release-3.20.0/metadata-3.20.0.json"

SUBTITLE_MAX = 30
KEYWORDS_MAX = 100

# The 7 locales carrying a version localization (and therefore a keyword field).
VERSION_LOCALES = {"en-US", "en-GB", "de-DE", "fr-FR", "it", "es-MX", "pt-BR"}

# Names are NOT changed in 3.20.0, so token-overlap is checked against these.
# Source: appInfoLocalizations on the live (READY_FOR_SALE) record, read 2026-08-25.
LIVE_NAMES = {
    "en-US": "MotoVault: Motorcycle Garage",
    "en-GB": "MotoVault: Motorbike Garage",
    "de-DE": "MotoVault: Motorrad-Garage",
    "fr-FR": "MotoVault: Garage Moto",
    "it": "MotoVault: Garage per moto",
    "es-MX": "MotoVault: Garaje de Motos",
    "pt-BR": "MotoVault: Garagem de Motos",
    "fi": "MotoVault: Motorcycle Garage",
    "es-ES": "MotoVault",
    "pl": "MotoVault",
}


def fold(s: str) -> str:
    """Casefold and strip accents, so 'Öl' and 'ol' compare as the same token.

    Apple's matching is accent-insensitive, so 'révision' in a keyword field does
    not buy a second slot over 'revision' in the name. Comparing raw strings would
    miss precisely the duplicates worth catching.
    """
    decomposed = unicodedata.normalize("NFD", s.casefold())
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


def tokens(s: str) -> set[str]:
    return {fold(t) for t in re.split(r"[^0-9A-Za-zÀ-ɏ]+", s) if len(t) > 2}


def main() -> int:
    plan = json.loads(PLAN.read_text())
    problems: list[str] = []
    checked = 0

    version = {k: v for k, v in plan["version_localizations"].items() if not k.startswith("_")}
    info = {k: v for k, v in plan["app_info_localizations"].items() if not k.startswith("_")}

    # 1. keyword fields
    for locale, entry in version.items():
        kw = entry.get("keywords", "")
        checked += 1
        n = len(kw)
        if n > KEYWORDS_MAX:
            problems.append(f"{locale}: keywords {n} > {KEYWORDS_MAX}")
        if locale not in VERSION_LOCALES:
            problems.append(f"{locale}: has keywords but is not a version-localization locale")
        # A trailing or doubled comma costs a slot for nothing.
        if kw != kw.strip(",") or ",," in kw:
            problems.append(f"{locale}: keyword field has an empty slot (stray comma)")
        dupes = [t for t in kw.split(",") if kw.split(",").count(t) > 1]
        if dupes:
            problems.append(f"{locale}: keyword repeated within the field: {sorted(set(dupes))}")

    # 2. subtitles
    for locale, entry in info.items():
        sub = entry.get("subtitle")
        if sub is None:
            continue
        checked += 1
        n = len(sub)
        if n > SUBTITLE_MAX:
            problems.append(f"{locale}: subtitle {n} > {SUBTITLE_MAX} — {sub!r}")

    # 3. token overlap across name + subtitle + keywords
    for locale in sorted(set(info) | set(version)):
        name = info.get(locale, {}).get("name") or LIVE_NAMES.get(locale)
        sub = info.get(locale, {}).get("subtitle")
        kw = version.get(locale, {}).get("keywords")
        if not name:
            continue
        name_t = tokens(name) - {"motovault"}  # brand legitimately repeats
        sub_t = tokens(sub) if sub else set()
        kw_t = tokens(kw) if kw else set()
        for label, a, b in (
            ("name/subtitle", name_t, sub_t),
            ("name/keywords", name_t, kw_t),
            ("subtitle/keywords", sub_t, kw_t),
        ):
            overlap = a & b
            if overlap:
                problems.append(f"{locale}: token duplicated across {label}: {sorted(overlap)}")

    print(f"{checked} fields checked across {len(set(info) | set(version))} locales")
    if problems:
        print(f"\n{len(problems)} problem(s):")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("0 problems — safe to apply once 3.19.1 is released")
    return 0


if __name__ == "__main__":
    sys.exit(main())
