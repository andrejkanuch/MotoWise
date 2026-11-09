-- Repeatable check for the rider insights schema
-- (migrations/00197_rider_insights_schema.sql).
--
-- Proves on a real database what the API specs (mocked Supabase clients) cannot:
--   * anon and authenticated can neither read the derived and reference tables
--     nor execute purge_soft_deleted_rides; anon cannot execute the two new
--     rider RPCs (ride_track_points, log_ride_end_odometer);
--   * ride_track_points returns nothing for another rider's ride, and on a
--     4,000-point ride with p_max_points = 1000 returns 1,000 evenly spaced
--     points including the first and the last;
--   * a rider cannot set their own users.is_synthetic;
--   * log_ride_end_odometer writes exactly one odometer reading per ride end
--     (the mileage trigger adds none), converts to the bike's unit, and rejects
--     another rider's ride;
--   * log_odometer_reading keeps its single signature and its behaviour;
--   * the purge removes ride_stats and ride_tracks of a ride soft-deleted
--     31 days ago and keeps those of a ride deleted yesterday;
--   * rides.end_source accepts only the known end paths.
--
-- Everything runs in ONE transaction that ends in ROLLBACK, and the file uses no
-- psql meta-commands. It is written for the disposable container and for a local
-- Supabase stack with the migrations applied:
--
--   * disposable container (fixture + 00048, 00181, 00197, then this file):
--       supabase/checks/run.sh rider-insights-schema.sql
--   * local Supabase stack:
--       psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--         -v ON_ERROR_STOP=1 -f supabase/checks/rider-insights-schema.sql
--
-- Production is verified with the read-only footer queries of 00197 instead: this
-- check runs the purge, which on production would scan every soft-deleted ride.
--
-- A failed assertion raises, which aborts the transaction (nothing is kept) and
-- surfaces as the error. Success returns no rows and no error.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ride_stats') IS NULL THEN
    RAISE EXCEPTION 'public.ride_stats does not exist: apply 00197 first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Catalog: grants and RLS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  who TEXT;
  priv TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['public.ride_stats', 'public.ride_tracks', 'public.ref_country_parts',
                             'public.ref_regions', 'public.ref_places'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = tbl::regclass) THEN
      RAISE EXCEPTION 'FAIL: RLS is not enabled on %', tbl;
    END IF;
    FOREACH who IN ARRAY ARRAY['public', 'anon', 'authenticated'] LOOP
      FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(who, tbl, priv) THEN
          RAISE EXCEPTION 'FAIL: % has % on %', who, priv, tbl;
        END IF;
      END LOOP;
    END LOOP;
    IF NOT has_table_privilege('service_role', tbl, 'SELECT') THEN
      RAISE EXCEPTION 'FAIL: service_role lacks SELECT on %', tbl;
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY ARRAY['public.ride_stats', 'public.ride_tracks'] LOOP
    FOREACH priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
      IF NOT has_table_privilege('service_role', tbl, priv) THEN
        RAISE EXCEPTION 'FAIL: service_role lacks % on %', priv, tbl;
      END IF;
    END LOOP;
  END LOOP;

  -- Rider RPCs: authenticated only (service_role also reads track points).
  FOREACH who IN ARRAY ARRAY['public', 'anon'] LOOP
    IF has_function_privilege(who, 'public.ride_track_points(uuid, integer)', 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: % can execute ride_track_points', who;
    END IF;
    IF has_function_privilege(who, 'public.log_ride_end_odometer(uuid, integer, text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: % can execute log_ride_end_odometer', who;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('authenticated', 'public.ride_track_points(uuid, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot execute ride_track_points';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.log_ride_end_odometer(uuid, integer, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot execute log_ride_end_odometer';
  END IF;
  IF has_function_privilege('service_role', 'public.log_ride_end_odometer(uuid, integer, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role can execute log_ride_end_odometer (it must run as the rider)';
  END IF;

  -- The purge keeps the service-role-only ACL 00196 set.
  FOREACH who IN ARRAY ARRAY['public', 'anon', 'authenticated'] LOOP
    IF has_function_privilege(who, 'public.purge_soft_deleted_rides()', 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: % can execute purge_soft_deleted_rides', who;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', 'public.purge_soft_deleted_rides()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role cannot execute purge_soft_deleted_rides';
  END IF;

  -- log_odometer_reading is untouched: still exactly one signature, still the rider's.
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'log_odometer_reading') <> 1 THEN
    RAISE EXCEPTION 'FAIL: log_odometer_reading has an overload';
  END IF;
  IF to_regprocedure('public.log_odometer_reading(uuid, integer, timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'FAIL: log_odometer_reading(uuid, integer, timestamptz) is gone';
  END IF;
  IF has_function_privilege('anon', 'public.log_odometer_reading(uuid, integer, timestamptz)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.log_odometer_reading(uuid, integer, timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: log_odometer_reading ACL changed';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Fixtures, as the connecting (admin) role. Fresh random ids travel to the
-- role-switched blocks through transaction-local settings.
-- ---------------------------------------------------------------------------
SELECT
  set_config('ri_check.user_a', gen_random_uuid()::text, true),
  set_config('ri_check.user_b', gen_random_uuid()::text, true),
  set_config('ri_check.bike_a', gen_random_uuid()::text, true),
  set_config('ri_check.bike_a_mi', gen_random_uuid()::text, true),
  set_config('ri_check.bike_b', gen_random_uuid()::text, true),
  set_config('ri_check.ride_long', gen_random_uuid()::text, true),
  set_config('ri_check.ride_odo', gen_random_uuid()::text, true),
  set_config('ri_check.ride_odo_mi', gen_random_uuid()::text, true),
  set_config('ri_check.ride_b', gen_random_uuid()::text, true),
  set_config('ri_check.ride_purged', gen_random_uuid()::text, true),
  set_config('ri_check.ride_recent', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email)
VALUES
  (current_setting('ri_check.user_a')::uuid, 'ri-check-a-' || current_setting('ri_check.user_a') || '@example.invalid'),
  (current_setting('ri_check.user_b')::uuid, 'ri-check-b-' || current_setting('ri_check.user_b') || '@example.invalid');

INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users
WHERE id IN (current_setting('ri_check.user_a')::uuid, current_setting('ri_check.user_b')::uuid);

INSERT INTO public.motorcycles (id, user_id, make, model, current_mileage, distance_unit)
VALUES
  (current_setting('ri_check.bike_a')::uuid, current_setting('ri_check.user_a')::uuid, 'Honda', 'Africa Twin', 10000, 'km'),
  (current_setting('ri_check.bike_a_mi')::uuid, current_setting('ri_check.user_a')::uuid, 'Harley-Davidson', 'Street Glide', 5000, 'mi'),
  (current_setting('ri_check.bike_b')::uuid, current_setting('ri_check.user_b')::uuid, 'BMW', 'R 1250 GS', 20000, 'km');

-- The bikes' 'initial' readings (00181 trigger) are stamped now(); date them
-- before the rides so a ride-end reading is the latest one, as in real use.
UPDATE public.odometer_readings SET recorded_at = now() - interval '60 days'
WHERE motorcycle_id IN (current_setting('ri_check.bike_a')::uuid, current_setting('ri_check.bike_a_mi')::uuid,
                        current_setting('ri_check.bike_b')::uuid);

INSERT INTO public.rides (id, user_id, motorcycle_id, status, started_at, ended_at, distance_m, route_polyline, deleted_at)
VALUES
  (current_setting('ri_check.ride_long')::uuid, current_setting('ri_check.user_a')::uuid,
   current_setting('ri_check.bike_a')::uuid, 'completed',
   '2026-06-01 08:00:00+00', '2026-06-01 09:06:40+00', 40000, NULL, NULL),
  (current_setting('ri_check.ride_odo')::uuid, current_setting('ri_check.user_a')::uuid,
   current_setting('ri_check.bike_a')::uuid, 'completed',
   now() - interval '2 hours', now() - interval '1 hour', 30000, NULL, NULL),
  (current_setting('ri_check.ride_odo_mi')::uuid, current_setting('ri_check.user_a')::uuid,
   current_setting('ri_check.bike_a_mi')::uuid, 'completed',
   now() - interval '2 hours', now() - interval '1 hour', 30000, NULL, NULL),
  (current_setting('ri_check.ride_b')::uuid, current_setting('ri_check.user_b')::uuid,
   current_setting('ri_check.bike_b')::uuid, 'completed',
   now() - interval '3 hours', now() - interval '2 hours', 30000, NULL, NULL),
  (current_setting('ri_check.ride_purged')::uuid, current_setting('ri_check.user_a')::uuid,
   current_setting('ri_check.bike_a')::uuid, 'completed',
   now() - interval '40 days', now() - interval '40 days' + interval '1 hour', 30000, 'encoded', now() - interval '31 days'),
  (current_setting('ri_check.ride_recent')::uuid, current_setting('ri_check.user_a')::uuid,
   current_setting('ri_check.bike_a')::uuid, 'completed',
   now() - interval '5 days', now() - interval '5 days' + interval '1 hour', 30000, 'encoded', now() - interval '1 day');

-- 4,000 fixes, one per second: fix i is at started_at + i seconds.
INSERT INTO public.ride_waypoints (ride_id, recorded_at, latitude, longitude, altitude, speed_mps, heading, accuracy)
SELECT current_setting('ri_check.ride_long')::uuid,
       '2026-06-01 08:00:00+00'::timestamptz + make_interval(secs => i),
       48.1 + i * 0.0001, 17.1 + i * 0.0001, 150, 20, 90, 5
FROM generate_series(0, 3999) i;

INSERT INTO public.ride_waypoints (ride_id, recorded_at, latitude, longitude)
SELECT r, now() - interval '30 days' - make_interval(secs => i), 48.1, 17.1
FROM unnest(ARRAY[current_setting('ri_check.ride_purged')::uuid, current_setting('ri_check.ride_recent')::uuid]) r,
     generate_series(1, 3) i;

INSERT INTO public.ride_stats (ride_id, user_id, stats_version, input_source, time_zone, local_date,
                               local_start_hour, local_dow, distance_m, elapsed_s)
SELECT r.id, r.user_id, 1, 'polyline', 'Europe/Bratislava', r.started_at::date, 8, 1, r.distance_m, 3600
FROM public.rides r
WHERE r.id IN (current_setting('ri_check.ride_purged')::uuid, current_setting('ri_check.ride_recent')::uuid);

INSERT INTO public.ride_tracks (ride_id, user_id, source, route, stats_version)
SELECT r.id, r.user_id, 'polyline', ST_GeomFromText('LINESTRING(17.1 48.1, 17.2 48.2)', 4326), 1
FROM public.rides r
WHERE r.id IN (current_setting('ri_check.ride_purged')::uuid, current_setting('ri_check.ride_recent')::uuid);

-- ---------------------------------------------------------------------------
-- rides.end_source accepts the known end paths and nothing else.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  src TEXT;
BEGIN
  FOREACH src IN ARRAY ARRAY['rider_phone', 'rider_carplay', 'client_auto', 'server_idle',
                             'stale_on_start', 'new_ride_save'] LOOP
    UPDATE public.rides SET end_source = src WHERE id = current_setting('ri_check.ride_b')::uuid;
  END LOOP;
  BEGIN
    UPDATE public.rides SET end_source = 'rider' WHERE id = current_setting('ri_check.ride_b')::uuid;
    RAISE EXCEPTION 'FAIL: end_source accepted an unknown value';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- As rider A.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('ri_check.user_a'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  user_a CONSTANT uuid := current_setting('ri_check.user_a')::uuid;
  bike_a CONSTANT uuid := current_setting('ri_check.bike_a')::uuid;
  bike_a_mi CONSTANT uuid := current_setting('ri_check.bike_a_mi')::uuid;
  ride_long CONSTANT uuid := current_setting('ri_check.ride_long')::uuid;
  ride_odo CONSTANT uuid := current_setting('ri_check.ride_odo')::uuid;
  ride_odo_mi CONSTANT uuid := current_setting('ri_check.ride_odo_mi')::uuid;
  ride_b CONSTANT uuid := current_setting('ri_check.ride_b')::uuid;
  t0 CONSTANT timestamptz := '2026-06-01 08:00:00+00';
  v_total INTEGER;
  v_times timestamptz[];
  v_lat double precision[];
  v_idx INTEGER[];
  v_gap_min INTEGER;
  v_gap_max INTEGER;
  v_rows INTEGER;
  v_before INTEGER;
  v_after INTEGER;
  v_id uuid;
  v_id_again uuid;
  v_mileage INTEGER;
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'FAIL: expected to run as authenticated, running as %', current_user;
  END IF;

  -- 1. No direct reads of derived or reference data.
  BEGIN
    PERFORM 1 FROM public.ride_stats;
    RAISE EXCEPTION 'FAIL: authenticated can SELECT ride_stats';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.ride_tracks;
    RAISE EXCEPTION 'FAIL: authenticated can SELECT ride_tracks';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.ref_places;
    RAISE EXCEPTION 'FAIL: authenticated can SELECT ref_places';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.purge_soft_deleted_rides();
    RAISE EXCEPTION 'FAIL: authenticated can run purge_soft_deleted_rides';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 2. ride_track_points: 4,000 fixes capped at 1,000.
  SELECT t.total_points, t.recorded_at, t.latitude INTO v_total, v_times, v_lat
  FROM public.ride_track_points(ride_long, 1000) t;
  IF v_total IS DISTINCT FROM 4000 THEN
    RAISE EXCEPTION 'FAIL: ride_track_points total_points = %, expected 4000', v_total;
  END IF;
  IF cardinality(v_times) <> 1000 OR cardinality(v_lat) <> 1000 THEN
    RAISE EXCEPTION 'FAIL: ride_track_points returned % points, expected 1000', cardinality(v_times);
  END IF;
  -- Fix i sits at t0 + i seconds, so the offset is the fix index.
  SELECT array_agg(extract(epoch FROM (ts - t0))::int ORDER BY ord) INTO v_idx
  FROM unnest(v_times) WITH ORDINALITY u(ts, ord);
  IF v_idx[1] <> 0 OR v_idx[1000] <> 3999 THEN
    RAISE EXCEPTION 'FAIL: first/last point not kept (got index % and %)', v_idx[1], v_idx[1000];
  END IF;
  SELECT min(v_idx[k + 1] - v_idx[k]), max(v_idx[k + 1] - v_idx[k]) INTO v_gap_min, v_gap_max
  FROM generate_series(1, 999) k;
  -- 3,999 intervals over 999 steps: every gap is 4 or 5 fixes.
  IF v_gap_min < 4 OR v_gap_max > 5 THEN
    RAISE EXCEPTION 'FAIL: points not evenly spaced (gaps % to %)', v_gap_min, v_gap_max;
  END IF;
  IF v_lat[1000] <> 48.1 + 3999 * 0.0001 THEN
    RAISE EXCEPTION 'FAIL: latitude array does not follow recorded_at order';
  END IF;

  -- 3. No cap, or a cap above the ride's size: the whole ride.
  SELECT cardinality(t.recorded_at) INTO v_rows FROM public.ride_track_points(ride_long, NULL) t;
  IF v_rows IS DISTINCT FROM 4000 THEN
    RAISE EXCEPTION 'FAIL: ride_track_points without a cap returned % points', v_rows;
  END IF;
  SELECT cardinality(t.recorded_at) INTO v_rows FROM public.ride_track_points(ride_long, 5000) t;
  IF v_rows IS DISTINCT FROM 4000 THEN
    RAISE EXCEPTION 'FAIL: ride_track_points with cap 5000 returned % points', v_rows;
  END IF;

  -- 4. Someone else's ride: nothing at all.
  SELECT count(*) INTO v_rows FROM public.ride_track_points(ride_b, 1000);
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'FAIL: ride_track_points returned % rows for another rider''s ride', v_rows;
  END IF;

  -- 5. is_synthetic is not the rider's to change.
  BEGIN
    UPDATE public.users SET is_synthetic = true WHERE id = user_a;
    RAISE EXCEPTION 'FAIL: rider updated their own is_synthetic';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 6. log_ride_end_odometer: exactly one reading per ride end.
  SELECT count(*) INTO v_before FROM public.odometer_readings WHERE motorcycle_id = bike_a;
  v_id := public.log_ride_end_odometer(ride_odo, 12345, 'km');
  SELECT count(*) INTO v_after FROM public.odometer_readings WHERE motorcycle_id = bike_a;
  IF v_after - v_before <> 1 THEN
    RAISE EXCEPTION 'FAIL: log_ride_end_odometer wrote % readings, expected 1', v_after - v_before;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.odometer_readings
    WHERE id = v_id AND source = 'ride_end' AND ride_id = ride_odo AND value = 12345 AND user_id = user_a
  ) THEN
    RAISE EXCEPTION 'FAIL: ride-end reading has the wrong source, ride, value or owner';
  END IF;
  SELECT current_mileage INTO v_mileage FROM public.motorcycles WHERE id = bike_a;
  IF v_mileage <> 12345 THEN
    RAISE EXCEPTION 'FAIL: ride-end reading did not move the odometer (current_mileage %)', v_mileage;
  END IF;

  -- A replayed end returns the same reading and writes nothing.
  v_id_again := public.log_ride_end_odometer(ride_odo, 12345, 'km');
  SELECT count(*) INTO v_after FROM public.odometer_readings WHERE motorcycle_id = bike_a;
  IF v_id_again <> v_id OR v_after - v_before <> 1 THEN
    RAISE EXCEPTION 'FAIL: a replayed ride end wrote another reading';
  END IF;

  -- A mile-unit bike stores miles: 16,093 km is 10,000 mi.
  v_id := public.log_ride_end_odometer(ride_odo_mi, 16093, 'km');
  IF (SELECT value FROM public.odometer_readings WHERE id = v_id) <> 10000 THEN
    RAISE EXCEPTION 'FAIL: km reading on a mile bike stored as %', (SELECT value FROM public.odometer_readings WHERE id = v_id);
  END IF;

  -- 7. Another rider's ride is rejected and writes nothing.
  SELECT count(*) INTO v_before FROM public.odometer_readings;
  BEGIN
    PERFORM public.log_ride_end_odometer(ride_b, 99999, 'km');
    RAISE EXCEPTION 'FAIL: log_ride_end_odometer accepted another rider''s ride';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  SELECT count(*) INTO v_after FROM public.odometer_readings;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'FAIL: rejected ride end still wrote % readings', v_after - v_before;
  END IF;

  -- 8. log_odometer_reading, current arguments: one manual reading, odometer moved.
  SELECT count(*) INTO v_before FROM public.odometer_readings WHERE motorcycle_id = bike_a;
  v_id := public.log_odometer_reading(bike_a, 13000, now());
  SELECT count(*) INTO v_after FROM public.odometer_readings WHERE motorcycle_id = bike_a;
  IF v_after - v_before <> 1 THEN
    RAISE EXCEPTION 'FAIL: log_odometer_reading wrote % readings, expected 1', v_after - v_before;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.odometer_readings
    WHERE id = v_id AND source = 'manual' AND ride_id IS NULL AND value = 13000
  ) THEN
    RAISE EXCEPTION 'FAIL: log_odometer_reading wrote the wrong reading';
  END IF;
  SELECT current_mileage INTO v_mileage FROM public.motorcycles WHERE id = bike_a;
  IF v_mileage <> 13000 THEN
    RAISE EXCEPTION 'FAIL: log_odometer_reading did not move the odometer (current_mileage %)', v_mileage;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- As anon: nothing.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.ride_stats;
    RAISE EXCEPTION 'FAIL: anon can SELECT ride_stats';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.ride_tracks;
    RAISE EXCEPTION 'FAIL: anon can SELECT ride_tracks';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.ride_track_points(current_setting('ri_check.ride_long')::uuid, 1000);
    RAISE EXCEPTION 'FAIL: anon can execute ride_track_points';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.log_ride_end_odometer(current_setting('ri_check.ride_odo')::uuid, 1, 'km');
    RAISE EXCEPTION 'FAIL: anon can execute log_ride_end_odometer';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- As the admin role again: is_synthetic default, then the purge (as cron runs it).
-- ---------------------------------------------------------------------------
RESET ROLE;

DO $$
DECLARE
  purged CONSTANT uuid := current_setting('ri_check.ride_purged')::uuid;
  recent CONSTANT uuid := current_setting('ri_check.ride_recent')::uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = current_setting('ri_check.user_a')::uuid AND is_synthetic) THEN
    RAISE EXCEPTION 'FAIL: is_synthetic is not false by default (or the rider changed it)';
  END IF;

  PERFORM public.purge_soft_deleted_rides();

  IF EXISTS (SELECT 1 FROM public.ride_stats WHERE ride_id = purged) THEN
    RAISE EXCEPTION 'FAIL: purge kept ride_stats of a ride deleted 31 days ago';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ride_tracks WHERE ride_id = purged) THEN
    RAISE EXCEPTION 'FAIL: purge kept ride_tracks of a ride deleted 31 days ago';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ride_waypoints WHERE ride_id = purged)
     OR (SELECT route_polyline FROM public.rides WHERE id = purged) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: purge no longer removes the raw track of a ride deleted 31 days ago';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ride_stats WHERE ride_id = recent)
     OR NOT EXISTS (SELECT 1 FROM public.ride_tracks WHERE ride_id = recent)
     OR NOT EXISTS (SELECT 1 FROM public.ride_waypoints WHERE ride_id = recent) THEN
    RAISE EXCEPTION 'FAIL: purge removed data of a ride deleted yesterday';
  END IF;

  RAISE NOTICE 'rider insights schema check: all assertions passed';
END $$;

ROLLBACK;
