---
title: "[#365 T04c] bike_setup_summary event (dwell, queries, how make/model were picked, model fetch time)"
labels: [instrumentation, area:mobile, area:analytics, activation-365]
order: 7
task_id: T04c
depends_on: [T01]
phase: P0
size: S
release_path: "TR0 per-runtime OTA + Release A"
---

## Context
#365, plan §3 T04 (split c), spec FS-OB4. Data for T13b, T25a/b, T37.

## Why
bike_setup is the slowest onboarding step (p50 44 s / p90 146 s Android; 37/109 s iOS); 60–75% of onboarding bikes are make-only [SOURCE: R5 Q14–Q16]; 3.26.0 56/133 (42%) take > 60 s [SOURCE: R6-q8]. No event tells whether search, list or fetch latency causes it [SOURCE: R5 Q16].

## What to change
`bike_setup_summary {outcome: completed|skipped|back|left, duration_ms, make_queries, model_queries, make_picked_via, model_picked_via: list|search|custom|none, model_list_size, model_fetch_ms, year_changed}` fired once when the rider leaves `app/(onboarding)/bike-setup.tsx`; counters in `components/onboarding/bike-setup/make-grid.tsx` and `model-picker.tsx`.

## How
A small counter hook (`components/onboarding/bike-setup/use-bike-setup-telemetry.ts`) passed to both components. Jest: one event per leave, counters correct for search vs list picks, `model_fetch_ms` measured around the models query.

## Acceptance criteria
- [ ] Jest passes; `pnpm verify:mobile`; schema doc updated.
- [ ] Event fires exactly once per screen leave (back, continue, skip, app background > 30 min counts as `left` on next mount).

## Verification
`SELECT toString(properties.model_picked_via) via, count(), quantile(0.9)(toFloat(properties.model_fetch_ms)) FROM events WHERE event='bike_setup_summary' AND timestamp > now() - INTERVAL 14 DAY AND {EXCL} GROUP BY via`.

## Friction spec
FS-OB4 (measurement). Repro: any platform, bike setup, type "Yamaha", pick from list, continue. Expected: one event with `make_picked_via` set and `duration_ms` > 0. Automated check: jest (CI).

## Production metric
FS-OB4: dwell p50/p90 and model share by `{REL}` (verbatim `R5…:269-283`) plus `model_fetch_ms` p90. Baseline p50 44 s / p90 146 s Android, model 62/141 (44%) [SOURCE: R5 Q14, Q16]. Targets are owned by T25b; T37 triggers only if `model_fetch_ms` p90 > 3 s. Tile "FS-OB4 — bike setup dwell and model share". Annotate per T03a.

## Release
JS only → TR0 + Release A.

## Dependencies
- Blocked by: T01.
- Blocks: T13b, T25a, T37, TR0.

## Out of scope
Search behaviour changes (T25b).

## Constraints
No free-text queries in properties (counts only); add, never rename, `bike_added` properties.
