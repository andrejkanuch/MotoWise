# Plan — Unit unification + backdating + "log work I already did"

**Branch:** `feat/units-and-task-logging` (worktree `../MotoWise-units`)
**Date:** 2026-07-16
**Team:** product designer + RN UX/UI engineer (planning), RN engineer + code review (implementation review)

## Problem (from user, verbatim intent)

1. **Backdating blocked.** "I remembered a couple of random things I did to my bike a couple of days ago… it won't let me put the date as anything before today. The date needs to be July 13, 2026." → the Add-task date picker floors `minimumDate` to today.
2. **No way to just record done work.** "Sometimes I do things that aren't 'Routine Maintenance' and there's no way to just add whatever you're doing just to have it recorded to look back on." → "Add task" only creates a *future pending* task; a backdated pending task shows as **overdue** and nags. The one "log completed service" screen (`record-maintenance.tsx`) is **orphaned/unreachable** and forces a fixed service-type list.
3. **Units not unified (priority).** Preference set to miles, but the Add-task mileage field hardcodes "km". User: "Whatever you choose in settings should carry over to the entire app."

## Verified facts

- Global preference `measurementSystem` ('metric'|'imperial') on `users`; device store in `auth.store.ts`; canonical hooks `useMileageUnit()` / `useMeasurementSystem()`.
- **Storage contract:** `target_mileage` & `completed_mileage` & `motorcycles.current_mileage` are stored **raw in the user's display unit** (no conversion). `interval_km` is **genuinely kilometers** (OEM canonical). Conversion helpers exist: `packages/types/src/units.ts` (`milesToKm`/`kmToMiles`, `KM_PER_MILE=1.609344`) and `apps/mobile/src/utils/maintenance-interval.ts` (`convertIntervalDistance`, `intervalDistanceUnit`).
- No backend date validation — backdating works once the client floor is removed.
- No task-type/category enum exists; free-form title already works. Columns `status`, `completed_at`, `completed_mileage` already exist (migration 00020) → **no DB migration needed**.
- `record-maintenance.tsx` has **no navigation entry point** (dead). Decision: do NOT revive it; solve on `add-maintenance-task.tsx` where users actually go.

## Scope (this PR)

### Goal A — Units unification (mobile, priority, low risk)
1. `add-maintenance-task.tsx`
   - Import `useMileageUnit`, `useMeasurementSystem`, `convertIntervalDistance`, `intervalDistanceUnit`, `milesToKm`.
   - Target-mileage suffix (line ~491): `{t('maintenance.km')}` → `{mileageUnit}`. Write path stays **raw** `parseInt` (line 60) — correct.
   - Recurring interval: display value converted `km→user unit`; suffix (line ~629) → `{intervalUnit}`; **on save convert user→km**: `system==='imperial' ? Math.round(milesToKm(n)) : n` for `intervalKm` (line 64).
2. `edit-maintenance-task.tsx`: import `useMileageUnit`; suffix (line ~511) → `{mileageUnit}`. Target write stays raw.
3. `hud-sparkline.tsx` (line 29-30): replace hardcoded `km/h`/`m` with system-aware `formatSpeedValue`/`speedUnitLabel` + `formatElevationValue`/`elevationUnitLabel`; thread `system` from caller `hud-layout-a.tsx`.
4. `trip-detail-sheet.tsx:242`: **defer** — component is unwired demo w/ mock data; converting label w/o value would mislead. Note in PR.
5. Leave pre-existing odometer-normalization drift (`createNextRecurrence` mixing mi+km, `carplay-bike-status.ts`) OUT — flag as follow-up.

### Goal B — Backdating (mobile, 2 lines)
- `add-maintenance-task.tsx`: remove `minimumDate={new Date()}` floor (line ~385) and the value-clamp `dueDate >= new Date() ? … : new Date()` (line ~382) → `value={dueDate ?? new Date()}`. Bounds become mode-driven (see Goal C).
- `edit-maintenance-task.tsx`: already no floor — verify only.

### Goal C — "Log done work" mode on `add-maintenance-task.tsx` (UX)
Add a two-segment control (styled like existing priority pills, copper active) at top: **Plan ahead** (default) / **Log done work**. `TASK_MODES = {plan,log} as const`.

| Element | Plan | Log |
|---|---|---|
| Priority pills | show | hide |
| Date label | "Due date" | "Date done" (default = today) |
| Date bounds | min=today, no max | min=`subYears(today,30)`, max=today |
| Mileage label | "Target mileage" | "Odometer" |
| Recurring card | show | hide (force `isRecurring=false`) |
| Details | show | show |
| Save button | "Save task" | "Log it" |
| Header | "New *task.*" | "Log *work.*" |

- Haptic on mode switch; reanimated layout <300ms.
- **Save in Log mode** persists as `status:'completed'` with `completedAt` = chosen date, `completedMileage` = odometer, skipping reminder scheduling. Analytics: `MAINTENANCE_TASK_CREATED` with `mode:'log'`.

### Goal D — Backend: create-as-completed (single atomic call, no migration)
- Add optional `status`, `completedAt` (ISO datetime), `completedMileage` to `CreateMaintenanceTaskInput` (Zod `CreateMaintenanceTaskSchema` + NestJS DTO).
- `maintenance-tasks.service.ts create()`: when `status==='completed'`, insert `status`, `completed_at` (input or now), `completed_mileage`. No recurrence side-effects (Log mode forces non-recurring, no cost → no expense trigger).
- Mobile mutation doc unchanged (`$input` passthrough). Run `pnpm generate`.

### i18n
New `maintenance.*` keys (modePlan, modeLog, logPrefix, logSuffix, dateDone, odometer, targetMileage, logWork, workLogged) added to all 13 locales with English fallback (ratchet: `check-i18n-new-keys.ts`).

## Tests
- `maintenance-interval` unit test: `convertIntervalDistance(10000,'imperial')≈6214`, metric passthrough; write-path round-trip `Math.round(milesToKm(6214))≈9999` (±1 documented).
- API `maintenance-tasks.service.spec.ts`: `create()` with `status:'completed'` sets `completed_at` from input, falls back to now when absent.
- Existing `ride-formatters.test.ts` covers hud-sparkline helpers.

## Commit order
1. Goal B (2-line clamp removal, zero-risk).
2. Goal A (unit labels + interval conversion + hud-sparkline + interval test).
3. Goal D backend (Zod→DTO→service→`pnpm generate`+spec).
4. Goal C (Log mode UI wiring to create-as-completed) + i18n keys.

## Out of scope (flagged)
Reviving/deleting `record-maintenance.tsx`; odometer km-normalization migration; `trip-detail-sheet` demo; cost field in Log mode; backdating completion of existing tasks in `complete-task.tsx`; apps/web km hardcodes (other session owns web).
