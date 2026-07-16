# Plan — Odometer / mileage unit normalization (canonical km)

**Branch:** `fix/odometer-unit-normalization` (worktree `/Users/andrejmacm5/personal/MotoWise-odometer`)
**Decision (confirmed with owner 2026-07-16):** Option A — store all odometer columns in **canonical
km**, convert display-only via the global `users.measurement_system`. Retire the per-bike
`motorcycles.mileage_unit` as a source of truth. Migration ships in the PR but is **applied to prod at
release time** (coordinated with the km-aware OTA/build), not during development.

---

## 1. The bug (root cause)

Odometer integers are stored **raw in the user's display unit** with no normalization, while `interval_km`
and ride distances are km/meters. Wherever the two meet, imperial users get wrong numbers:

- `apps/api/.../maintenance-tasks.service.ts:325` `createNextRecurrence`: `completedMileage(mi) + intervalKm(km)`.
- `apps/api/.../oem-schedules.service.ts:223` `autoPopulateForBike`: `currentMileage(mi) + intervalKm(km)`.
- `apps/mobile/.../record-maintenance.tsx:61` `parsedOdometer(mi) + selectedType.intervalKm(km)`.
- `apps/mobile/.../features/carplay/carplay-bike-status.ts:78` divides `currentMileage` by `KM_PER_MILE`
  as if it were km (double-wrong for imperial).
- Cross-bike sum + many hardcoded-`km` labels on raw values.

`interval_km` carries a **dual meaning** (km for OEM-seeded, raw-user-unit for user-entered #164).

## 2. Ground truth from prod (project `tpsoneenbrmdwvzcbifw`, 2026-07-16)

- Users: **424 metric / 10 imperial**.
- `motorcycles.mileage_unit` **default `'mi'` and unreliable**: 137 bikes are `mi` but owned by a *metric*
  user (the default was never updated). **`users.measurement_system` (NOT NULL, default `metric`) is the
  effective source of truth** — it is what the app has displayed since #164, so it defines the unit each
  stored number is actually in.
- **Conversion scope is tiny (imperial owners only):** `6` bikes with mileage, `101` `target_mileage`
  rows, `6` `completed_mileage` rows. Metric values are already km → untouched.
- **`interval_km` needs no backfill:** every `source='user'` task has `interval_km = NULL`; all `798`
  populated rows are `source='oem'` (genuine km). Dual meaning is a code/contract issue, not a data one.
- **No DB trigger converts ride meters → `current_mileage`.** The only writer is
  `rides.service.ts endRide`, which already converts correctly (`metersToUnit(distanceM, mileage_unit)`).
  `odometer_sync_source` is populated (`gps_ride` 11, `manual` 200), so the path is live.
- Discriminator for OEM vs user tasks: `maintenance_tasks.source` (`'user'` default | `'oem'`) +
  `oem_schedule_id`.
- Highest prod migration version: **`00164`** → next is **`00165`**.

## 3. The contract (single, documented)

> All persisted odometer/mileage integers are **kilometres**:
> `motorcycles.current_mileage`, `maintenance_tasks.target_mileage`, `completed_mileage`, `interval_km`.
> The display unit is derived from `users.measurement_system` (global). Convert **user input → km on
> write** and **km → display unit on read**, exactly like `fuel_logs.odometer_km` and `rides.distance_m`.
> `motorcycles.mileage_unit` is **deprecated** (kept as a column for old-client compatibility; normalized
> to `'km'` by the migration; no longer authoritative — never read for new logic).

## 4. Migration `00165_normalize_odometer_to_km.sql` (DATA-ONLY, idempotent, reversible)

No schema change (all columns already INTEGER) → **no `generate:types` diff expected**. One transaction:

1. Convert `maintenance_tasks.target_mileage`/`completed_mileage` `*= KM_PER_MILE` (rounded) for tasks
   whose motorcycle is owned by an **imperial** user **and** `motorcycles.mileage_unit <> 'km'` (the
   pre-state guard — done *before* step 3 so re-runs skip).
2. Convert `motorcycles.current_mileage` `*= KM_PER_MILE` (rounded) for **imperial** owners where
   `mileage_unit <> 'km'`.
3. `UPDATE motorcycles SET mileage_unit = 'km'` for **all** rows (every stored number is now km; makes
   the deprecated column truthful and serves as the idempotency guard for re-runs).
4. `interval_km`: **no change** (all rows already km).

**Idempotency:** steps 1–2 are guarded by `mileage_unit <> 'km'`; step 3 flips every bike to `'km'`, so a
second run converts nothing. **Reversibility:** deterministic — rollback divides the same imperial cohort
(`measurement_system='imperial'`) by `KM_PER_MILE` and resets `mileage_unit='mi'`. Rollback SQL + a
pre-image snapshot query are recorded in the migration header. `KM_PER_MILE = 1.609344`.

**Release runbook (NOT executed now) — MIGRATION FIRST, then OTA:**
1. Merge PR.
2. Snapshot the 113 affected rows (pre-image query in the migration header).
3. Apply `00165` via Supabase MCP `apply_migration`; if it lands under a timestamp version, repair to
   `00165` per `project_supabase_migration_divergence`.
4. **Only then** promote the km-aware OTA/build to the `production` channel.
5. Verify imperial displayed values are unchanged.

**Why migration-first (ordering hazard — CodeRabbit #6):** the migration's idempotency guard treats
`mileage_unit <> 'km'` as "still legacy miles." If the km-aware app reached imperial users *before* the
migration ran, it would write canonical km (and `endRide` would add a km delta onto a still-miles
odometer) while `mileage_unit` stayed `'mi'` — then the migration would multiply those already-km values
by `KM_PER_MILE` again, corrupting them. Running the migration first means no km writes exist until the
data is converted and `mileage_unit` is flipped to `'km'`, so every subsequent new-app write is already
km-on-km. The only cost is a brief, read-only cosmetic window where pre-OTA old-app imperial users see
km-valued numbers under a `mi` label — self-healing the moment they take the OTA. (Old apps keep writing
raw miles in that window; those rows still carry `mileage_unit='mi'`, but the migration already ran, so
they are NOT re-converted — a late old-app write lands as miles-labeled-km. Given the imperial cohort is
~10 users and the OTA propagates to matching builds within minutes, this residual is acceptable; a
hard cutover / brief maintenance pause on writes eliminates it entirely if desired.)

## 5. Shared helpers — `packages/types/src/units.ts`

Add measurement-system-aware wrappers (single source of truth, reused by mobile + API):

```ts
import type { MeasurementSystem } from './constants/enums';
/** km (canonical storage) → value in the user's display unit. */
export function mileageToDisplayUnit(km: number, system: MeasurementSystem): number
  { return system === 'imperial' ? kmToMiles(km) : km; }
/** value typed in the user's display unit → km for storage. */
export function mileageFromDisplayUnit(value: number, system: MeasurementSystem): number
  { return system === 'imperial' ? milesToKm(value) : value; }
/** meters → km (ride sync canonical). */
export function metersToKm(meters: number): number { return meters / METERS_PER_KM; }
```

Update Zod/JSDoc in `motorcycle.ts`, `maintenance-task.ts`, `onboarding-input.ts`, `maintenance-sourcing.ts`
to document "stored in km" and keep `mileageUnit`/`bikeMileageUnit` marked `@deprecated`.

## 6. API changes (`apps/api`)

- **`rides.service.ts endRide`**: `newMileage = current_mileage(km) + round(metersToKm(distanceM))`.
  Drop the `mileage_unit` fetch/fallback. Due-check `target_mileage <= newMileage` is now km-vs-km.
- **`maintenance-tasks.service.ts:325`** & **`oem-schedules.service.ts:223`**: arithmetic is now
  `km + km` → **correct without change**; add a clarifying comment that both operands are km. (Fix is the
  storage contract + client-side write conversion, matching the fuel-log pattern.)
- **Read consumers that build unit labels** (`health-reports`, `trip-assistant`, `diagnostics`,
  `insights`, `report-template.tsx`): derive unit from the owner's `measurement_system` and convert the
  km value to that unit for prompts/PDF, instead of the deprecated `mileage_unit`.
- GraphQL models/DTOs: **no schema change**; keep `mileageUnit` exposed (deprecated). Client stops reading it.

## 7. Mobile changes (`apps/mobile`) — convert at every edge

Everything below uses `useMeasurementSystem()` + the new helpers. **Read** sites wrap the km value in
`mileageToDisplayUnit(km, system)`; **write** sites wrap user input in `mileageFromDisplayUnit(value, system)`.

**Write (input → km):** `edit-bike.tsx:281`, `bike/[id].tsx` mileage update, `complete-task.tsx:94`,
`add-maintenance-task.tsx` (`completedMileage`/`targetMileage`/**`intervalKm`**),
`edit-maintenance-task.tsx` + `utils/maintenance-task-form.ts`, onboarding
(`bike-type`, `bike-setup`, `personalizing`, `last-service`), `components/bike-hub/mileage-display.tsx`.

**Read (km → display):** home `index.tsx:519`, garage `index.tsx:507/749` + cross-bike `totalKm:49`,
`bike/[id].tsx:664/862`, `complete-task.tsx:263`, `edit-*`, `start-ride.tsx:200`, `mileage-overview.tsx`,
`swipeable-task-card.tsx`, `discover/bike-banner.tsx:70`, `expense-dashboard.tsx`, `mileage-slider`.

**Fix hardcoded-`km` labels → global unit:** garage `index.tsx:508/750`, `bike-banner.tsx:70`,
`widget-sync.ts:117/121`, `complete-task.tsx:382`.

**CarPlay:** `carplay-bike-status.ts:78` — treat `currentMileage` as km, convert via passed-in system,
remove the `/KM_PER_MILE` hack; `carplay/index.tsx:40` — use global system, drop `bike.mileageUnit`;
`carplay-templates.ts` overdue compare is km-vs-km → OK.

**Widgets/PDF:** `lib/widget-sync.ts` + `NextServiceWidget.tsx` convert `targetMileage`/`bikeMileage`
km→display; `lib/pdf-template.ts:182` — drop `bike.mileageUnit`, take system, convert values.

**`record-maintenance.tsx`: DELETE** (orphaned/unreachable, duplicates add-maintenance-task's log-past-work;
confirmed no nav entry) — removes bug #2's site and dead code. Verify no imports/route refs first.

**`interval_km` display** already correct via `utils/maintenance-interval.ts convertIntervalDistance`
(treats intervalKm as km) — reused in onboarding/complete-task. Only `add-maintenance-task`'s interval
**input** must convert user value → km on write.

**Onboarding propagation (going-forward correctness):** ensure the onboarding unit choice sets
`users.measurement_system` (not just the per-bike unit), so future users' global unit matches what they
picked. Verify current path (`updateUser` payload maps `measurement_system` at
`users.service.ts:139`).

## 8. Tests

- `packages/types`: unit tests for `mileageToDisplayUnit`/`mileageFromDisplayUnit`/`metersToKm` round-trips.
- `apps/api`: spec proving imperial recurrence next-due is correct in km (regression for bug #1) and
  `endRide` meters→km.
- `apps/mobile`: update `carplay-bike-status.test.ts`, `carplay-templates.test.ts`, `pdf-template.test.ts`,
  `maintenance-interval.test.ts`, onboarding-store tests for the new conversion contract; add a
  write/read round-trip test for a maintenance-task input helper.

## 9. Gates before PR

`pnpm --filter mobile typecheck`, `pnpm --filter @motovault/api typecheck`, relevant Jest/Vitest, Biome,
i18n ratchet (`scripts/check-i18n-new-keys.ts origin/main`) + ESLint i18n guard on changed mobile files,
`scripts/check-no-router-any.sh`. Regenerate GraphQL only if a `.graphql`/resolver changed (not expected).
Commit in logical chunks; open PR vs `main`; watch CI green. `--no-verify` only if the pre-commit
codegen hook can't boot the API locally (dummy env per #164).

## 10. Definition of done

Single documented km contract; recurrence, CarPlay, ride-sync, and record-maintenance paths correct for
both metric & imperial; migration written + verified (not yet applied to prod) with rollback; imperial
recurrence test proves the fix; `interval_km` dual meaning resolved (always km); per-bike `mileage_unit`
retired; tests + CI green; memory updated.
