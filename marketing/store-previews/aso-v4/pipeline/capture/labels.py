#!/usr/bin/env python3
"""Maestro env for one market: ids from the seed, UI strings from the app's own locale file.

    python3 labels.py US            # KEY=VALUE lines (consumed by capture_market.sh)
    python3 labels.py US --json     # same, as JSON, for review

The flows never hard-code English. Every visible-text selector comes from
apps/mobile/src/i18n/locales/<app_language>.json, regex-escaped, so the same flow runs in
es/pt-BR/de/fr/it. Accessibility labels that the app hard-codes in English ("Share ride",
"Go back") are used as-is: they are English in every language.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PIPE = HERE.parent
REPO = PIPE.parents[3]
# Read the locale files of the tree the capture build was made from (APP_TREE), else this checkout.
import os
LOCALES = Path(os.environ.get("APP_TREE", str(REPO))) / "apps/mobile/src/i18n/locales"

# Maestro env var -> i18n key path in the app locale file.
KEYS = {
    "L_HOME_TAB": "tabs.home",
    "L_GARAGE_TAB": "tabs.garage",
    "L_HAVE_ACCOUNT": "onboarding.obAccountHaveAccount",
    "L_HAVE_ACCOUNT_AUTH": "auth.hasAccount",
    "L_EMAIL": "auth.email",
    "L_PASSWORD": "auth.password",
    "L_SIGN_IN": "auth.signIn",
    "L_RECENT_RIDES": "myRides.recentRides",
    "L_SHARE_RECAP": "heatmap.shareRecap",
    "L_SHARE_RIDE": "rideDetail.shareRideA11y",
    "L_REVIEW_TITLE": "receiptScan.review.title",
    "L_CONSENT_DECLINE": "analyticsConsent.decline",
    # Paywall tripwires: if either ever shows, the flow fails (flows/_no_paywall.yaml).
    "L_PAYWALL_UNAVAILABLE": "paywall.unavailableTitle",
    "L_RESTORE_PURCHASES": "profile.restorePurchases",
}


def lookup(d, path):
    for part in path.split("."):
        d = d[part]
    return d


def rx(s):
    """Whole-string IGNORE_CASE regex (Maestro's text matcher) for a literal UI string."""
    return re.sub(r"([\\.^$|?*+()\[\]{}])", r"\\\1", s)


def money(amount, currency):
    """The app formats money with Intl.NumberFormat('en-US') in every language (expense-constants.ts)."""
    js = f"console.log(new Intl.NumberFormat('en-US',{{style:'currency',currency:'{currency}'}}).format({amount}))"
    return subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout.strip()


def build(cc, seed_dir=None, market_dir=None):
    seed_dir = seed_dir or PIPE / "out" / "seed" / cc
    ids = json.loads((seed_dir / "ids.json").read_text())
    # The seed-ready file the seed was generated from: explicit dir, the adapted draft, then the stub.
    dirs = [market_dir] if market_dir else [PIPE.parent / "markets", PIPE / "out" / "markets-seed", PIPE / "fixtures" / "markets"]
    mfile = next((d / f"{cc}.json" for d in dirs if (d / f"{cc}.json").exists()), None)
    if mfile is None:
        raise SystemExit(f"{cc}: no seed-ready market file in {dirs}")
    m = json.loads(mfile.read_text())
    strings = json.loads((LOCALES / f"{m['app_language']}.json").read_text())
    env = {k: rx(lookup(strings, v)) for k, v in KEYS.items()}
    primary = next(iter(ids["bikes"].values()))
    env.update({
        "CC": cc,
        "TEST_EMAIL": ids["email"],
        "BIKE_ID": primary["id"],
        "BIKE_MILEAGE": str(primary["odometer"]),
        "MILEAGE_UNIT": primary["unit"],
        "HERO_RIDE_ID": ids["hero_ride_id"],
        "SERVICE_TASK_ID": ids["service_task_id"],
        "SCAN_ID": ids["scan_id"],
        "TRIP_ID": ids["trip_id"],
        "TRIP_TITLE": re.sub(r"[^\x00-\x7f]", ".", rx(m["trip"]["title"])),  # accents: iOS may expose NFD
        "FIRST_TASK": rx(ids["tasks"][0]["title"]) if ids.get("tasks") else ".*",
        "YEAR_TOTAL": rx(money(ids["expense_year_total"], m["currency"])),
    })
    return env, m


def main():
    cc = sys.argv[1].upper()
    mdir = Path(sys.argv[sys.argv.index("--markets-dir") + 1]) if "--markets-dir" in sys.argv else None
    sdir = Path(sys.argv[sys.argv.index("--seed-dir") + 1]) if "--seed-dir" in sys.argv else None
    env, _ = build(cc, seed_dir=sdir, market_dir=mdir)
    if "--json" in sys.argv:
        print(json.dumps(env, indent=1, ensure_ascii=False))
    else:
        for k, v in env.items():
            print(f"{k}={v}")


if __name__ == "__main__":
    main()
