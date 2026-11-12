---
title: "[#365 T07a] Experiment 2: import the service schedule when onboarding creates the bike (API)"
labels: [bug, experiment, area:api, activation-365]
order: 15
task_id: T07a
depends_on: [T02, T03a, T06]
phase: P1
size: S
release_path: "API deploy on Render after T02 baseline + T03a annotation; reaches every app version at once"
---

## Context
#365, plan §3 T07 (split a), board Experiment 2 [SOURCE: board/99-synthesis.md §4], specs FS-PO1H, FS-R2-4, S4.

## Why
`completeOnboarding` imports OEM tasks only for `acceptedOemScheduleIds` (`apps/api/src/modules/users/users.service.ts:235-264`), which only the retired swipe deck filled (`app/(onboarding)/maintenance.tsx:1-12`). Since 00191 (2026-10-15) onboarding bikes with OEM tasks ≤ 5 min: **10/151 (7%)**; board day-0 schedule **25/111 (23%)** vs 127/204 (62%) before [SOURCE: R2 §3.1, R2-M1; board/99 App. A]. Root cause confidence 90%.

## What to change
When `input.bikeMake` is set, import the full waterfall for the bike the RPC created (its returned `motorcycle_id`, not "latest bike"), in the rider's unit; keep the id-filter branch for the intent cohort; never fail onboarding on import errors. Server event `service_plan_imported {tier, task_count, unit, source:'onboarding'}`. New nullable result fields `servicePlanTaskCount`, `servicePlanTier`.

## How
- `users.service.ts:235-264`: `autoPopulateForBike(...)` with `acceptedIds = undefined`.
- `apps/api/src/modules/oem-schedules/oem-schedules.service.ts:178-273`: optional `measurementSystem` param overriding the `users.measurement_system` read (`:213-220`), passed from `input.bikeMileageUnit` (the client writes the unit after `completeOnboarding`) [SOURCE: R2 C12].
- Jest `users.service.spec.ts`: bike + no accepted ids → one unfiltered call; `'mi'` → miles targets; no bike → no call; import throws → onboarding succeeds; called twice → no duplicates.
- Before deploy: T06 item 7 answer (reminder cap) recorded; D7 confirmed.

## Acceptance criteria
- [ ] Spec cases pass; `pnpm verify:api` green.
- [ ] Deployed only after T02 baselines (S4a/b) and with the annotation `#365 fixes: api <sha> — FS-PO1H, FS-R2-4` on deploy day; both-arm ledger row (Exp 2 both arms).
- [ ] `pnpm generate` run on `main` after the deploy is live (for T07b).

## Verification
- `pnpm verify:api`.
- Production: weekly DB check `queries/db/s4b-r2m1.sql` → ≥ 95% for 2 weeks; `s4a-day0-schedule.sql` → ≥ 55% for 4 straight weeks. PostHog: `service_plan_imported` within 5 min of `onboarding_completed` share.

## Friction spec
FS-PO1H. Repro: fresh install, new free account, onboarding Yamaha → MT-09 → 2019 → finish → Garage → bike → Service: no tasks; Home plate "No service due" (`components/home/home-plate.ts:96-103`). Second case: "Not sure of the details?" → Honda chip (make-generic, 10 rows). Expected: both bikes have pending OEM tasks within seconds, tier shown on make-generic. Automated check: jest (CI) here; Maestro flows in T07b (red first on main).

## Production metric
- PostHog: `countIf(has service_plan_imported ≤ 5 min)/completers with a bike` by deploy date (API reaches all versions) — tile "FS-PO1H — onboarding bikes with a schedule".
- DB weekly: S4(b) baseline 10/151 → ≥ 95%; S4(a) 25/111 → ≥ 55% [SOURCE: R2-M1; board/99 App. A].
- Harm check: S1/S3 vs trailing 8 weeks. Annotate the deploy in PostHog.

## Release
API deploy on Render; old clients unaffected (nullable fields).

## Dependencies
- Blocked by: T02, T03a, T06 (item 7).
- Blocks: T07b, T23, T39.

## Out of scope
Home plate "Set up service plan" (T41); backfill (T39); new model rows.

## Constraints
Logging stays free; tier label kept on make-generic tasks; Exp 2 applies to both Exp 1 arms (ledger).
