# Plan — Odometer / mileage unit fix (raw storage, convert at edges)

**Branch:** `fix/odometer-unit-normalization`
**Decision (owner, 2026-07-16):** Option A (canonical km) was explored and **reverted** in favour of
**Path 2 — keep odometer values stored RAW in the user's unit, fix only the arithmetic edges** — because
it is **fully backward compatible with the live app (zero rollout window, no migration)**. A canonical-km
migration would reinterpret `current_mileage`, breaking the ~10 imperial users on the currently-live
build until they update (single-column reinterpretation has no safe ordering); a true parallel-column
migration is disproportionately risky here because the unit lives on `users.measurement_system`
(mutable, cross-table), forcing stateful sync triggers. Path 2 avoids all of that.

## The contract (single, documented)

> `motorcycles.current_mileage`, `maintenance_tasks.target_mileage`, and `completed_mileage` are stored
> **RAW in the user's global `users.measurement_system` unit** (mi for imperial, km for metric) — the same
> convention the shipped app already uses. The per-bike `motorcycles.mileage_unit` is **deprecated** and
> MUST NOT be read to decide a value's unit (it defaults `'mi'` and is unreliable); use
> `measurement_system` for the display **label**.
>
> `maintenance_tasks.interval_km` is **kilometres for OEM-seeded tasks** (`source = 'oem'`) and
> **raw user-unit for user-entered tasks** (`source = 'user'`). Wherever `interval_km` (km, OEM) meets a
> raw odometer value, convert km → the user's unit at that edge — never store a converted odometer.
>
> No DB migration. No storage change. Old and new app share the identical storage contract → zero
> rollout window; the build and any backend deploy can ship in any order.

## Shared helpers — `packages/types/src/units.ts`

- `mileageToDisplayUnit(km, system)` — km → the user's unit (used at the km-meets-raw arithmetic edges,
  e.g. converting an OEM `interval_km` before adding it to a raw odometer).
- `mileageUnitLabel(system)` — `'mi'|'km'` label from the global system.
- (`mileageFromDisplayUnit` kept for symmetry / interval input; `metersToKm` removed — ride sync uses the
  existing `metersToUnit`.)

## Fixes at the edges

### API (`apps/api`)
- **`maintenance-tasks.service.ts createNextRecurrence`** — `targetMileage = completedMileage +
  interval`, where `interval = source === 'oem' ? mileageToDisplayUnit(intervalKm, ms) : intervalKm`
  (OEM interval is km → convert to the user unit; user-entered interval is already the user unit).
  Fetch the owner's `measurement_system` (`ms`).
- **`oem-schedules.service.ts autoPopulateForBike`** — `targetMileage = currentMileage +
  mileageToDisplayUnit(schedule.intervalKm, ms)` (currentMileage raw user-unit; schedule interval km).
- **`rides.service.ts endRide`** — `newMileage = current_mileage + round(metersToUnit(distanceM, unit))`
  where `unit` derives from the owner's `measurement_system` (NOT the deprecated per-bike `mileage_unit`).
  Due-check `target_mileage <= newMileage` is raw-vs-raw → correct.
- **read consumers** (`health-reports`, `trip-assistant`, `diagnostics`, `insights`, report PDF) — the
  value is already in the user's unit; render/prompt it RAW with a `measurement_system`-derived label
  (do not convert; do not read `mileage_unit`).

### Mobile (`apps/mobile`)
- **Display**: render `current_mileage`/`target_mileage`/`completed_mileage` RAW; label via
  `useMileageUnit()` / `mileageUnitLabel(system)` (fixes the old hardcoded-`km` labels). No value conversion.
- **Write**: store the user's typed number RAW (no km conversion).
- **Interval display**: `convertIntervalDistance(intervalKm, system)` (km→user unit) stays for OEM
  intervals shown in onboarding/complete-task.
- **CarPlay** `carplay-bike-status.ts` — show `current_mileage` RAW + `mileageUnitLabel(system)` (remove
  both the old `/KM_PER_MILE` divide and the km-storage conversion); `carplay/index.tsx` — global label.
- **Onboarding** `personalizing.tsx` — store `bikeMileage` RAW; **keep** persisting `measurement_system`
  from the unit toggle (the pre-existing gap fix, still valid).
- **edit-bike** — keep the `accessibilityLabel` on the odometer input (a11y + E2E targetability).
- **Deleted dead code**: `record-maintenance.tsx`, `mileage-prompt.tsx`.

## Tests
- `packages/types`: `mileageToDisplayUnit` / `mileageFromDisplayUnit` / `mileageUnitLabel` unit tests.
- API: recurrence proves an **OEM** imperial task's next-due converts the km interval to miles (no 1.61×
  inflation) and a **user** imperial task adds the raw interval directly; `endRide` meters→user-unit.
- Mobile: unit-contract test asserts the edge conversions + raw display; `maintenance-task-form` /
  `pdf-template` assert raw.
- Maestro: `units-display-toggle.yaml` (label follows global unit) stays; the km-round-trip flow is
  removed (raw storage does not reconvert a stored value on unit switch).

## Gates
mobile + api + web typecheck; Jest/Vitest; Biome; i18n ratchet + ESLint guard; router-any guard; CI green.

## Definition of done
Single documented raw-in-user-unit contract; recurrence (OEM + user), OEM-autopopulate, CarPlay,
ride-sync all correct for metric & imperial; **no migration / zero rollout window**; `interval_km`
dual meaning handled at the edges via `source`; per-bike `mileage_unit` retired for logic; tests + CI green.
