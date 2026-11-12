---
title: "[#365 T25b] Bike search: \"Yamaha MT-07\" in one search, year before model, reject junk makes"
labels: [enhancement, area:mobile, activation-365]
order: 38
task_id: T25b
depends_on: [T25a]
phase: P2
size: M
release_path: "Release B 3.30.0 (after T25a deploy)"
---

## Context
#365, plan §3 T25 (split b), §3A.2 (placement check), specs FS-OB4, FS-R2-5, D1, **D1c**.

## Why
The make search placeholder promises "e.g. 'Yamaha MT-07'" but matches makes only (`components/onboarding/bike-setup/make-grid.tsx:31-61`, `i18n/locales/en.json:750`); year defaults to current−3 below the list (`app/(onboarding)/bike-setup.tsx:96-98, 231-237, 520-535`); 60–75% of onboarding bikes are make-only [SOURCE: R5 OB4, Q14–Q16]; junk makes "A", "V", "S", "P" saved [SOURCE: R2-DB5]. Placement: the onboarding paywall placement reads only goals + pending intent (`lib/onboarding-paywall.ts:44-50`); bike fields are RC attributes "targeting only" (`:64-80`) → no placement change; D1c: owner confirms no RC targeting rule reads `bikeModel`.

## What to change
(a) After a matched make, remaining tokens search that make's models → "Yamaha MT-07" rows; (b) use T25a ranking; (c) year stepper above the model list; (d) custom make requires ≥ 3 letters or a known/NHTSA make before "Use 'X'". Add, never rename, `bike_added` properties.

## How
Jest `__tests__/components/make-grid-search.test.tsx`, `model-picker-ranking.test.tsx`, custom-make rule. Split `_shared/onboarding-to-account.yaml` at the bike step into `_shared/onboarding-to-bike-setup.yaml`; Maestro `onboarding-bike-search.yaml`.

## Acceptance criteria
- [ ] Red run on main (no "MT-07" row), green after both platforms ("Yamaha MT-07" and "mt07"); light/dark; 7 locales.
- [ ] `onboarding.yaml`, `onboarding-paywall-verify.yaml` (both arms) still green; ledger date (D1); D1c answered.

## Verification
`pnpm --filter @motovault/mobile test:e2e:onboarding-bike-search`.

## Friction spec
FS-OB4 + FS-R2-5. Repro: bike setup; type "Yamaha MT-07"; and type "A" → "Use 'A'". Expected: "Yamaha MT-07" row directly; year with the model; "A" not offered. Automated check: maestro (local, both) `_shared/onboarding-to-bike-setup.yaml` → tap "Start typing your bike.*" → `inputText: "Yamaha MT-07"` → `extendedWaitUntil: {visible: "(?i)MT-07", timeout: 15000}` → tap → year 2019 → Continue → reveal shows "MT-07"; jest for the junk rule. Red first.

## Production metric
FS-OB4 (verbatim `R5…:269-283`) + `bike_setup_summary` by `{REL}`. Baseline p50 44 s / p90 146 s Android, model 44%, > 60 s 3.26.0 56/133 [SOURCE: R5 Q14, Q16; R6-q8]. Target p50 ≤ 25 s, p90 ≤ 75 s, model ≥ 60%, > 60 s ≤ 25%; bike_setup drop-off not above baseline. FS-R2-5: `onboarding_bike_created.make_valid=false` = 0 (T05e); baseline 4 of 29. Tiles "FS-OB4", "FS-R2-5". Annotate Release B.

## Release
Release B; `FS-OB4: 3`, `FS-R2-5: 3`.

## Dependencies
- Blocked by: T25a.
- Blocks: T35.

## Out of scope
NHTSA cache (T37).

## Constraints
D1, D1c; `bike_added.capture_level` semantics kept; light/dark.
