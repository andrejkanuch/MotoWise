# P1.3 — `period_of_day` on trip waypoints

**Branch:** `feat/impeccable-discover-redesign`
**Date:** 2026-04-16
**Source:** Postnikova §Sprint 2 (p.71)

## Why
Riders plan mentally as *morning twisties → lunch → afternoon pass → evening hotel*, not a flat list of stops. Today the planner only groups by `day_index`.

## Schema
Migration `00105_trip_waypoint_period_of_day.sql`:

```sql
ALTER TABLE public.trip_waypoints
  ADD COLUMN period_of_day TEXT
  CHECK (period_of_day IS NULL OR period_of_day IN ('morning','afternoon','evening'));

CREATE INDEX idx_trip_waypoints_trip_day_period_sort
  ON public.trip_waypoints (trip_id, day_index, period_of_day NULLS FIRST, sort_order);
```

Nullable on purpose — unset = "no period bucket" and still renders, so the migration is 100% backward compatible.

## Types + API
- `packages/types/src/validators/trip.ts` — add `PeriodOfDaySchema`, extend `InlineWaypointSchema`, `CreateWaypointInputSchema`, `UpdateWaypointInputSchema`, `SharedTripWaypointSchema` with optional `periodOfDay` (API snake_case).
- `apps/api` models/inputs — mirror the new field (camelCase).
- Service `mapRowToWaypoint` reads `row.period_of_day`; insert/update paths write it.

## Client
- `.graphql` queries/mutations request `periodOfDay`.
- Mobile `create-trip.tsx` `LocalWaypoint` carries `periodOfDay?: 'morning' | 'afternoon' | 'evening' | null`. New waypoints default to the same period as the last waypoint in the selected day, else `morning`.
- Each day renders three sub-sections (Morning / Afternoon / Evening). Stops with no period sit under "All day" at top, so old trips keep working without a migration.
- Edit modal gets a 3-button period segmented control.

## Non-goals
- Server-side ordering enforcement between periods — sort_order still wins; period is a label.
- Auto-classification from departure time — out of scope.

## Risks
- Codegen must pick up the new field on both mobile and web — `pnpm generate` after resolver changes.
