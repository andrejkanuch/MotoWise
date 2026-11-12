---
title: "[#365 T25a] API: motorcycle models ranked popular-first (fleet count, then alphabetical)"
labels: [enhancement, area:api, activation-365]
order: 37
task_id: T25a
depends_on: [T04c]
phase: P2
size: S
release_path: "API deploy on Render first (before T25b client), annotation"
---

## Context
#365, plan §3 T25 (split a), spec FS-OB4, §3A.0 rule 3.

## Why
Models show the first 6 alphabetically (`components/onboarding/bike-setup/model-picker.tsx:35-54`); bike_setup p50 44 s / p90 146 s Android; model share 62/141 (44%) [SOURCE: R5 OB4, Q14–Q16].

## What to change
`motorcycleModels` returns models ordered by fleet count (bikes per make+model in `motorcycles`, aggregated, no user data exposed) then name; optional `rank` field (nullable). Source: `apps/api/src/modules/motorcycles/motorcycles.resolver.ts`, `nhtsa.service.ts:118-135` (or reuse `makeStats`).

## How
Jest spec: ordering with ties; empty fleet → alphabetical. Cache the counts (daily). `pnpm verify:api`; deploy; `pnpm generate` on main.

## Acceptance criteria
- [ ] Spec passes; old clients unaffected (same list, new order); deploy annotated.

## Verification
GraphQL query for make "YAMAHA" after deploy → MT-07/MT-09 in the first 6 (if fleet supports it).

## Friction spec
FS-OB4 (API part). Repro: bike setup → Yamaha → model list. Expected: popular models first. Automated check: jest (CI) ordering spec (red first: alphabetical on main).

## Production metric
`bike_setup_summary.model_picked_via='list'` share and dwell by deploy date. Baseline from T04c (2–4 weeks of TR0 data). Full target in T25b. Annotate the deploy.

## Release
API deploy before T25b.

## Dependencies
- Blocked by: T04c.
- Blocks: T25b.

## Out of scope
Client search (T25b); NHTSA cache (T37).

## Constraints
Aggregates only; no per-user data in the response.
