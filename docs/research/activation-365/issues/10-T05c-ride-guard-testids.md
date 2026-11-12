---
title: "[#365 T05c] Ride guard props (gps_fix, max_speed_kmh, has_real_ride, variant), ride/HUD testIDs, guard sheet in the a11y tree, log-ride.yaml on ids"
labels: [instrumentation, area:mobile, area:analytics, activation-365]
order: 10
task_id: T05c
depends_on: [T00, T01]
phase: P0
size: M
release_path: "Release A store build 3.29.0 (event properties, guard-sheet render change, testIDs; D17)"
---

## Context
#365, plan §3 T05 (split c), §3A.4, specs FS-PO4a/b, FS-PO5, FS-PO14. Board instrumentation #3 [SOURCE: board/99-synthesis.md:224].

## Why
26 of 71 sign-ups' first rides are live sub-50 m rides, plus 15 with null distance [SOURCE: R4 S-R4-01; V1-db9]; `ride_too_short_shown` lacks `gps_fix`/`max_speed_kmh` [SOURCE: ride-hud.tsx:213-228]; no testIDs on Start Ride/HUD and the guard sheet buttons are not in the a11y tree, so Maestro uses point taps [SOURCE: R4 §2.3; memory project_maestro_authoring].

## What to change
- `ride_too_short_shown` gains `gps_fix` (new `hadFixRef`, set when any point is buffered, `app/(modals)/ride-hud.tsx:93, 140-151`), `max_speed_kmh`, `has_real_ride`, `variant: 'default'`.
- testIDs: `tab-ride-fab` (`app/(tabs)/_layout.tsx:137`), `start-ride-screen`, `start-ride-button` (`app/(modals)/start-ride.tsx`), `ride-hud-root`, `ride-guard-sheet`, `ride-guard-keep`, `ride-guard-end-anyway`, `ride-guard-variant-default` (`ride-hud.tsx:332-436`); render the sheet content so its buttons are accessible.
- `apps/mobile/.maestro/flows/log-ride.yaml`: replace point taps (`:14-19, 56-71`) with the ids.

## How
Jest for the event shape. Maestro `inspect_screen` on iOS sim and Android emulator; paste the hierarchy showing every id in the PR.

## Acceptance criteria
- [ ] Every listed id visible to `inspect_screen` on both platforms (incl. guard buttons).
- [ ] `log-ride.yaml` passes on both using ids only: `pnpm --filter @motovault/mobile test:e2e:log-ride`.
- [ ] HUD stays `HUD_THEME` (always dark); `pnpm verify:mobile` green.

## Verification
Maestro (local, iOS sim + Android emu) logs in the PR. Production: `countIf(properties.gps_fix IS NOT NULL)/count()` on `ride_too_short_shown` for `$app_version = '3.29.0'` = 100% (properties and testIDs ship together in Release A, D17).

## Friction spec
FS-PO5 regression guard enabler. Repro: none (enabler). Expected: flows address ride UI by id. Automated check: maestro (local, both) `log-ride.yaml` + `inspect_screen` output.

## Production metric
FS-PO4a/4b mechanism split: `ride_too_short_shown` by `gps_fix`, `distance_m < 10`, `has_real_ride` by `{REL}` (verbatim `R4…:376-389`). Baseline ≥ 3.21: 1/14 standstill-first riders saved a real ride ≤ 7 d with a complete 7-day window [SOURCE: V1-q35] (R4 Q-R4-06's 3/20 had no window guard). Tile "FS-PO4 — standstill guard shown". Annotate per T03a.

## Release
JS only. Everything ships in **Release A 3.29.0** (owner rule D17, 2026-11-12; TR0 removed by D17): the `ride_too_short_shown` properties (`gps_fix`, `max_speed_kmh`, `has_real_ride`, `variant`), the guard-sheet render change (buttons in the a11y tree) and every testID. No OTA (D14b, D17); no commit split is needed.

## Dependencies
- Blocked by: T00 (test environment), T01.
- Blocks: T09, T27, T31, T18.

## Out of scope
Changing guard behaviour (T09, T31); ride floors (30 s / 50 m, `utils/ride-constants.ts:25-26`).

## Constraints
Ride recording stays free; HUD theme unchanged.
