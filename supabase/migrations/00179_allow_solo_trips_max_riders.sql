-- Migration: 00179_allow_solo_trips_max_riders
--
-- Bug: creating a solo trip (maxRiders = 1) failed with a 500.
-- `CreateTripInputSchema` / `CreateTripWithWaypointsInputSchema` /
-- `UpdateTripInputSchema` all accept `maxRiders` >= 1 — deliberately, so riders
-- can plan a trip for themselves (see the comment at
-- packages/types/src/validators/trip.ts and apps/mobile/src/utils/
-- trip-completeness.ts, which treats maxRiders <= 1 as a complete trip). The
-- table kept the original 00072 floor of 2, so every solo trip passed Zod
-- validation and was then refused by Postgres:
--
--   new row for relation "trips" violates check constraint
--   "trips_max_riders_check" (23514)
--
-- (Sentry MOTO-VAULT-NODE-NESTJS-K / MOTO-VAULT-REACT-NATIVE-3D, 2026-09-19.)
-- A half-applied fix: the MOTO-VAULT-REACT-NATIVE-1J remediation relaxed the Zod
-- floor from 2 to 1 and never shipped the matching migration, converting a 400
-- into a 500 on the same rider journey.
--
-- Semantics at max_riders = 1: createTripWithWaypoints auto-enrols the organiser,
-- so participant_count reaches 1 and `participant_count >= max_riders` marks the
-- trip full — nobody else can join. That is what a solo trip means.
--
-- public.group_rides carries the same 2..50 CHECK (00066) and is NOT changed: its
-- validator (packages/types/src/validators/group-ride.ts) is min(2), so the two
-- sides already agree. A group ride with one rider is not a group ride.
--
-- Pre-flight on prod: 671 rows, min(max_riders)=2, max=50, 0 rows outside [1,50].
-- The new bound is a superset of the old one, so validation cannot fail.
--
-- ROLLBACK:
--   ALTER TABLE public.trips DROP CONSTRAINT trips_max_riders_check;
--   ALTER TABLE public.trips ADD CONSTRAINT trips_max_riders_check
--     CHECK (max_riders BETWEEN 2 AND 50);
--   -- (safe only while no row has max_riders = 1)

BEGIN;

-- DROP + ADD inside one transaction leaves no window in which the table is
-- unconstrained. Both statements take ACCESS EXCLUSIVE on public.trips; ADD
-- CONSTRAINT validates by scanning the table, which is sub-millisecond at 671
-- rows, so the NOT VALID / VALIDATE CONSTRAINT two-step is unnecessary here.
-- IF EXISTS keeps the migration re-runnable.
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_max_riders_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_max_riders_check CHECK (max_riders BETWEEN 1 AND 50);

COMMIT;
