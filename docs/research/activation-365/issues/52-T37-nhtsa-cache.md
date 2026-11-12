---
title: "[#365 T37] (Conditional) Persist the NHTSA model catalog"
labels: [enhancement, area:api, activation-365]
order: 52
task_id: T37
depends_on: [T04c]
phase: P4
size: S
release_path: "API deploy + annotation (only if triggered)"
---

> CLOSED 2026-11-12 by doc review: moved to the experiments ledger (EXECUTION_PLAN §10)

## Context
#365, plan §3 T37, spec FS-OB4 (latency part).

## Why
If model lists load slowly, T25b's gains are capped. Trigger: `bike_setup_summary.model_fetch_ms` p90 > 3 s over 4 weeks.

## What to change
Persist the catalog (`apps/api/src/modules/motorcycles/nhtsa.service.ts:387-425`, `apps/api/src/modules/redis/*`); target p90 ≤ 1.5 s.

## How
Spec for cache hit/miss/expiry; deploy; annotate.

## Acceptance criteria
- [ ] Trigger decision recorded; if built, p90 ≤ 1.5 s on the deploy date onwards.

## Verification
`SELECT quantile(0.9)(toFloat(properties.model_fetch_ms)) FROM events WHERE event='bike_setup_summary' AND timestamp > now() - INTERVAL 28 DAY AND {EXCL}`.

## Friction spec
FS-OB4 (latency). Repro: cold API, bike setup → pick make. Expected: models ≤ 1.5 s. Automated check: jest (CI) cache spec.

## Production metric
`model_fetch_ms` p90 by deploy date; baseline from T04c; target ≤ 1.5 s. Annotate.

## Release
API deploy.

## Dependencies
- Blocked by: T04c.
- Blocks: —

## Out of scope
Search UX (T25b).

## Constraints
No user data in the cache.
