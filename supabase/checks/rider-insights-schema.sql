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
--   * ride_private_details (the rider's time zone, purpose and passenger
--     answer) is owner-only: RLS on, no PUBLIC or anon privilege, authenticated
--     SELECT/INSERT/UPDATE only; the owner reads and upserts their row; another
--     signed-in rider can read the owner's PUBLIC ride but not its
--     ride_private_details row, and cannot write a row for a ride that is not
--     theirs; anon cannot read it; purpose accepts only the known values;
--   * the purge removes ride_stats, ride_tracks and ride_private_details of a
--     ride soft-deleted 31 days ago and keeps those of a ride deleted yesterday;
--   * rides.end_source accepts only the known end paths;
--   * the three service-role stats helpers (ride_stats_places,
--     ride_stats_stale_rides, ride_stats_stale_count) are executable by
--     service_role only, run as the caller (SECURITY INVOKER, empty search_path);
--   * ride_stats_places, on small synthetic country polygons: reference_ready is
--     false while ref_country_parts is empty; a route 300 m into France from
--     Spain gives only ES at 1 km or more of core; a road zig-zagging along the
--     border stays out of both cores; a crossing route sums the core across
--     subdivided parts and orders countries by first entry; the nearest town
--     within 25 km is returned, and null beyond 25 km;
--   * ride_stats_stale_rides: real riders before synthetic accounts, oldest
--     first; a version bump and a late track update make a row stale; deleted,
--     unfinished and excluded rides never appear; ride_stats_stale_count counts
--     by the same rule with its age cut-off.
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

  -- ride_private_details: the owner's own rows through RLS, nothing for anon.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ride_private_details'::regclass) THEN
    RAISE EXCEPTION 'FAIL: RLS is not enabled on ride_private_details';
  END IF;
  FOREACH who IN ARRAY ARRAY['public', 'anon'] LOOP
    FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege(who, 'public.ride_private_details', priv) THEN
        RAISE EXCEPTION 'FAIL: % has % on ride_private_details', who, priv;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
    IF NOT has_table_privilege('authenticated', 'public.ride_private_details', priv) THEN
      RAISE EXCEPTION 'FAIL: authenticated lacks % on ride_private_details', priv;
    END IF;
  END LOOP;
  FOREACH priv IN ARRAY ARRAY['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
    IF has_table_privilege('authenticated', 'public.ride_private_details', priv) THEN
      RAISE EXCEPTION 'FAIL: authenticated has % on ride_private_details', priv;
    END IF;
  END LOOP;
  FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
    IF NOT has_table_privilege('service_role', 'public.ride_private_details', priv) THEN
      RAISE EXCEPTION 'FAIL: service_role lacks % on ride_private_details', priv;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'ride_private_details'
      AND indexdef LIKE '%(user_id, created_at DESC)%'
  ) THEN
    RAISE EXCEPTION 'FAIL: ride_private_details has no (user_id, created_at DESC) index';
  END IF;
  -- The answers live only in ride_private_details, never on the shared rides row.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rides'
      AND column_name IN ('time_zone', 'purpose', 'passenger')
  ) THEN
    RAISE EXCEPTION 'FAIL: rides carries time_zone, purpose or passenger';
  END IF;

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

  -- Service-role stats helpers: run as the caller, executable by service_role only.
  FOREACH tbl IN ARRAY ARRAY[
    'public.ride_stats_places(text, double precision, double precision, double precision, double precision)',
    'public.ride_stats_stale_rides(smallint, integer, uuid[])',
    'public.ride_stats_stale_count(smallint, timestamptz)'] LOOP
    IF to_regprocedure(tbl) IS NULL THEN
      RAISE EXCEPTION 'FAIL: % does not exist', tbl;
    END IF;
    FOREACH who IN ARRAY ARRAY['public', 'anon', 'authenticated'] LOOP
      IF has_function_privilege(who, tbl, 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL: % can execute %', who, tbl;
      END IF;
    END LOOP;
    IF NOT has_function_privilege('service_role', tbl, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: service_role cannot execute %', tbl;
    END IF;
    IF (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure(tbl)) THEN
      RAISE EXCEPTION 'FAIL: % is SECURITY DEFINER', tbl;
    END IF;
    IF NOT (SELECT 'search_path=""' = ANY (proconfig) FROM pg_proc WHERE oid = to_regprocedure(tbl)) THEN
      RAISE EXCEPTION 'FAIL: % does not pin an empty search_path', tbl;
    END IF;
  END LOOP;

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
  set_config('ri_check.ride_recent', gen_random_uuid()::text, true),
  set_config('ri_check.ride_pub', gen_random_uuid()::text, true);

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

-- Rider A's public ride: any signed-in rider can read the ride itself.
INSERT INTO public.rides (id, user_id, motorcycle_id, status, started_at, ended_at, distance_m, visibility)
VALUES (current_setting('ri_check.ride_pub')::uuid, current_setting('ri_check.user_a')::uuid,
        current_setting('ri_check.bike_a')::uuid, 'completed',
        now() - interval '4 hours', now() - interval '3 hours', 30000, 'public');

INSERT INTO public.ride_private_details (ride_id, user_id, time_zone, purpose, passenger)
SELECT r.id, r.user_id, 'Europe/Vienna', 'tour', true
FROM public.rides r
WHERE r.id IN (current_setting('ri_check.ride_pub')::uuid, current_setting('ri_check.ride_purged')::uuid,
               current_setting('ri_check.ride_recent')::uuid);

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
  BEGIN
    UPDATE public.ride_private_details SET purpose = 'racing' WHERE ride_id = current_setting('ri_check.ride_pub')::uuid;
    RAISE EXCEPTION 'FAIL: ride_private_details.purpose accepted an unknown value';
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
  BEGIN
    PERFORM public.ride_stats_places('SRID=4326;LINESTRING(0 0,1 1)', 0, 0, 1, 1);
    RAISE EXCEPTION 'FAIL: authenticated can execute ride_stats_places';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.ride_stats_stale_rides(1::smallint, 10, '{}');
    RAISE EXCEPTION 'FAIL: authenticated can execute ride_stats_stale_rides';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ride_stats_stale_count(1::smallint, now());
    RAISE EXCEPTION 'FAIL: authenticated can execute ride_stats_stale_count';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 1b. ride_private_details: the owner reads and upserts their own rows.
  IF NOT EXISTS (
    SELECT 1 FROM public.ride_private_details
    WHERE ride_id = current_setting('ri_check.ride_pub')::uuid
      AND time_zone = 'Europe/Vienna' AND purpose = 'tour' AND passenger
  ) THEN
    RAISE EXCEPTION 'FAIL: the owner cannot read their ride_private_details row';
  END IF;
  INSERT INTO public.ride_private_details (ride_id, user_id, time_zone)
  VALUES (ride_long, user_a, 'Europe/Bratislava')
  ON CONFLICT (ride_id) DO UPDATE SET time_zone = EXCLUDED.time_zone;
  INSERT INTO public.ride_private_details (ride_id, user_id, purpose, passenger)
  VALUES (ride_long, user_a, 'commute', false)
  ON CONFLICT (ride_id) DO UPDATE SET purpose = EXCLUDED.purpose, passenger = EXCLUDED.passenger;
  IF NOT EXISTS (
    SELECT 1 FROM public.ride_private_details
    WHERE ride_id = ride_long AND time_zone = 'Europe/Bratislava' AND purpose = 'commute' AND NOT passenger
  ) THEN
    RAISE EXCEPTION 'FAIL: the owner''s upserts did not merge into one ride_private_details row';
  END IF;
  -- A row for another rider's ride is refused, whoever it names as owner.
  BEGIN
    INSERT INTO public.ride_private_details (ride_id, user_id, purpose) VALUES (ride_b, user_a, 'tour');
    RAISE EXCEPTION 'FAIL: a rider wrote ride_private_details for another rider''s ride';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.ride_private_details (ride_id, user_id, purpose)
    VALUES (ride_b, current_setting('ri_check.user_b')::uuid, 'tour');
    RAISE EXCEPTION 'FAIL: a rider wrote ride_private_details as another rider';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.ride_private_details WHERE ride_id = ride_long;
    RAISE EXCEPTION 'FAIL: authenticated can DELETE ride_private_details';
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
-- As rider B: rider A's public ride is readable, its private details are not.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('ri_check.user_b'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  ride_pub CONSTANT uuid := current_setting('ri_check.ride_pub')::uuid;
  v_rows INTEGER;
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'FAIL: expected to run as authenticated, running as %', current_user;
  END IF;
  -- Precondition: the ride itself is visible to B, so the next assertion is not
  -- passing merely because B sees nothing of A's.
  IF NOT EXISTS (SELECT 1 FROM public.rides WHERE id = ride_pub) THEN
    RAISE EXCEPTION 'FAIL: precondition: rider B cannot read rider A''s public ride';
  END IF;
  SELECT count(*) INTO v_rows FROM public.ride_private_details WHERE ride_id = ride_pub;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'FAIL: rider B read rider A''s ride_private_details on a public ride';
  END IF;
  SELECT count(*) INTO v_rows FROM public.ride_private_details;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'FAIL: rider B reads % ride_private_details rows, none are theirs', v_rows;
  END IF;
  UPDATE public.ride_private_details SET purpose = 'other' WHERE ride_id = ride_pub;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'FAIL: rider B updated rider A''s ride_private_details';
  END IF;
  BEGIN
    INSERT INTO public.ride_private_details (ride_id, user_id, purpose)
    VALUES (ride_pub, current_setting('ri_check.user_b')::uuid, 'other')
    ON CONFLICT (ride_id) DO UPDATE SET purpose = EXCLUDED.purpose;
    RAISE EXCEPTION 'FAIL: rider B upserted into rider A''s ride_private_details';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
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
    PERFORM 1 FROM public.ride_private_details;
    RAISE EXCEPTION 'FAIL: anon can SELECT ride_private_details';
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
  BEGIN
    PERFORM public.ride_stats_places('SRID=4326;LINESTRING(0 0,1 1)', 0, 0, 1, 1);
    RAISE EXCEPTION 'FAIL: anon can execute ride_stats_places';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.ride_stats_stale_rides(1::smallint, 10, '{}');
    RAISE EXCEPTION 'FAIL: anon can execute ride_stats_stale_rides';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ride_stats_stale_count(1::smallint, now());
    RAISE EXCEPTION 'FAIL: anon can execute ride_stats_stale_count';
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
  IF EXISTS (SELECT 1 FROM public.ride_private_details WHERE ride_id = purged) THEN
    RAISE EXCEPTION 'FAIL: purge kept ride_private_details of a ride deleted 31 days ago';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ride_waypoints WHERE ride_id = purged)
     OR (SELECT route_polyline FROM public.rides WHERE id = purged) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: purge no longer removes the raw track of a ride deleted 31 days ago';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ride_stats WHERE ride_id = recent)
     OR NOT EXISTS (SELECT 1 FROM public.ride_tracks WHERE ride_id = recent)
     OR NOT EXISTS (SELECT 1 FROM public.ride_private_details WHERE ride_id = recent)
     OR NOT EXISTS (SELECT 1 FROM public.ride_waypoints WHERE ride_id = recent) THEN
    RAISE EXCEPTION 'FAIL: purge removed data of a ride deleted yesterday';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ride_stats_places on synthetic reference geodata.
--
-- The reference tables are emptied first (inside this rolled-back transaction),
-- so the check also runs on a stack where the loader has filled them.
--
-- Spain is lng -1..0 and France lng 0..1, both lat 42..43. Each core is its
-- border shrunk 500 m inward (0.0061 degrees of longitude at lat 42.5, 0.0045
-- of latitude) and split at lng -0.5 / 0.5, as the loader subdivides it.
-- Routes run along lat 42.5, where one degree of longitude is about 82,073 m.
-- ---------------------------------------------------------------------------
DELETE FROM public.ref_places;
DELETE FROM public.ref_regions;
DELETE FROM public.ref_country_parts;

SET LOCAL ROLE service_role;

DO $$
DECLARE
  v jsonb;
BEGIN
  v := public.ride_stats_places('SRID=4326;LINESTRING(-0.05 42.5,0.00366 42.5)', 42.5, -0.05, 42.5, 0.00366);
  IF (v ->> 'reference_ready')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: reference_ready is not false on empty reference tables (%)', v;
  END IF;
  IF jsonb_typeof(v -> 'countries') <> 'array' OR jsonb_array_length(v -> 'countries') <> 0 THEN
    RAISE EXCEPTION 'FAIL: countries is not an empty array on empty reference tables (%)', v;
  END IF;
END $$;

RESET ROLE;

INSERT INTO public.ref_country_parts (iso_a2, name, kind, geom)
VALUES
  ('ES', 'Spain', 'border', ST_GeomFromText('POLYGON((-1 42,0 42,0 43,-1 43,-1 42))', 4326)),
  ('FR', 'France', 'border', ST_GeomFromText('POLYGON((0 42,1 42,1 43,0 43,0 42))', 4326)),
  ('ES', 'Spain', 'core', ST_GeomFromText('POLYGON((-1 42.0045,-0.5 42.0045,-0.5 42.9955,-1 42.9955,-1 42.0045))', 4326)),
  ('ES', 'Spain', 'core', ST_GeomFromText('POLYGON((-0.5 42.0045,-0.0061 42.0045,-0.0061 42.9955,-0.5 42.9955,-0.5 42.0045))', 4326)),
  ('FR', 'France', 'core', ST_GeomFromText('POLYGON((0.0061 42.0045,0.5 42.0045,0.5 42.9955,0.0061 42.9955,0.0061 42.0045))', 4326)),
  ('FR', 'France', 'core', ST_GeomFromText('POLYGON((0.5 42.0045,1 42.0045,1 42.9955,0.5 42.9955,0.5 42.0045))', 4326));

-- Near Town is 11.1 km north of the test start, Second Town 16.7 km; Far Town
-- is 33 km from the test end.
INSERT INTO public.ref_places (geonameid, name, iso_a2, admin1_code, population, geom)
VALUES
  (900001, 'Near Town', 'ES', 'CT', 20000, ST_SetSRID(ST_MakePoint(-0.05, 42.6), 4326)),
  (900002, 'Second Town', 'ES', 'CT', 90000, ST_SetSRID(ST_MakePoint(-0.05, 42.65), 4326)),
  (900003, 'Far Town', 'FR', '76', 50000, ST_SetSRID(ST_MakePoint(0.6, 42.4), 4326));

SET LOCAL ROLE service_role;

DO $$
DECLARE
  v jsonb;
  v_es jsonb;
  v_fr jsonb;
  v_counted text[];
BEGIN
  -- 1. 300 m into France: only Spain has 1 km or more of core.
  v := public.ride_stats_places(
    'SRID=4326;LINESTRING(-0.05 42.5,-0.03 42.5,-0.01 42.5,0 42.5,0.00366 42.5)', 42.5, -0.05, 42.5, 0.00366);
  IF (v ->> 'reference_ready')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: reference_ready is not true with loaded parts (%)', v;
  END IF;
  SELECT array_agg(c ->> 'iso_a2' ORDER BY (c ->> 'first_at')::float8) INTO v_counted
  FROM jsonb_array_elements(v -> 'countries') c
  WHERE (c ->> 'core_m')::float8 >= 1000;
  IF v_counted IS DISTINCT FROM ARRAY['ES'] THEN
    RAISE EXCEPTION 'FAIL: 300 m into France counted % (expected only ES): %', v_counted, v;
  END IF;
  SELECT c INTO v_es FROM jsonb_array_elements(v -> 'countries') c WHERE c ->> 'iso_a2' = 'ES';
  -- (0.05 - 0.0061) degrees * 82,073 m = 3,603 m inside the Spanish core.
  IF (v_es ->> 'core_m')::float8 NOT BETWEEN 3550 AND 3650 THEN
    RAISE EXCEPTION 'FAIL: ES core_m = %, expected about 3,603 m', v_es ->> 'core_m';
  END IF;

  -- 2. A road zig-zagging across the border (300 m into France, 250 m into
  --    Spain, about every kilometre for 33 km) stays out of both cores.
  SELECT public.ride_stats_places(
    'SRID=4326;LINESTRING(' || string_agg(
      CASE WHEN i % 2 = 0 THEN '0.00366 ' ELSE '-0.003 ' END || (42.3 + i * 0.01)::text, ',' ORDER BY i) || ')',
    42.3, 0.00366, 42.6, 0.00366)
  INTO v
  FROM generate_series(0, 30) i;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'countries') c WHERE (c ->> 'core_m')::float8 >= 1000) THEN
    RAISE EXCEPTION 'FAIL: a road along the border counted a country: %', v;
  END IF;

  -- 3. Crossing from deep in Spain (across the core split at -0.5) into France:
  --    core metres summed over the subdivided parts, ordered by first entry.
  v := public.ride_stats_places(
    'SRID=4326;LINESTRING(-0.7 42.5,-0.5 42.5,-0.3 42.5,-0.1 42.5,0 42.5,0.1 42.5,0.3 42.5)', 42.5, -0.7, 42.5, 0.3);
  SELECT c INTO v_es FROM jsonb_array_elements(v -> 'countries') c WHERE c ->> 'iso_a2' = 'ES';
  SELECT c INTO v_fr FROM jsonb_array_elements(v -> 'countries') c WHERE c ->> 'iso_a2' = 'FR';
  IF jsonb_array_length(v -> 'countries') <> 2 OR v_es IS NULL OR v_fr IS NULL THEN
    RAISE EXCEPTION 'FAIL: crossing route returned %, expected one ES and one FR entry', v -> 'countries';
  END IF;
  -- (0.7 - 0.0061) * 82,073 = 56,951 m; (0.3 - 0.0061) * 82,073 = 24,121 m.
  IF (v_es ->> 'core_m')::float8 NOT BETWEEN 56400 AND 57500 THEN
    RAISE EXCEPTION 'FAIL: crossing ES core_m = %, expected about 56,951 m (both parts)', v_es ->> 'core_m';
  END IF;
  IF (v_fr ->> 'core_m')::float8 NOT BETWEEN 23900 AND 24400 THEN
    RAISE EXCEPTION 'FAIL: crossing FR core_m = %, expected about 24,121 m', v_fr ->> 'core_m';
  END IF;
  -- Spain from the start; France from (0.7061 / 1.0) of the way.
  IF (v_es ->> 'first_at')::float8 > 0.001 THEN
    RAISE EXCEPTION 'FAIL: ES first_at = %, expected 0', v_es ->> 'first_at';
  END IF;
  IF (v_fr ->> 'first_at')::float8 NOT BETWEEN 0.70 AND 0.71 THEN
    RAISE EXCEPTION 'FAIL: FR first_at = %, expected about 0.706', v_fr ->> 'first_at';
  END IF;

  -- 4. Nearest town within 25 km of the start; none within 25 km of the end.
  v := public.ride_stats_places(
    'SRID=4326;LINESTRING(-0.05 42.5,0.6 42.1)', 42.5, -0.05, 42.1, 0.6);
  IF v -> 'start_place' IS DISTINCT FROM
     '{"name": "Near Town", "iso_a2": "ES", "admin1_code": "CT"}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: start_place = %, expected Near Town', v -> 'start_place';
  END IF;
  IF v -> 'end_place' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'FAIL: end_place = %, expected null (nearest town 33 km away)', v -> 'end_place';
  END IF;
  v := public.ride_stats_places(
    'SRID=4326;LINESTRING(-0.05 42.5,0.6 42.2)', 42.5, -0.05, 42.2, 0.6);
  IF v -> 'end_place' ->> 'name' IS DISTINCT FROM 'Far Town' THEN
    RAISE EXCEPTION 'FAIL: end_place = %, expected Far Town (22 km away)', v -> 'end_place';
  END IF;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- ride_stats_stale_rides / ride_stats_stale_count.
--
-- Rider A's rides, by what makes them stale (or not):
--   s_none      ended 3 h ago, no ride_stats row              -> stale
--   s_current   ended 10 days ago, row at version 2            -> not stale at 2
--   s_old       ended 5 h ago, row at version 1                -> stale at 2 only
--   s_late      ended 6 h ago, row at 2 computed 5 h ago, track
--               updated 1 h ago                                 -> stale (since 1 h)
--   s_deleted   soft-deleted, no row                           -> never
--   s_recording still recording, no row                        -> never
--   s_excluded  ended 4 h ago, no row                          -> stale unless excluded
-- Synthetic account:
--   s_synth     ended 30 days ago (the oldest), no row          -> stale, but last
-- Other rides in the database are filtered out of every assertion.
-- ---------------------------------------------------------------------------
SELECT
  set_config('ri_check.user_synth', gen_random_uuid()::text, true),
  set_config('ri_check.s_none', gen_random_uuid()::text, true),
  set_config('ri_check.s_current', gen_random_uuid()::text, true),
  set_config('ri_check.s_old', gen_random_uuid()::text, true),
  set_config('ri_check.s_late', gen_random_uuid()::text, true),
  set_config('ri_check.s_deleted', gen_random_uuid()::text, true),
  set_config('ri_check.s_recording', gen_random_uuid()::text, true),
  set_config('ri_check.s_excluded', gen_random_uuid()::text, true),
  set_config('ri_check.s_synth', gen_random_uuid()::text, true);

-- Counted before the stale fixture exists, so the count assertions are deltas
-- and hold on a database with other rides.
SET LOCAL ROLE service_role;
SELECT
  set_config('ri_check.count_v2_before',
             public.ride_stats_stale_count(2::smallint, now() - interval '2 hours')::text, true),
  set_config('ri_check.count_v1_before',
             public.ride_stats_stale_count(1::smallint, now() - interval '2 hours')::text, true);
RESET ROLE;

INSERT INTO auth.users (id, email)
VALUES (current_setting('ri_check.user_synth')::uuid,
        'ri-check-synth-' || current_setting('ri_check.user_synth') || '@example.invalid');
INSERT INTO public.users (id, email, is_synthetic)
SELECT id, email, true FROM auth.users WHERE id = current_setting('ri_check.user_synth')::uuid;

INSERT INTO public.rides (id, user_id, status, started_at, ended_at, distance_m, deleted_at, track_updated_at)
VALUES
  (current_setting('ri_check.s_none')::uuid, current_setting('ri_check.user_a')::uuid, 'completed',
   now() - interval '4 hours', now() - interval '3 hours', 10000, NULL, NULL),
  (current_setting('ri_check.s_current')::uuid, current_setting('ri_check.user_a')::uuid, 'completed',
   now() - interval '10 days 1 hour', now() - interval '10 days', 10000, NULL, NULL),
  (current_setting('ri_check.s_old')::uuid, current_setting('ri_check.user_a')::uuid, 'completed',
   now() - interval '6 hours', now() - interval '5 hours', 10000, NULL, NULL),
  (current_setting('ri_check.s_late')::uuid, current_setting('ri_check.user_a')::uuid, 'completed',
   now() - interval '7 hours', now() - interval '6 hours', 10000, NULL, now() - interval '1 hour'),
  (current_setting('ri_check.s_deleted')::uuid, current_setting('ri_check.user_a')::uuid, 'completed',
   now() - interval '9 hours', now() - interval '8 hours', 10000, now() - interval '1 hour', NULL),
  (current_setting('ri_check.s_recording')::uuid, current_setting('ri_check.user_a')::uuid, 'recording',
   now() - interval '1 hour', NULL, NULL, NULL, NULL),
  (current_setting('ri_check.s_excluded')::uuid, current_setting('ri_check.user_a')::uuid, 'completed',
   now() - interval '5 hours', now() - interval '4 hours', 10000, NULL, NULL),
  (current_setting('ri_check.s_synth')::uuid, current_setting('ri_check.user_synth')::uuid, 'completed',
   now() - interval '30 days 1 hour', now() - interval '30 days', 10000, NULL, NULL);

INSERT INTO public.ride_stats (ride_id, user_id, stats_version, computed_at, input_source, time_zone,
                               local_date, local_start_hour, local_dow, distance_m, elapsed_s)
VALUES
  (current_setting('ri_check.s_current')::uuid, current_setting('ri_check.user_a')::uuid, 2,
   now() - interval '10 days', 'none', 'UTC', current_date, 8, 1, 10000, 3600),
  (current_setting('ri_check.s_old')::uuid, current_setting('ri_check.user_a')::uuid, 1,
   now() - interval '5 hours', 'none', 'UTC', current_date, 8, 1, 10000, 3600),
  (current_setting('ri_check.s_late')::uuid, current_setting('ri_check.user_a')::uuid, 2,
   now() - interval '5 hours', 'none', 'UTC', current_date, 8, 1, 10000, 3600);

SET LOCAL ROLE service_role;

DO $$
DECLARE
  s_none CONSTANT uuid := current_setting('ri_check.s_none')::uuid;
  s_current CONSTANT uuid := current_setting('ri_check.s_current')::uuid;
  s_old CONSTANT uuid := current_setting('ri_check.s_old')::uuid;
  s_late CONSTANT uuid := current_setting('ri_check.s_late')::uuid;
  s_deleted CONSTANT uuid := current_setting('ri_check.s_deleted')::uuid;
  s_recording CONSTANT uuid := current_setting('ri_check.s_recording')::uuid;
  s_excluded CONSTANT uuid := current_setting('ri_check.s_excluded')::uuid;
  s_synth CONSTANT uuid := current_setting('ri_check.s_synth')::uuid;
  mine uuid[];
  v_order uuid[];
  v_synth_row record;
  v_late_since timestamptz;
  v_rows integer;
  v_delta integer;
BEGIN
  mine := ARRAY[s_none, s_current, s_old, s_late, s_deleted, s_recording, s_excluded, s_synth];

  -- 1. Version 2, s_excluded skipped: real riders oldest-first, then synthetic.
  SELECT array_agg(t.ride_id ORDER BY t.ord) INTO v_order
  FROM public.ride_stats_stale_rides(2::smallint, 100000, ARRAY[s_excluded]) WITH ORDINALITY t(ride_id, user_id, is_synthetic, stale_since, ord)
  WHERE t.ride_id = ANY (mine);
  -- s_old since 5 h, s_none since 3 h, s_late since its track update 1 h ago.
  IF v_order IS DISTINCT FROM ARRAY[s_old, s_none, s_late, s_synth] THEN
    RAISE EXCEPTION 'FAIL: stale rides at version 2 = %, expected [s_old, s_none, s_late, s_synth] = %',
      v_order, ARRAY[s_old, s_none, s_late, s_synth];
  END IF;

  -- The real riders' rides come before EVERY synthetic ride, not only ours.
  IF EXISTS (
    WITH t AS (SELECT * FROM public.ride_stats_stale_rides(2::smallint, 100000, '{}') WITH ORDINALITY)
    SELECT 1 FROM t a JOIN t b ON a.is_synthetic AND NOT b.is_synthetic AND a.ordinality < b.ordinality
  ) THEN
    RAISE EXCEPTION 'FAIL: a synthetic account''s ride comes before a real rider''s';
  END IF;

  SELECT t.* INTO v_synth_row FROM public.ride_stats_stale_rides(2::smallint, 100000, NULL) t
  WHERE t.ride_id = s_synth;
  IF v_synth_row.user_id IS DISTINCT FROM current_setting('ri_check.user_synth')::uuid
     OR v_synth_row.is_synthetic IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: synthetic ride row = %', v_synth_row;
  END IF;
  SELECT t.stale_since INTO v_late_since FROM public.ride_stats_stale_rides(2::smallint, 100000, NULL) t
  WHERE t.ride_id = s_late;
  IF v_late_since IS DISTINCT FROM now() - interval '1 hour' THEN
    RAISE EXCEPTION 'FAIL: stale_since of the late track = %, expected its track_updated_at', v_late_since;
  END IF;

  -- 2. Without the exclusion s_excluded is stale (so the exclusion is what hid it).
  IF NOT EXISTS (SELECT 1 FROM public.ride_stats_stale_rides(2::smallint, 100000, '{}') t
                 WHERE t.ride_id = s_excluded) THEN
    RAISE EXCEPTION 'FAIL: s_excluded is not stale without p_exclude';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ride_stats_stale_rides(2::smallint, 100000, NULL) t
                 WHERE t.ride_id = s_excluded) THEN
    RAISE EXCEPTION 'FAIL: a NULL p_exclude hides rides';
  END IF;

  -- 3. At version 1 the version-1 row is current; the late track is still stale.
  SELECT array_agg(t.ride_id ORDER BY t.ord) INTO v_order
  FROM public.ride_stats_stale_rides(1::smallint, 100000, ARRAY[s_excluded]) WITH ORDINALITY t(ride_id, user_id, is_synthetic, stale_since, ord)
  WHERE t.ride_id = ANY (mine);
  IF v_order IS DISTINCT FROM ARRAY[s_none, s_late, s_synth] THEN
    RAISE EXCEPTION 'FAIL: stale rides at version 1 = %, expected [s_none, s_late, s_synth]', v_order;
  END IF;

  -- 4. p_limit caps the batch.
  SELECT count(*) INTO v_rows FROM public.ride_stats_stale_rides(2::smallint, 1, '{}');
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'FAIL: p_limit 1 returned % rows', v_rows;
  END IF;

  -- 5. Count, older than 2 hours: at version 2 s_old (5 h), s_none (3 h),
  --    s_excluded (4 h) and s_synth (30 days); s_late changed 1 h ago.
  v_delta := public.ride_stats_stale_count(2::smallint, now() - interval '2 hours')
             - current_setting('ri_check.count_v2_before')::integer;
  IF v_delta <> 4 THEN
    RAISE EXCEPTION 'FAIL: stale count at version 2 grew by %, expected 4', v_delta;
  END IF;
  -- At version 1 s_old is current.
  v_delta := public.ride_stats_stale_count(1::smallint, now() - interval '2 hours')
             - current_setting('ri_check.count_v1_before')::integer;
  IF v_delta <> 3 THEN
    RAISE EXCEPTION 'FAIL: stale count at version 1 grew by %, expected 3', v_delta;
  END IF;
END $$;

RESET ROLE;

DO $$
BEGIN
  RAISE NOTICE 'rider insights schema check: all assertions passed';
END $$;

ROLLBACK;
