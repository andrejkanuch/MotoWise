---
title: "[#365 T22] Bike limit: \"Update my bike\" before \"Add a second bike (Pro)\""
labels: [enhancement, area:mobile, activation-365]
order: 35
task_id: T22
depends_on: [T21, T23, T05d]
phase: P2
size: M
release_path: "Release B 3.30.0"
---

## Context
#365, plan §3 T22, §3A.2 (edit-bike model search exists), spec FS-PO1, D5.

## Why
7/118 completers on 3.26.0 hit the bike paywall on day 0; none of 29 day-0 bike-paywall riders got a second bike, deleted one or (make-only) set a model; several opened edit-bike around the paywall [SOURCE: R2 §3.2, R2-PH3, R2-PH4, R2-DB5]. Editing is free (`app/(tabs)/(garage)/edit-bike.tsx:195-305`); its model search exists (`TEST_ID.MODEL_SEARCH`, `:66-84`, rendered `:540-583`) and saving needs a model (`:288`).

## What to change
`hooks/use-add-bike-gate.ts` with pure `decideBikeLimitAction({isPro, bikeCount, bikeModel}) → 'open_form'|'offer_update'|'offer_edit'|'paywall'` used by all entries (`app/(tabs)/(garage)/index.tsx:121-134`, `app/(tabs)/(home)/index.tsx:358-366`, `hooks/use-profile-data.ts:119`, `app/(tabs)/(garage)/add-bike.tsx:136-147`): free with ≥ 1 bike → `LimitSheet` variant "Your plan has one bike", with the button order set by the rider's bike (D5, amended 2026-11-12):
- **bike has an empty model** (make-only, `model === ''`) → `offer_update`: primary "Update my bike" (label "Update <bike name>") → `edit-bike?id=`; secondary "Add a second bike (Pro)" → existing paywall (`feature:'unlimited_bikes'`).
- **bike is complete** (model set) → `offer_edit`: primary "Add a second bike (Pro)" → existing paywall; secondary "Edit <bike name>" → `edit-bike?id=`.
Pro riders → `open_form`. Events `bike_limit_sheet_shown`, `bike_limit_choice {choice}`. testIDs `bike-limit-sheet`, `bike-limit-update`, `bike-limit-second-bike`.

## How
Jest `hooks/__tests__/use-add-bike-gate.test.ts`: free + make-only bike → `offer_update` (update primary); free + complete bike → `offer_edit` (second bike primary, edit secondary); Pro → `open_form`; and a sheet render test asserting the button order for both cases. Maestro `bike-limit-update-bike.yaml` (iOS + Android); README note that `add-bike.yaml` expects the paywall.

## Acceptance criteria
- [ ] Red run on main (paywall directly), green after both platforms; light/dark screenshots; 7 locales.
- [ ] `MAX_BIKES` unchanged; Pro riders never see the sheet (test); both button orders tested (empty model vs complete bike).
- [ ] Ledger date (Home switcher "+" is a gate, logged for Exp 1).

## Verification
`pnpm --filter @motovault/mobile test:e2e:bike-limit-update` (local).

## Friction spec
FS-PO1. Repro: new free account, finish with a make-only bike (Honda chip); Garage header "+", Home switcher "+", Profile "Add bike". Expected: "Your plan has one bike" sheet with "Update Honda" primary (make-only bike); "Update Honda" → edit-bike; save keeps one bike; schedule follows (T23). Automated check: maestro (local, both) `runFlow onboarding.yaml` (MAKE_ONLY) → `tapOn: {id: tab-garage}` → `tapOn: {id: garage-add-bike-header}` → `assertVisible: {id: bike-limit-sheet}` → `tapOn: {id: bike-limit-update}` → `assertVisible: {id: edit-bike-make}` → `tapOn: {id: edit-bike-model-search}` → `inputText: "CB"` → tap first `edit-bike-model-option` → `tapOn: {id: edit-bike-save}` → one bike card → `tapOn: {id: segment-service}` → `assertVisible: {id: "service-task-card-0"}` → `tapOn: {id: garage-add-bike-header}` again (bike now complete) → `assertVisible: {id: bike-limit-sheet}` with "Add a second bike (Pro)" as the primary button. Red first.

## Production metric
Completers with an `unlimited_bikes` paywall request within 1 day (verbatim `deep-dives/R2-bike-limit-and-schedule.md:277-287`) + `bike_limit_choice` split, by `{REL}`. Baseline 3.26.0 7/118 (5.9%) [SOURCE: R2-PH4]. Target ≤ 2% direct; ≥ 50% of sheet viewers choose update and save within 10 min. Tile "FS-PO1 — bike limit on my bike". Annotate Release B.

## Release
Release B (lvl 3); the release cut records the level of FS-PO1 in plan §6.1 (no code map).

## Dependencies
- Blocked by: T21, T23, T05d.
- Blocks: T35.

## Out of scope
Free bike swap/delete loophole (rejected, R2 §4.2 F/G).

## Constraints
D5; `FREE_TIER_LIMITS.MAX_BIKES = 1` unchanged; light/dark; 7 locales.
