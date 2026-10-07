-- Migration: 00181_odometer_readings
-- Bike-detail redesign R1 (spec §3 `odometer_readings`).
--
-- An append-only log of odometer values per bike. It is what makes
-- "+1,240 km since Sep 28 · was 38,167" possible, and what R2's "due soon at
-- your pace" will read. Spec column `at` is `recorded_at` here (`at` reads badly
-- in SQL and GraphQL). Values are RAW in the bike's distance_unit (00180).
--
-- TWO WRITERS
--   1. log_odometer_reading() — the new OdometerSheet. Inserts the reading and,
--      unless a later reading already exists, moves motorcycles.current_mileage.
--   2. trg_motorcycles_log_odometer — logs every OTHER change of
--      current_mileage: ride end (rides.service.endRide), receipt-scan apply and
--      revert, and the legacy updateMotorcycle(currentMileage) path that older
--      app builds keep using. Those services are not touched.
--
-- RISK NOTE (read before pushing)
-- The table and the RPC are additive. The trigger is not: from the moment this
-- is applied it runs inside EVERY production write of current_mileage. A trigger
-- that raises would fail ride end and receipt-scan saves. Its whole body is
-- therefore wrapped in BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING: a lost
-- log row is acceptable, a failed ride end is not. It cannot fail the write.
--
-- trg_set_mileage_updated_at (00028) — BEHAVIOUR CHANGE
-- That BEFORE trigger overwrote mileage_updated_at with NOW() whenever
-- current_mileage changed, even when the same UPDATE set mileage_updated_at
-- explicitly. log_odometer_reading() sets it to the reading's (possibly
-- back-dated) recorded_at, which the old body would have discarded. The function
-- is re-created below so an explicitly changed mileage_updated_at wins and
-- NOW() is only the fallback. Existing writers are unaffected in practice: all
-- three (motorcycles.service.update, rides.service.endRide, receipt-scan revert)
-- already pass the API server's "now", so the stamp moves from the database
-- clock to the API clock and nothing else. INSERT behaviour is unchanged.
--
-- WRITE PATH: clients get SELECT only on odometer_readings. Both writers are
-- SECURITY DEFINER, so a rider cannot insert readings with an arbitrary source,
-- ride or date through PostgREST.
--
-- ACL: Supabase's default privileges grant EXECUTE on every new function to
-- anon, authenticated and service_role, so anon is named in each REVOKE (00176).
--
-- DEPLOY ORDER: apply BEFORE the API that calls log_odometer_reading.

BEGIN;

CREATE TABLE public.odometer_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  value integer NOT NULL CHECK (value >= 0),
  recorded_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('manual', 'gps_ride', 'initial', 'backfill')),
  ride_id uuid NULL REFERENCES public.rides(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.odometer_readings IS
  'Append-only odometer log per bike (bike-detail redesign R1). value is raw in motorcycles.distance_unit. No UPDATE/DELETE policy on purpose.';

CREATE INDEX idx_odometer_readings_motorcycle_recorded
  ON public.odometer_readings (motorcycle_id, recorded_at DESC);
CREATE INDEX idx_odometer_readings_user ON public.odometer_readings (user_id);

ALTER TABLE public.odometer_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own odometer readings" ON public.odometer_readings
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- No INSERT/UPDATE/DELETE policy and no write privilege for clients: the only
-- writers are the two SECURITY DEFINER functions below. A direct PostgREST
-- insert could otherwise log any source, any ride_id (even another rider's,
-- since the FK check runs as the table owner) and a far-future recorded_at that
-- would make log_odometer_reading() treat every later entry as history.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.odometer_readings FROM anon, authenticated;

-- Backfill: one row per bike that has an odometer, stamped with when it was
-- last set. Runs before the trigger exists and does not touch motorcycles.
-- current_mileage defaults to 0, so 0 means "never entered": no row.
-- The user guard keeps the migration from failing on a stray row.
INSERT INTO public.odometer_readings (user_id, motorcycle_id, value, recorded_at, source)
SELECT m.user_id, m.id, m.current_mileage, COALESCE(m.mileage_updated_at, m.created_at), 'backfill'
FROM public.motorcycles m
WHERE m.current_mileage > 0
  AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = m.user_id);

-- 00028's function, changed so an explicit mileage_updated_at survives (header).
CREATE OR REPLACE FUNCTION public.set_mileage_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.current_mileage IS NOT NULL AND NEW.current_mileage > 0 THEN
    NEW.mileage_updated_at := NOW();
  ELSIF TG_OP = 'UPDATE'
    AND NEW.current_mileage IS DISTINCT FROM OLD.current_mileage
    AND NEW.mileage_updated_at IS NOT DISTINCT FROM OLD.mileage_updated_at THEN
    NEW.mileage_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER: clients hold no write privilege on odometer_readings (see
-- above), so this function is the rider's only way in. auth.uid() is pinned as
-- the owner and the bike must be the caller's and not deleted; service-role
-- calls (auth.uid() NULL) are refused.
CREATE FUNCTION public.log_odometer_reading(
  p_motorcycle_id uuid,
  p_value integer,
  p_recorded_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_recorded_at timestamptz := COALESCE(p_recorded_at, now());
  v_reading_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- 5 minutes of tolerance for client clocks running ahead.
  IF v_recorded_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'recorded_at_in_future' USING ERRCODE = '22023';
  END IF;
  -- Within the tolerance, a fast clock counts as "now": otherwise a correction
  -- sent a minute later (stamped with the server's now) would rank as older and
  -- silently not move the odometer.
  v_recorded_at := LEAST(v_recorded_at, now());

  IF p_value IS NULL OR p_value < 0 THEN
    RAISE EXCEPTION 'invalid_value' USING ERRCODE = '22023';
  END IF;

  -- Row lock: two concurrent readings for one bike (double tap, two devices,
  -- a ride ending) are serialised, so the "later reading exists" check below
  -- sees the other's row and the newest recorded_at wins, not the last commit.
  PERFORM 1 FROM public.motorcycles m
  WHERE m.id = p_motorcycle_id AND m.user_id = v_uid AND m.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'motorcycle_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.odometer_readings (user_id, motorcycle_id, value, recorded_at, source)
  VALUES (v_uid, p_motorcycle_id, p_value, v_recorded_at, 'manual')
  RETURNING id INTO v_reading_id;

  -- A back-dated reading older than the latest one is history: it is logged but
  -- does not move the bike's current odometer.
  IF NOT EXISTS (
    SELECT 1 FROM public.odometer_readings r
    WHERE r.motorcycle_id = p_motorcycle_id
      AND r.recorded_at > v_recorded_at
  ) THEN
    -- Tells trg_motorcycles_log_odometer this write is already logged.
    -- Transaction-local, and cleared again straight after the UPDATE.
    PERFORM set_config('app.odometer_logged', '1', true);

    UPDATE public.motorcycles
    SET current_mileage = p_value,
        mileage_updated_at = v_recorded_at,
        odometer_sync_source = 'manual',
        odometer_last_ride_id = NULL
    WHERE id = p_motorcycle_id AND user_id = v_uid;

    PERFORM set_config('app.odometer_logged', '', true);
  END IF;

  RETURN v_reading_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_odometer_reading(uuid, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_odometer_reading(uuid, integer, timestamptz) TO authenticated;

-- SECURITY DEFINER: the receipt-scan revert and any service-role write must be
-- logged too, and the row is inserted for NEW.user_id, not for the caller.
CREATE FUNCTION public.log_motorcycle_odometer_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source text;
  v_ride_id uuid;
BEGIN
  -- Everything sits inside the handler: nothing here may fail the odometer write.
  BEGIN
    IF current_setting('app.odometer_logged', true) = '1' THEN
      RETURN NULL;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.current_mileage IS NOT DISTINCT FROM OLD.current_mileage THEN
      RETURN NULL;
    END IF;

    -- A bike created without an odometer carries the column default 0. Logging
    -- that as a reading dated "now" would make every back-dated first entry look
    -- older than the latest reading, and log_odometer_reading() would then
    -- refuse to move the bike. Same rule as set_mileage_updated_at (00028).
    IF TG_OP = 'INSERT' AND NEW.current_mileage = 0 THEN
      RETURN NULL;
    END IF;

    -- A reading is GPS only when THIS update set a new ride (rides.service.endRide
    -- writes gps_ride + the ride id). Any other write that leaves those columns
    -- as they were (complete_onboarding, legacy updateMotorcycle) is manual, not
    -- a stale copy of the last ride.
    IF TG_OP = 'INSERT' THEN
      v_source := 'initial';
    ELSIF NEW.odometer_sync_source = 'gps_ride'
      AND NEW.odometer_last_ride_id IS NOT NULL
      AND NEW.odometer_last_ride_id IS DISTINCT FROM OLD.odometer_last_ride_id THEN
      v_source := 'gps_ride';
      v_ride_id := NEW.odometer_last_ride_id;
    ELSE
      v_source := 'manual';
    END IF;

    INSERT INTO public.odometer_readings (user_id, motorcycle_id, value, recorded_at, source, ride_id)
    VALUES (NEW.user_id, NEW.id, NEW.current_mileage, now(), v_source, v_ride_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'log_motorcycle_odometer_change: reading not logged for motorcycle %: % (%)',
      NEW.id, SQLERRM, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_motorcycle_odometer_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_motorcycles_log_odometer
  AFTER INSERT OR UPDATE OF current_mileage ON public.motorcycles
  FOR EACH ROW
  WHEN (NEW.current_mileage IS NOT NULL)
  EXECUTE FUNCTION public.log_motorcycle_odometer_change();

COMMIT;
