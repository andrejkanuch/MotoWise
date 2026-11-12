---
title: "[#365 T23] Changing make/model/year refreshes the bike's schedule (API) + dedup ignores retired tasks"
labels: [enhancement, bug, area:api, activation-365]
order: 34
task_id: T23
depends_on: [T07a, T06]
phase: P2
size: M
release_path: "API deploy on Render + annotation; migration only if needed (owner applies)"
---

## Context
#365, plan §3 T23, review item 12, spec FS-R2-3, D8.

## Why
`updateMotorcycle` never touches tasks (`apps/api/src/modules/motorcycles/motorcycles.resolver.ts:116-123`, `motorcycles.service.ts:98-162`); after T07a make-only bikes carry make-generic rows. 117 blank-model live bikes, 7 ever had a task [SOURCE: R2-DB6]. **Dedup bug:** `autoPopulateForBike` dedups against every `maintenance_tasks` row incl. soft-deleted ones (`apps/api/src/modules/oem-schedules/oem-schedules.service.ts:222-228`; `deleted_at` at `packages/types/src/database.types.ts:2001`), so a re-import after retiring tasks with the same schedule ids imports 0.

## What to change
- If make/model/year/variant changed: soft-delete pending, never-completed, rider-unedited OEM tasks via `soft_delete_maintenance_task` (RPC, user client; `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts:411`), then `autoPopulateForBike` unfiltered in the rider's unit; return `scheduleRefreshedCount` (nullable).
- Dedup: add `.is('deleted_at', null)`.
- "Rider-edited" rule from T06 item 6 (no edited column exists; use the agreed proxy or a migration per D8, owner-applied).

## How
Jest `motorcycles.resolver.spec.ts`: identity change retires only eligible tasks then imports; nickname/odometer change → no call; **year change → same schedule ids → tasks re-created**; completed/edited tasks untouched. `oem-schedules.service.spec.ts`: dedup ignores soft-deleted rows; second call still no duplicates. `pnpm verify:api`; `pnpm generate` after deploy if the type changed.

## Acceptance criteria
- [ ] Specs pass incl. the re-creation case; `pnpm verify:api`.
- [ ] Deployed before T22/T26 client work merges; annotation on deploy day.

## Verification
Production: `garage_bike_edited.schedule_refreshed_count > 0` share among identity edits (after Release B); weekly DB spot check of bikes whose model changed in 7 d having live OEM tasks.

## Friction spec
FS-R2-3. Repro: free account, make-only BMW (make-generic tasks after T07a) → Bike → Edit → model "R 1250 GS", year 2021 → save → Service segment (10 model rows exist, DB-2/DB-4 in plan §7). Expected: pending unedited OEM tasks retired, model waterfall imported, rider's tasks untouched. Automated check: jest (CI) above (red first: dedup case fails on main); Maestro tail of `bike-limit-update-bike.yaml` (T22).

## Production metric
`garage_bike_edited` with `from_capture_level='make'` and `changed_fields` has `model`, over riders with a make-only onboarding bike, 7 d, and `schedule_refreshed_count > 0`. Baseline not measurable (no event); DB proxy 7/117 [SOURCE: R2-DB6]. Target ≥ 20% [UNBACKED — own target]. Tile "FS-R2-3 — model set and schedule refreshed". Annotate the deploy.

## Release
API deploy; migration (if any) applied by the owner only.

## Dependencies
- Blocked by: T07a, T06 (item 6).
- Blocks: T22, T26.

## Out of scope
Client UI (T22, T26).

## Constraints
Soft delete only via the SECURITY DEFINER RPC (CLAUDE.md); never delete rider-edited or completed tasks; user-scoped client, never service-role for user writes.
