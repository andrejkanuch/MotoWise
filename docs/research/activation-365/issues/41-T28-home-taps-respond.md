---
title: "[#365 T28] Home taps always respond (checklist rows, bike card, receipt card, empty states)"
labels: [bug, area:mobile, activation-365]
order: 41
task_id: T28
depends_on: [T05d]
phase: P2
size: M
release_path: "Release B 3.30.0"
---

## Context
#365, plan §3 T28, spec FS-PO6.

## Why
5 dead-tap and 5 empty-state replays; first-hour `$rageclick` 15/282, **3.26.0 7/117 (6%)** [SOURCE: R6 F-PO6, R6-q3]; autocapture is off, so dead taps are invisible in events [SOURCE: 05 PO6].

## What to change
First break `$rageclick` down by `$screen_name`/`$el_text` (record the worst control in `experiments.md`); every checklist deep link resolves to a registered route; bike card, receipt card and empty rows navigate/open a sheet or stop looking tappable.

## How
Jest `__tests__/stores/checklist.store.test.ts`: every `ALL_CHECKLIST_ITEMS[].deepLink` is a registered route. Maestro `home-taps-respond.yaml`.

## Acceptance criteria
- [ ] Jest red on main if any dead link exists, green after; Maestro green both platforms; light/dark.

## Verification
`pnpm --filter @motovault/mobile test:e2e:home-taps` (local).

## Friction spec
FS-PO6. Repro: fresh account with the onboarding bike; tap every checklist row, bike card, receipt card, empty rows. Expected: visible response ≤ 300 ms. Automated check: maestro (local, both) for each `id: checklist-row-<id>` tap → `extendedWaitUntil` target testID (5000) → back; `assertVisible: {id: rides-empty-cta}` → tap → Start Ride.

## Production metric
First-hour `$rageclick` riders (verbatim `R6…:401-406`) by `{REL}` and `$screen_name`. Baseline 3.26.0 7/117 (6%) [SOURCE: R6-q3]. Target ≤ 3%; 0 dead checklist links. Tile "FS-PO6 — rage taps". Annotate Release B.

## Release
Release B; `FS-PO6: 3`.

## Dependencies
- Blocked by: T05d.
- Blocks: T35.

## Out of scope
New Home content (Exp 1 slot).

## Constraints
Light/dark.
