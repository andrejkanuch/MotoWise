---
title: "[#365 T09] A standstill ride ended from the guard is not saved (End without saving)"
labels: [bug, area:mobile, activation-365]
order: 18
task_id: T09
depends_on: [T05c]
phase: P1
size: M
release_path: "Release A 3.29.0 (before the Exp 1 slot, both arms)"
---

## Context
#365, plan §3 T09, spec FS-PO4b, owner decision D3.

## Why
"End Anyway" → `executeEndRide` → a summary that says "RIDE SAVED" (`app/(modals)/ride-hud.tsx:202-211, 244-257`; `app/(modals)/ride-summary.tsx:193-279`). 26 of 72 new riders' first ride is a live sub-50 m ride [SOURCE: R4 S-R4-01]; `below_min_ride=true` saves via the summary: **13 saves / 11 riders** on ≥ 3.21 (15/13 incl. auto-end) [SOURCE: R4 Q-R4-08, R4:159-161].

## What to change
When the guard fires below **both** floors and it is not the no-GPS ≥ 120 s branch, "End Anyway" becomes "End without saving": end + discard + toast "Not saved: rides under {{seconds}} s or {{meters}} m aren't kept" (from `MIN_RIDE_ELAPSED_S`/`MIN_RIDE_DISTANCE_M`, `utils/ride-constants.ts:25-26`) + route Home; `ride_discarded {reason:'below_min_guard'}`; no `ride_completed`.

## How
Extract `discardEndedRide(rideId, reason)` from `ride-summary.tsx:256-279` into `features/ride/ride-controller.ts`; call it from the guard's end handler. 7 locales. Update `log-ride.yaml` (expects "RIDE SAVED" for a standstill, `:62-80`) to a moving route (`setLocation` sequence); new `ride-standstill-not-saved.yaml`. Jest `features/ride/__tests__/ride-controller.test.ts`.

## Acceptance criteria
- [ ] Red run of `ride-standstill-not-saved.yaml` on `origin/main` (shows RIDE SAVED), then green on both platforms.
- [ ] A ≥ 30 s / ≥ 50 m ride still reaches the summary (`log-ride.yaml` moving route green).
- [ ] CarPlay end path unchanged; HUD stays `HUD_THEME`; toast light/dark screenshots; `pnpm verify:mobile`, `pnpm check:i18n`.

## Verification
`pnpm --filter @motovault/mobile test:e2e:ride-standstill-not-saved` (local, iOS sim + Android emu).

## Friction spec
FS-PO4b. Repro: sim with fixed `setLocation`, new account, FAB → Start → wait 5 s → hold to end → guard → "End Anyway". Expected: no "RIDE SAVED"; rides list "No rides yet"; `ride_discarded`. Automated check: maestro (local, both) `ride-standstill-not-saved.yaml`: `tapOn: {id: tab-ride-fab}` → `tapOn: {id: start-ride-button}` → wait 5 s → `longPressOn: ".*Hold to end ride.*"` → `tapOn: {id: ride-guard-end-anyway}` → `assertNotVisible: ".*RIDE SAVED.*"` → `tapOn: {id: tab-profile}` → Rides → `assertVisible: {id: rides-empty-cta}`. Red first.

## Production metric
`below_min_ride=true` with `save_trigger='summary'` on `ride_completed` by `{REL}` (verbatim `R4…:408-414`). Baseline 13 saves / 11 riders (60 d) [SOURCE: R4 Q-R4-08]. Target 0 on lvl ≥ 2. Secondary: `ride_saved {is_first, below_min}` share (T05e) 26/72 → < 5%. Tile "FS-PO4b — standstill rides saved". Annotate Release A.

## Release
Release A; `FS-PO4b: 2`.

## Dependencies
- Blocked by: T05c.
- Blocks: T31, T18.

## Out of scope
Ride floors; auto-ended sub-floor rides (D3 second question).

## Constraints
Ride recording stays free; D3 approval; light/dark.
