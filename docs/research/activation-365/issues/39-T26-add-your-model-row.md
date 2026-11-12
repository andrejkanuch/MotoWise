---
title: "[#365 T26] \"Add your model\" row for make-only bikes in the bike hub"
labels: [enhancement, area:mobile, activation-365]
order: 39
task_id: T26
depends_on: [T23]
phase: P2
size: S
release_path: "Release B 3.30.0"
---

## Context
#365, plan §3 T26, spec FS-R2-3 (source `bike_hub`).

## Why
52/104 onboarding bikes on 3.26.0 are make-only; 117 blank-model live bikes, 7 ever had a task; most never tap Add, so T22 does not reach them [SOURCE: R2-PH4, R2-DB6].

## What to change
In `components/bike-hub/overview/overview-segment.tsx`, when `model === ''`, a row "Add your model for its exact service schedule" → edit-bike; show the tier on make-generic tasks. testID `bike-hub-add-model-row`. `garage_bike_edited.source = 'bike_hub'`.

## How
Jest render test (row shown only for make-only). Maestro step appended to `onboarding-make-only-service-plan.yaml`.

## Acceptance criteria
- [ ] Red run of the appended step on main (no row), green after; light/dark; 7 locales.

## Verification
Maestro log (local, both).

## Friction spec
FS-R2-3 (bike hub path). Repro: make-only onboarding bike → Garage → bike. Expected: the row → edit-bike. Automated check: maestro (local, both) `tapOn: {id: bike-hub-add-model-row}` → `assertVisible: {id: edit-bike-model-search}`. Red first.

## Production metric
FS-R2-3 by `properties.source = 'bike_hub'` (T23 tile). Baseline DB proxy 7/117 [SOURCE: R2-DB6]. Target ≥ 20% overall [UNBACKED — own target]. Annotate Release B.

## Release
Release B; `FS-R2-3: 3`.

## Dependencies
- Blocked by: T23.
- Blocks: T35.

## Out of scope
Home (Exp 1 slot).

## Constraints
Bike hub only; light/dark; 7 locales.
