---
title: "[#365 T31] Exp 1 test arm: teaching sheet for a standstill first ride"
labels: [experiment, area:mobile, activation-365]
order: 44
task_id: T31
depends_on: [T09, T30, T05c]
phase: P3
size: M
release_path: "Release B 3.30.0 (test arm only)"
---

## Context
#365, plan §3 T31, spec FS-PO4a, D13.

## Why
26 of 72 new riders' first ride is a live sub-50 m ride [SOURCE: R4 S-R4-01]; ≥ 3.21 only 3/20 standstill-first riders saved a real ride ≤ 7 d [SOURCE: R4 Q-R4-06].

## What to change
Pure `features/activation/guard-variant.ts` `selectGuardVariant({elapsedS, distanceM, hasRealRide, arm})`: teaching only for test arm, `distance_m < 10`, too-short branch, no real ride. Title "Test ride: all good" if `gps_fix` else "Testing it out?"; body states both floors (interpolated); buttons "Got it" (= T09 discard), "Keep recording", "Remind me on my next ride day" (T32 chips, `action:'remind_me'`); `variant:'teaching'`. testIDs `ride-guard-variant-teaching`, `ride-guard-got-it`, `ride-guard-remind-me`.

## How
Jest `app/(modals)/__tests__/ride-guard-variant.test.ts` (all branches incl. no-GPS ≥ 120 s, distance 9/10/50). Maestro `ride-standstill-teaching.yaml` with `EXPECTED_ARM`.

## Acceptance criteria
- [ ] Jest passes; Maestro green in both arms (test: teaching; control: default); HUD stays dark; 7 locales.

## Verification
`EXPECTED_ARM=test …` and `EXPECTED_ARM=control …` runs (local, both).

## Friction spec
FS-PO4a. Repro: sim with fixed `setLocation`, new account, test arm, FAB → Start → wait 5 s → hold to end. Expected: teaching sheet with both floors and three buttons; control unchanged. Automated check: maestro (local, both) `tapOn: {id: start-ride-button}` → wait 5 s → `longPressOn: ".*Hold to end ride.*"` → `assertVisible: {id: ride-guard-variant-teaching}` → `assertVisible: ".*30 seconds.*50 m.*"` → `tapOn: {id: ride-guard-got-it}` → `assertNotVisible: ".*RIDE SAVED.*"`; control asserts `ride-guard-variant-default`.

## Production metric
Hygiene: 0 teaching sheets with `distance_m ≥ 10` or after a real ride; ≥ 95% of eligible test-arm sheets are teaching (verbatim `R4…:376-389` by arm). Outcome descriptive only. Tile "FS-PO4a — teaching sheet hygiene". Annotate Exp 1 launch.

## Release
Release B, test arm.

## Dependencies
- Blocked by: T09, T30, T05c.
- Blocks: T35.

## Out of scope
Ride floors.

## Constraints
`HUD_THEME`; D13 copy; ride recording free.
