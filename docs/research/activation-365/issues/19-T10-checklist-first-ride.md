---
title: "[#365 T10] Checklist \"first ride\" row: no tick on tap or without a real ride; leads to Start Ride"
labels: [bug, area:mobile, activation-365]
order: 19
task_id: T10
depends_on: [T05d]
phase: P1
size: S
release_path: "Release A 3.29.0 (both arms, before the slot)"
---

## Context
#365, plan §3 T10, spec FS-PO10, owner decision D4.

## Why
Every row press calls `completeItem` before navigating (`components/home/onboarding-checklist.tsx:153-160`); FIRST_RIDE completes on any completed ride (`lib/checklist-signals.ts:44-47`) and links to the empty rides list (`stores/checklist.store.ts:66-72`). 17 riders ticked it by tap (3 had a real ride); 8 were data-ticked without a real ride [SOURCE: R4 Q-R4-10].

## What to change
Data-backed items never tick on tap; FIRST_RIDE needs duration ≥ `MIN_RIDE_ELAPSED_S` and distance ≥ `MIN_RIDE_DISTANCE_M`; label "Record your first ride" → `/(modals)/start-ride` (D4).

## How
Add `distanceM`/`durationS` to the Home rides fragment in `apps/mobile/src/graphql/` → `pnpm generate`; `lib/checklist-signals.ts`, `components/home/use-checklist-signals.ts`, `stores/checklist.store.ts` (persist migration), `onboarding-checklist.tsx`, 7 locales. Jest `lib/__tests__/checklist-signals.test.ts`, `components/home/__tests__/onboarding-checklist.test.tsx`.

## Acceptance criteria
- [ ] Jest: 0 m ride does not complete; 60 s / 800 m does; data-backed press does not call `completeItem`.
- [ ] Red run of `checklist-first-ride.yaml` on main, then green both platforms; light/dark screenshots.
- [ ] `pnpm verify:mobile`, `pnpm check:i18n`.

## Verification
`pnpm --filter @motovault/mobile test:e2e:checklist-first-ride` (local).

## Friction spec
FS-PO10. Repro: new account → Home → tap "See your first ride stats". Expected: stays unticked; opens Start Ride. Automated check: maestro (local, both) `checklist-first-ride.yaml`: `tapOn: {id: "checklist-row-first_ride"}` → `assertVisible: {id: start-ride-screen}` → close → `assertVisible: {id: "checklist-row-first_ride", checked: false}`. Red first.

## Production metric
`trigger='tap'` completions of `first_ride` and data-ticked without a real ride, by `{REL}` (verbatim `R4…:430-436`). Baseline tap 17 riders; data-ticked without a real ride 8 [SOURCE: R4 Q-R4-10]. Target 0 / 0 on lvl ≥ 2. Tile "FS-PO10 — checklist first ride". Annotate Release A.

## Release
Release A; `FS-PO10: 2`.

## Dependencies
- Blocked by: T05d.
- Blocks: T32, T18.

## Out of scope
Other checklist items' destinations (T28).

## Constraints
Light/dark; 7 locales; D4.
