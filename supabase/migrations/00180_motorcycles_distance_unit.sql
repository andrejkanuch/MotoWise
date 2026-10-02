-- Migration: 00180_motorcycles_distance_unit
-- Bike-detail redesign R1 (spec §3, lead decision D1).
--
-- Adds motorcycles.distance_unit ('km' | 'mi'): the unit the bike's odometer and
-- distance intervals are shown in.
--
-- LABEL ONLY — NOTHING IS CONVERTED. motorcycles.current_mileage,
-- maintenance_tasks.target_mileage / completed_mileage and user-entered
-- interval_km are stored RAW in the rider's unit (PR #164 contract). This
-- migration only records which unit that is. It never multiplies or divides a
-- stored value; a km-normalising backfill here would ship a 1.61x bug.
--
-- BACKFILL SOURCE
-- The owner's CURRENT users.measurement_system, not motorcycles.mileage_unit.
-- mileage_unit (00005, DEFAULT 'mi') is deprecated and unreliable: it was never
-- kept in step with the profile toggle, so most metric riders carry 'mi' there.
-- It is left untouched and dropped in R6. Soft-deleted bikes are backfilled too.
--
-- INSERT PATHS
-- Two code paths insert motorcycles: motorcycles.service.create and the
-- complete_onboarding RPC. Neither passes distance_unit. A BEFORE INSERT trigger
-- fills it from the owner's measurement_system, which covers both without
-- re-creating that RPC.
--
-- INTERIM SYNC (remove in R5)
-- Until R5 ships the Edit-bike unit control and R6 moves the remaining screens
-- off the profile unit, four API conversion sites (rides, oem-schedules,
-- maintenance-tasks, receipt-scan) and ~10 mobile screens still read
-- users.measurement_system. If a bike's unit could differ from its owner's
-- profile unit in that window, a ride would add miles to a km bike. So a trigger
-- on users keeps every bike's distance_unit equal to the profile unit: today's
-- behaviour exactly (one global, label-only toggle).
--
-- COLUMN-LEVEL GRANTS ON motorcycles — FINDING
-- A comment in motorcycles.service.ts (checkRecalls) says the recall_* columns
-- sit outside the user UPDATE grants. No migration in supabase/migrations/
-- issues a column-level GRANT or a table-level REVOKE on public.motorcycles
-- (grep for GRANT/REVOKE ... motorcycles: no hit), so per the migration folder
-- authenticated holds table-level privileges and a new column needs no grant.
-- Checked with `\dp public.motorcycles` on a local replay of 00001-00179: no
-- column privileges, authenticated holds table-level arwdDxtm. Nothing to add.
-- That replay is not production, and production has drifted from this folder
-- before (00141 was recorded as applied and was not; see 00178). So before
-- pushing, confirm on production that this returns a row:
--   SELECT 1 FROM information_schema.table_privileges
--   WHERE table_schema = 'public' AND table_name = 'motorcycles'
--     AND grantee = 'authenticated' AND privilege_type = 'SELECT';
-- If it does not (column-level grants only), add
--   GRANT SELECT (distance_unit) ON public.motorcycles TO authenticated;
-- or myMotorcycles fails with 42501 for every rider. No UPDATE grant in R1
-- either way: the column is written only by the two triggers below.
--
-- DEPLOY ORDER: apply BEFORE the API that selects distance_unit. Render
-- auto-deploys apps/api on merge to main; MOTORCYCLE_SELECT is used by
-- myMotorcycles for every rider, so an API ahead of this migration breaks the
-- garage for everyone.

BEGIN;

ALTER TABLE public.motorcycles ADD COLUMN distance_unit text;

UPDATE public.motorcycles m
SET distance_unit = CASE WHEN u.measurement_system = 'imperial' THEN 'mi' ELSE 'km' END
FROM public.users u
WHERE u.id = m.user_id;

-- Orphans (no users row). The FK makes these impossible today; kept so SET NOT
-- NULL below can never fail the migration.
UPDATE public.motorcycles SET distance_unit = 'km' WHERE distance_unit IS NULL;

ALTER TABLE public.motorcycles
  ALTER COLUMN distance_unit SET NOT NULL,
  ADD CONSTRAINT chk_motorcycles_distance_unit CHECK (distance_unit IN ('km', 'mi'));

COMMENT ON COLUMN public.motorcycles.distance_unit IS
  'Unit of this bike''s odometer and distance intervals: km or mi. Label only; current_mileage, target_mileage, completed_mileage and user interval_km are raw values in this unit. Never convert stored values when it changes.';

-- New bikes take the owner's profile unit. SECURITY DEFINER because
-- users.measurement_system sits behind column grants (00141/00178) and the
-- insert may come from any role; it only ever reads the inserting row's owner.
CREATE FUNCTION public.motorcycles_default_distance_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.distance_unit IS NULL THEN
    NEW.distance_unit := COALESCE(
      (
        SELECT CASE WHEN u.measurement_system = 'imperial' THEN 'mi' ELSE 'km' END
        FROM public.users u
        WHERE u.id = NEW.user_id
      ),
      'km'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger-only: nobody calls it directly. Naming anon and authenticated is what
-- removes Supabase's default-privilege grants (see 00176).
REVOKE EXECUTE ON FUNCTION public.motorcycles_default_distance_unit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_motorcycles_default_distance_unit
  BEFORE INSERT ON public.motorcycles
  FOR EACH ROW EXECUTE FUNCTION public.motorcycles_default_distance_unit();

-- INTERIM (bike-detail redesign R1): drop in the R5 migration that adds the Edit-bike unit control.
-- SECURITY DEFINER so soft-deleted bikes are kept in step too (the caller's
-- UPDATE policy on motorcycles hides them).
CREATE FUNCTION public.sync_motorcycles_distance_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit text := CASE WHEN NEW.measurement_system = 'imperial' THEN 'mi' ELSE 'km' END;
BEGIN
  UPDATE public.motorcycles
  SET distance_unit = v_unit
  WHERE user_id = NEW.id
    AND distance_unit IS DISTINCT FROM v_unit;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_motorcycles_distance_unit() FROM PUBLIC, anon, authenticated;

-- INTERIM (bike-detail redesign R1): drop in the R5 migration that adds the Edit-bike unit control.
CREATE TRIGGER trg_users_sync_distance_unit
  AFTER UPDATE OF measurement_system ON public.users
  FOR EACH ROW
  WHEN (NEW.measurement_system IS DISTINCT FROM OLD.measurement_system)
  EXECUTE FUNCTION public.sync_motorcycles_distance_unit();

COMMIT;
