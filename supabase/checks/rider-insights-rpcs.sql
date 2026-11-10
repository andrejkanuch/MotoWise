-- Repeatable check for the rider insights read RPCs
-- (migrations/00199_rider_insights_rpcs.sql).
--
-- Proves on a real database what the API specs (mocked Supabase clients) cannot:
--   * every new function is SECURITY DEFINER with an empty search_path, and
--     anon and authenticated can neither hold nor use EXECUTE on any of them;
--     service_role can;
--   * ride_is_qualifying() gives the same answer as isQualifyingRide() in
--     packages/types (src/ride-metrics/__tests__/qualifying.test.ts): the same
--     15 cases with identical inputs and expected booleans;
--   * rider_insights_season(): an empty group list returns the free blocks and
--     no detail; each detail group carries the values built from fixed rides
--     (territory with new-road share, road character, rhythm, best rides,
--     bikes with Unassigned, countries with per-country distance); free totals
--     count every completed ride, rides without geometry included; a ride
--     server-ended or deleted never ranks; regions come main first with bounds
--     and encoded routes; cost per km gives one row per currency (odometer and
--     tracked distance); a synthetic rider gets their own insights; a deleted
--     ride leaves the totals; coverage counts rides without a ride_stats row
--     (pending_rides) and, of those, the ones ended within 24 hours
--     (pending_recent_rides);
--   * ride_new_roads(): a ride that repeats an earlier one has 0 m new road,
--     the first ride's new road is its whole distance, a partly new ride gets
--     its share, and another rider's ride returns null;
--   * rider_ride_overview(): today's GraphQL shape; day buckets follow p_tz (a
--     ride at 23:30 and one at 01:00 local in a UTC+2 zone count on their local
--     day); a deleted ride leaves the periods and the last ride; the weekly
--     streak counts consecutive weeks;
--   * rider_personal_records(): records come from qualifying rides only, with
--     the previous best, and a deleted ride's record falls back.
--   * A heavy synthetic rider (1,500 rides with cells, tracks and stats): the
--     EXPLAIN ANALYZE execution times of the season read (all groups and free
--     only), the overview and the records are printed as NOTICEs. The 300 ms
--     gate is checked on production (footer of 00199); this container runs
--     under emulation on Apple silicon, so only a loose bound is asserted.
--
-- Everything runs in ONE transaction that ends in ROLLBACK, and the file uses no
-- psql meta-commands:
--
--   * disposable container (fixture + 00048, 00181, 00197, 00199, then this file):
--       supabase/checks/run.sh rider-insights-rpcs.sql
--   * local Supabase stack with the migrations applied:
--       psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--         -v ON_ERROR_STOP=1 -f supabase/checks/rider-insights-rpcs.sql
--
-- A failed assertion raises, which aborts the transaction (nothing is kept) and
-- surfaces as the error. Success returns no rows and no error.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.rider_insights_season(uuid, date, date, text[], double precision)') IS NULL THEN
    RAISE EXCEPTION 'public.rider_insights_season does not exist: apply 00199 first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Catalog: SECURITY DEFINER, empty search_path, service_role only.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn TEXT;
  who TEXT;
  p RECORD;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.ride_is_qualifying(public.rides)',
    'public.ride_duration_s(public.rides)',
    'public.rider_insights_season(uuid, date, date, text[], double precision)',
    'public.rider_ride_overview(uuid, text)',
    'public.rider_personal_records(uuid)',
    'public.ride_new_roads(uuid, uuid)'
  ] LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE EXCEPTION 'FAIL: % does not exist', fn;
    END IF;
    SELECT prosecdef, proconfig INTO p FROM pg_proc WHERE oid = to_regprocedure(fn);
    IF NOT p.prosecdef THEN
      RAISE EXCEPTION 'FAIL: % is not SECURITY DEFINER', fn;
    END IF;
    IF p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'FAIL: % proconfig is %, expected an empty search_path', fn, p.proconfig;
    END IF;
    FOREACH who IN ARRAY ARRAY['public', 'anon', 'authenticated'] LOOP
      IF has_function_privilege(who, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL: % can execute %', who, fn;
      END IF;
    END LOOP;
    IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: service_role cannot execute %', fn;
    END IF;
  END LOOP;
END $$;

-- The grants hold for real calls too.
DO $$
DECLARE
  who TEXT;
  stmt TEXT;
BEGIN
  FOREACH who IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH stmt IN ARRAY ARRAY[
      $q$SELECT public.rider_insights_season(gen_random_uuid(), '2026-01-01', '2026-12-31', '{}', 25)$q$,
      $q$SELECT public.rider_ride_overview(gen_random_uuid(), 'UTC')$q$,
      $q$SELECT public.rider_personal_records(gen_random_uuid())$q$,
      $q$SELECT public.ride_new_roads(gen_random_uuid(), gen_random_uuid())$q$,
      $q$SELECT public.ride_is_qualifying(NULL::public.rides)$q$,
      $q$SELECT public.ride_duration_s(NULL::public.rides)$q$
    ] LOOP
      BEGIN
        EXECUTE format('SET LOCAL ROLE %I', who);
        EXECUTE stmt;
        RAISE EXCEPTION 'FAIL: % ran %', who, stmt;
      EXCEPTION WHEN insufficient_privilege THEN
        NULL;
      END;
      RESET ROLE;
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- ride_is_qualifying() vs isQualifyingRide(): the TypeScript test's cases.
-- Base: 12 km in 25 minutes, completed, not deleted, no server-end reason.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  base jsonb := jsonb_build_object(
    'id', gen_random_uuid(), 'user_id', gen_random_uuid(),
    'status', 'completed', 'deleted_at', NULL, 'auto_ended_reason', NULL,
    'distance_m', 12000,
    'started_at', '2026-10-10T10:00:00Z', 'ended_at', '2026-10-10T10:25:00Z',
    'paused_duration_s', 0, 'auto_paused_duration_s', 0);
  four jsonb := jsonb_build_object('ended_at', '2026-10-10T10:04:00Z');
  c RECORD;
  got boolean;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('app-auto-ended ride counts', '{}'::jsonb, true),
      ('idle-swept ride', '{"auto_ended_reason": "idle_timeout"}', false),
      ('still recording', '{"status": "recording"}', false),
      ('paused', '{"status": "paused"}', false),
      ('deleted', '{"deleted_at": "2026-10-11T08:00:00Z"}', false),
      ('exactly 1 km', '{"distance_m": 1000}', true),
      ('999 m', '{"distance_m": 999}', false),
      ('unknown distance', '{"distance_m": null}', false),
      ('240 s less 90 s manual pause', four || '{"paused_duration_s": 90}', false),
      ('240 s less 90 s auto pause', four || '{"auto_paused_duration_s": 90}', false),
      ('exactly 180 s', four || '{"paused_duration_s": 30, "auto_paused_duration_s": 30}', true),
      ('179 s', '{"ended_at": "2026-10-10T10:02:59Z"}', false),
      ('null pause columns', '{"paused_duration_s": null, "auto_paused_duration_s": null}', true),
      ('no ended_at', '{"ended_at": null}', false),
      ('no started_at', '{"started_at": null}', false)
    ) AS t (label, override, expected)
  LOOP
    got := public.ride_is_qualifying(jsonb_populate_record(NULL::public.rides, base || c.override));
    IF got IS DISTINCT FROM c.expected THEN
      RAISE EXCEPTION 'FAIL: ride_is_qualifying(%) = %, isQualifyingRide says %', c.label, got, c.expected;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Seed helpers (temporary, dropped with the session).
-- ---------------------------------------------------------------------------
CREATE FUNCTION pg_temp.seed_user(p_id uuid, p_synthetic boolean DEFAULT false) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO auth.users (id) VALUES (p_id);
  INSERT INTO public.users (id, is_synthetic) VALUES (p_id, p_synthetic);
$$;

-- A completed ride of p_minutes; p_extra overrides any rides column.
CREATE FUNCTION pg_temp.seed_ride(p_id uuid, p_user uuid, p_bike uuid, p_start timestamptz,
  p_minutes integer, p_distance integer, p_extra jsonb DEFAULT '{}') RETURNS void
LANGUAGE sql AS $$
  INSERT INTO public.rides
  SELECT * FROM jsonb_populate_record(NULL::public.rides,
    jsonb_build_object(
      'id', p_id, 'user_id', p_user, 'motorcycle_id', p_bike, 'status', 'completed',
      'started_at', p_start, 'ended_at', p_start + make_interval(mins => p_minutes),
      'paused_duration_s', 0, 'auto_paused_duration_s', 0, 'distance_m', p_distance,
      'mileage_applied', false, 'visibility', 'private',
      'created_at', now(), 'updated_at', now()) || p_extra);
$$;

-- The ride's ride_stats row: UTC local fields from the ride, p_extra overrides.
CREATE FUNCTION pg_temp.seed_stats(p_ride uuid, p_extra jsonb DEFAULT '{}') RETURNS void
LANGUAGE sql AS $$
  INSERT INTO public.ride_stats
  SELECT (jsonb_populate_record(NULL::public.ride_stats,
    jsonb_build_object(
      'ride_id', r.id, 'user_id', r.user_id, 'motorcycle_id', r.motorcycle_id,
      'stats_version', 1, 'computed_at', now(), 'input_source', 'waypoints',
      'time_zone', 'UTC',
      'local_date', (r.started_at AT TIME ZONE 'UTC')::date,
      'local_start_hour', extract(hour FROM r.started_at AT TIME ZONE 'UTC')::int,
      'local_dow', extract(isodow FROM r.started_at AT TIME ZONE 'UTC')::int,
      'distance_m', r.distance_m,
      'elapsed_s', extract(epoch FROM r.ended_at - r.started_at)::int) || p_extra)).*
  FROM public.rides r WHERE r.id = p_ride;
$$;

CREATE FUNCTION pg_temp.seed_track(p_ride uuid, p_wkt text) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO public.ride_tracks (ride_id, user_id, source, route, stats_version)
  SELECT r.id, r.user_id, 'waypoints', public.ST_GeomFromText(p_wkt, 4326), 1
  FROM public.rides r WHERE r.id = p_ride;
$$;

CREATE FUNCTION pg_temp.cells(p_from integer, p_to integer) RETURNS jsonb
LANGUAGE sql AS $$ SELECT to_jsonb(ARRAY(SELECT g::bigint FROM generate_series(p_from, p_to) g)) $$;

-- ---------------------------------------------------------------------------
-- Reference geodata: two adjacent squares (border parts) and two regions.
-- ---------------------------------------------------------------------------
INSERT INTO public.ref_country_parts (iso_a2, name, kind, geom) VALUES
  ('SK', 'Slovakia', 'border', public.ST_GeomFromText('POLYGON((17 48,18 48,18 49,17 49,17 48))', 4326)),
  ('AT', 'Austria', 'border', public.ST_GeomFromText('POLYGON((16 48,17 48,17 49,16 49,16 48))', 4326)),
  ('SK', 'Slovakia', 'core', public.ST_GeomFromText('POLYGON((17.01 48.01,17.99 48.01,17.99 48.99,17.01 48.99,17.01 48.01))', 4326)),
  ('AT', 'Austria', 'core', public.ST_GeomFromText('POLYGON((16.01 48.01,16.99 48.01,16.99 48.99,16.01 48.99,16.01 48.01))', 4326));
INSERT INTO public.ref_regions (iso_a2, admin1_code, name) VALUES
  ('SK', '02', 'Bratislava Region'), ('AT', '09', 'Vienna');

-- ---------------------------------------------------------------------------
-- Rider A: the season scenario (window 2026-01-01 .. 2026-12-31).
--   r1 2026-05-02 Sat  20 km bike1  cells 1..100   SK.02  waypoints
--   r2 2026-05-09 Sat  20 km bike1  cells 1..100   SK.02  repeats r1
--   r3 2026-06-10 Wed  40 km bike2  cells 51..150  AT.09  SK then AT
--   r4 2026-07-01 Wed  15 km no bike cells 151..160 SK.02 polyline
--   r5 2026-07-05 Sun  60 km bike1  server-ended (counts in totals only)
--   r6 2026-08-01     100 km bike1  deleted
--   r7 2026-08-10 Mon  10 km bike1  no ride_stats row yet (pending)
--   r8 2025-12-20       5 km bike1  cells 151..155, before the window
-- ---------------------------------------------------------------------------
SELECT pg_temp.seed_user('aaaaaaaa-0000-0000-0000-000000000001');
SELECT pg_temp.seed_user('bbbbbbbb-0000-0000-0000-000000000001');

INSERT INTO public.motorcycles (id, user_id, make, model, nickname, distance_unit) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Yamaha', 'Tenere 700', 'Tenere', 'km'),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Honda', 'CB500X', NULL, 'mi');

SELECT pg_temp.seed_ride('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', '2026-05-02T08:00:00Z', 40, 20000, '{"max_speed_mps": 99}');
SELECT pg_temp.seed_ride('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', '2026-05-09T08:00:00Z', 40, 20000);
SELECT pg_temp.seed_ride('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002', '2026-06-10T15:00:00Z', 60, 40000, '{"max_speed_mps": 80, "name": "Danube run"}');
SELECT pg_temp.seed_ride('a0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
  NULL, '2026-07-01T06:00:00Z', 30, 15000);
SELECT pg_temp.seed_ride('a0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', '2026-07-05T09:00:00Z', 120, 60000,
  '{"auto_ended_reason": "idle_timeout", "max_speed_mps": 120}');
SELECT pg_temp.seed_ride('a0000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', '2026-08-01T09:00:00Z', 120, 100000,
  '{"deleted_at": "2026-08-02T09:00:00Z"}');
SELECT pg_temp.seed_ride('a0000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', '2026-08-10T10:00:00Z', 20, 10000, '{"elevation_gain": 900}');
SELECT pg_temp.seed_ride('a0000000-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', '2025-12-20T10:00:00Z', 15, 5000);
SELECT pg_temp.seed_ride('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
  NULL, '2026-05-03T08:00:00Z', 40, 30000);

SELECT pg_temp.seed_stats('a0000000-0000-0000-0000-000000000001', jsonb_build_object(
  'local_start_hour', 10, 'cells', pg_temp.cells(1, 100), 'start_cell', 1001,
  'countries', '["SK"]'::jsonb, 'start_region', 'SK.02', 'start_place', 'Bratislava',
  'band_km', '{"straight": 10, "sweeping": 6, "twisty": 3, "tight": 1}'::jsonb,
  'bends_count', 30, 'bends_per_km', 1.5,
  'lean_bands', '{"corners": 10, "under20": 0.5, "from20to30": 0.3, "from30to40": 0.2, "from40": 0}'::jsonb,
  'climb_m', 300, 'moving_time_s', 2200, 'max_speed_mps', 30.5));
SELECT pg_temp.seed_stats('a0000000-0000-0000-0000-000000000002', jsonb_build_object(
  'local_start_hour', 10, 'cells', pg_temp.cells(1, 100), 'start_cell', 1001,
  'countries', '["SK"]'::jsonb, 'start_region', 'SK.02',
  'band_km', '{"straight": 10, "sweeping": 6, "twisty": 3, "tight": 1}'::jsonb,
  'bends_count', 30, 'bends_per_km', 1.5,
  'lean_bands', '{"corners": 10, "under20": 0.5, "from20to30": 0.3, "from30to40": 0.2, "from40": 0}'::jsonb,
  'climb_m', 300, 'moving_time_s', 2200, 'max_speed_mps', 30.5));
SELECT pg_temp.seed_stats('a0000000-0000-0000-0000-000000000003', jsonb_build_object(
  'local_start_hour', 17, 'cells', pg_temp.cells(51, 150), 'start_cell', 2002,
  'countries', '["SK", "AT"]'::jsonb, 'start_region', 'AT.09',
  'band_km', '{"straight": 30, "sweeping": 8, "twisty": 2, "tight": 0}'::jsonb,
  'bends_count', 12, 'bends_per_km', 0.3,
  'lean_bands', '{"corners": 30, "under20": 1, "from20to30": 0, "from30to40": 0, "from40": 0}'::jsonb,
  'climb_m', 500, 'moving_time_s', 3400, 'max_speed_mps', 35));
SELECT pg_temp.seed_stats('a0000000-0000-0000-0000-000000000004', jsonb_build_object(
  'input_source', 'polyline', 'local_start_hour', 8, 'cells', pg_temp.cells(151, 160),
  'start_cell', 1001, 'countries', '["SK"]'::jsonb, 'start_region', 'SK.02'));
SELECT pg_temp.seed_stats('a0000000-0000-0000-0000-000000000005', jsonb_build_object(
  'cells', pg_temp.cells(161, 170), 'countries', '["SK"]'::jsonb, 'start_region', 'SK.02',
  'max_speed_mps', 120));
SELECT pg_temp.seed_stats('a0000000-0000-0000-0000-000000000006', jsonb_build_object(
  'cells', pg_temp.cells(171, 180), 'countries', '["SK"]'::jsonb, 'start_region', 'SK.02'));
SELECT pg_temp.seed_stats('a0000000-0000-0000-0000-000000000008', jsonb_build_object(
  'cells', pg_temp.cells(151, 155), 'start_cell', 1001, 'countries', '["SK"]'::jsonb,
  'start_region', 'SK.02'));
SELECT pg_temp.seed_stats('b0000000-0000-0000-0000-000000000001', jsonb_build_object(
  'cells', pg_temp.cells(1, 100), 'countries', '["SK"]'::jsonb, 'start_region', 'SK.02'));

SELECT pg_temp.seed_track('a0000000-0000-0000-0000-000000000001', 'LINESTRING(17.1 48.1,17.2 48.15)');
SELECT pg_temp.seed_track('a0000000-0000-0000-0000-000000000002', 'LINESTRING(17.1 48.1,17.2 48.15)');
SELECT pg_temp.seed_track('a0000000-0000-0000-0000-000000000003', 'LINESTRING(17.5 48.5,16.5 48.5)');
SELECT pg_temp.seed_track('a0000000-0000-0000-0000-000000000004', 'LINESTRING(17.1 48.1,17.3 48.2)');
SELECT pg_temp.seed_track('a0000000-0000-0000-0000-000000000005', 'LINESTRING(17.1 48.1,17.15 48.12)');
SELECT pg_temp.seed_track('a0000000-0000-0000-0000-000000000006', 'LINESTRING(17.1 48.1,17.9 48.9)');
SELECT pg_temp.seed_track('a0000000-0000-0000-0000-000000000008', 'LINESTRING(17.1 48.1,17.12 48.11)');

-- Fuel and service spend in two currencies; gear, a deleted expense and last
-- year's fuel stay out.
INSERT INTO public.expenses (user_id, motorcycle_id, amount, currency, category, date, deleted_at) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 30, 'EUR', 'fuel', '2026-03-01', NULL),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 70, 'EUR', 'maintenance', '2026-06-01', NULL),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 500, 'EUR', 'gear', '2026-06-01', NULL),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 999, 'EUR', 'fuel', '2026-06-02', '2026-06-03'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 40, 'EUR', 'fuel', '2025-12-01', NULL),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 20, 'USD', 'fuel', '2026-06-10', NULL);

-- Odometer readings on bike1 at both ends of the season: 10,000 -> 10,250 km.
-- bike2 has none, so its distance is the tracked 40 km.
INSERT INTO public.odometer_readings (user_id, motorcycle_id, value, recorded_at, source) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 10000, '2025-12-01T12:00:00Z', 'manual'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 10250, '2026-10-01T12:00:00Z', 'manual');

-- Rider N: three rides without geometry. Rider S: a synthetic account.
SELECT pg_temp.seed_user('cccccccc-0000-0000-0000-000000000001');
SELECT pg_temp.seed_ride('c0000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', NULL, '2026-02-01T10:00:00Z', 20, 5000);
SELECT pg_temp.seed_ride('c0000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', NULL, '2026-02-02T10:00:00Z', 20, 6000);
SELECT pg_temp.seed_ride('c0000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', NULL, '2026-02-03T10:00:00Z', 20, 7000);
SELECT pg_temp.seed_stats(id, '{"input_source": "none"}') FROM public.rides
WHERE user_id = 'cccccccc-0000-0000-0000-000000000001';

SELECT pg_temp.seed_user('dddddddd-0000-0000-0000-000000000001', true);
SELECT pg_temp.seed_ride('d0000000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', NULL, '2026-04-01T10:00:00Z', 30, 25000);
SELECT pg_temp.seed_stats('d0000000-0000-0000-0000-000000000001', jsonb_build_object(
  'cells', pg_temp.cells(1, 50), 'countries', '["SK"]'::jsonb, 'start_region', 'SK.02'));

-- Rider P: two rides without a ride_stats row, one ended an hour ago (its
-- compute is still due) and one ended three days ago (a compute that keeps
-- failing). Relative to now(), so the case holds whenever the check runs.
SELECT pg_temp.seed_user('77777777-0000-0000-0000-000000000001');
SELECT pg_temp.seed_ride('70000000-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', NULL,
  now() - interval '2 hours', 60, 20000);
SELECT pg_temp.seed_ride('70000000-0000-0000-0000-000000000002', '77777777-0000-0000-0000-000000000001', NULL,
  now() - interval '3 days', 60, 20000);

SET LOCAL ROLE service_role;

-- ---------------------------------------------------------------------------
-- rider_insights_season: only a ride ended within the last 24 hours counts as
-- recently pending.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  res jsonb := public.rider_insights_season('77777777-0000-0000-0000-000000000001',
    current_date - 10, current_date + 1, '{}', 25);
BEGIN
  IF (res #>> '{coverage,pending_rides}')::int <> 2
     OR (res #>> '{coverage,pending_recent_rides}')::int <> 1 THEN
    RAISE EXCEPTION 'FAIL: pending coverage with a fresh and a stale ride %', res -> 'coverage';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- rider_insights_season: free blocks only.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  res jsonb := public.rider_insights_season(a, '2026-01-01', '2026-12-31', '{}', 25);
  keys text[];
BEGIN
  SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(res) k;
  IF keys IS DISTINCT FROM ARRAY['cost_per_km', 'coverage', 'groups', 'latest_ride', 'longest_ride',
                                 'regions', 'ribbon', 'totals', 'window'] THEN
    RAISE EXCEPTION 'FAIL: free-only keys are %', keys;
  END IF;
  IF res -> 'groups' <> '{}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: empty p_groups returned detail %', res -> 'groups';
  END IF;
  IF public.rider_insights_season(a, '2026-01-01', '2026-12-31', NULL, 25) -> 'groups' <> '{}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: null p_groups returned detail';
  END IF;

  -- Every completed live ride in the window: r1-r5 and the pending r7.
  IF res -> 'totals' <> '{"rides": 6, "distance_m": 165000, "countries": 2}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: totals %', res -> 'totals';
  END IF;
  IF res -> 'coverage' <> '{"rides": 6, "qualifying_rides": 5, "pending_rides": 1, "pending_recent_rides": 0, "rides_with_bike": 5,
      "qualifying": {"with_stats": 4, "with_route": 4, "with_waypoints": 3, "with_bands": 3,
                     "with_lean": 3, "with_moving_time": 3}}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: coverage %', res -> 'coverage';
  END IF;
  IF res -> 'window' <> '{"from": "2026-01-01", "to": "2026-12-31"}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: window %', res -> 'window';
  END IF;

  IF res #>> '{latest_ride,ride_id}' <> 'a0000000-0000-0000-0000-000000000007'
     OR res #>> '{latest_ride,local_date}' <> '2026-08-10'
     OR res #> '{latest_ride,new_countries}' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: latest_ride %', res -> 'latest_ride';
  END IF;
  -- The server-ended 60 km ride never ranks.
  IF res #>> '{longest_ride,ride_id}' <> 'a0000000-0000-0000-0000-000000000003'
     OR (res #>> '{longest_ride,distance_m}')::int <> 40000
     OR res #>> '{longest_ride,name}' <> 'Danube run' THEN
    RAISE EXCEPTION 'FAIL: longest_ride %', res -> 'longest_ride';
  END IF;

  -- Weeks starting Monday: Apr 27, May 4, Jun 8, Jun 29 (r4 + r5), Aug 10.
  IF jsonb_array_length(res -> 'ribbon') <> 5
     OR NOT res -> 'ribbon' @> '[{"week_start": "2026-06-29", "rides": 2, "distance_m": 75000}]' THEN
    RAISE EXCEPTION 'FAIL: ribbon %', res -> 'ribbon';
  END IF;

  -- Main region first (most distance), then the others, each with bounds and routes.
  IF jsonb_array_length(res -> 'regions') <> 2
     OR res #>> '{regions,0,key}' <> 'SK.02'
     OR res #>> '{regions,0,name}' <> 'Bratislava Region'
     OR res #>> '{regions,0,iso_a2}' <> 'SK'
     OR (res #>> '{regions,0,distance_m}')::int <> 115000
     OR (res #>> '{regions,0,rides}')::int <> 4
     OR res #> '{regions,0,bounds}' <> '[17.1, 48.1, 17.3, 48.2]'::jsonb
     OR jsonb_array_length(res #> '{regions,0,routes}') <> 4
     OR res #>> '{regions,1,key}' <> 'AT.09'
     OR res #>> '{regions,1,name}' <> 'Vienna'
     OR jsonb_array_length(res #> '{regions,1,routes}') <> 1 THEN
    RAISE EXCEPTION 'FAIL: regions %', res -> 'regions';
  END IF;
  -- An encoded route decodes back to the ride's line.
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(res #> '{regions,1,routes}') e
    WHERE public.ST_Equals(public.ST_LineFromEncodedPolyline(e),
                           public.ST_GeomFromText('LINESTRING(17.5 48.5,16.5 48.5)', 4326))
  ) THEN
    RAISE EXCEPTION 'FAIL: AT.09 route does not decode to r3: %', res #> '{regions,1,routes}';
  END IF;

  -- One row per currency; the rider's profile currency (USD, the column default)
  -- leads even with less spend, because amounts in different currencies are not
  -- comparable. EUR: 100 over the odometer's 250 km. USD: 20 over bike2's 40 km.
  IF res -> 'cost_per_km' <> '[
      {"currency": "USD", "spend": 20.00, "expense_count": 1, "distance_m": 40000,
       "distance_source": "tracked", "cost_per_km": 0.5},
      {"currency": "EUR", "spend": 100.00, "expense_count": 2, "distance_m": 250000,
       "distance_source": "odometer", "cost_per_km": 0.4}]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: cost_per_km %', res -> 'cost_per_km';
  END IF;
END $$;

-- A rider whose profile currency is EUR gets EUR first.
DO $$
DECLARE first_currency text;
BEGIN
  UPDATE public.users SET currency = 'EUR' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
  SELECT public.rider_insights_season('aaaaaaaa-0000-0000-0000-000000000001',
           '2026-01-01', '2026-12-31', ARRAY[]::text[], 10) #>> '{cost_per_km,0,currency}'
    INTO first_currency;
  IF first_currency IS DISTINCT FROM 'EUR' THEN
    RAISE EXCEPTION 'FAIL: profile currency EUR should lead cost_per_km, got %', first_currency;
  END IF;
  UPDATE public.users SET currency = 'USD' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
END $$;

-- ---------------------------------------------------------------------------
-- rider_insights_season: every detail group.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  g jsonb := public.rider_insights_season(a, '2026-01-01', '2026-12-31',
    ARRAY['territory', 'road_character', 'rhythm', 'best_rides', 'bikes', 'countries'], 25) -> 'groups';
  keys text[];
  t jsonb := g -> 'territory';
  rc jsonb := g -> 'road_character';
  rh jsonb := g -> 'rhythm';
BEGIN
  SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(g) k;
  IF keys IS DISTINCT FROM ARRAY['best_rides', 'bikes', 'countries', 'rhythm', 'road_character', 'territory'] THEN
    RAISE EXCEPTION 'FAIL: group keys %', keys;
  END IF;
  SELECT array_agg(k ORDER BY k) INTO keys
  FROM jsonb_object_keys(public.rider_insights_season(a, '2026-01-01', '2026-12-31', ARRAY['rhythm'], 25) -> 'groups') k;
  IF keys IS DISTINCT FROM ARRAY['rhythm'] THEN
    RAISE EXCEPTION 'FAIL: one requested group returned %', keys;
  END IF;

  -- Territory. New road per qualifying ride: r1 all 20 km, r2 none (repeats r1),
  -- r3 50 of 100 cells of 40 km = 20 km, r4 5 of 10 cells of 15 km = 7.5 km
  -- (r8 rode the other 5 last year). 47.5 of 95 km is new.
  IF (t ->> 'explored_cells')::int <> 160
     OR (t ->> 'explored_km2')::numeric <> 16.85
     OR (t ->> 'new_road_m')::int <> 47500
     OR (t ->> 'routed_m')::int <> 95000
     OR (t ->> 'new_road_share')::numeric <> 0.5 THEN
    RAISE EXCEPTION 'FAIL: territory %', t;
  END IF;
  -- Home is start cell 1001 (r1, r2, r4, r8); its point is r4's start. The
  -- furthest point is r3's far end.
  IF t #>> '{furthest,ride_id}' <> 'a0000000-0000-0000-0000-000000000003'
     OR t #>> '{furthest,name}' IS DISTINCT FROM 'Danube run'
     OR (t #>> '{furthest,lng}')::numeric <> 16.5 OR (t #>> '{furthest,lat}')::numeric <> 48.5
     OR (t #>> '{furthest,distance_m}')::int NOT BETWEEN 60000 AND 66000 THEN
    RAISE EXCEPTION 'FAIL: furthest %', t -> 'furthest';
  END IF;

  -- Road character over r1, r2, r3 (r4 has no bands).
  IF rc -> 'band_km' <> '{"straight": 50, "sweeping": 20, "twisty": 8, "tight": 2}'::jsonb
     OR (rc ->> 'routed_km')::numeric <> 80
     OR (rc ->> 'bends_count')::int <> 72
     OR (rc ->> 'bends_per_10km')::numeric <> 9
     OR (rc ->> 'rides_with_bands')::int <> 3
     OR (rc ->> 'rides_with_lean')::int <> 3
     OR rc #>> '{twistiest,0,ride_id}' <> 'a0000000-0000-0000-0000-000000000001'
     OR (rc #>> '{twistiest,0,bends_per_10km}')::numeric <> 15
     OR rc #>> '{straightest,0,ride_id}' <> 'a0000000-0000-0000-0000-000000000003'
     OR rc -> 'lean' <> '{"corners": 50, "under20": 0.8, "from20to30": 0.12, "from30to40": 0.08, "from40": 0}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: road_character %', rc;
  END IF;

  -- Rhythm over the qualifying rides with stats (r1, r2 Sat morning; r3 Wed
  -- evening; r4 Wed morning).
  IF rh -> 'grid' <> '[[0,0,0,0],[0,0,0,0],[1,0,1,0],[0,0,0,0],[0,0,0,0],[2,0,0,0],[0,0,0,0]]'::jsonb
     OR (rh ->> 'rides')::int <> 4
     OR (rh ->> 'weekend_rides')::int <> 2
     OR (rh ->> 'weekend_share')::numeric <> 0.5
     OR (rh ->> 'median_distance_m')::numeric <> 20000
     OR (rh ->> 'median_moving_time_s')::numeric <> 2200
     OR (rh ->> 'rides_with_moving_time')::int <> 3 THEN
    RAISE EXCEPTION 'FAIL: rhythm %', rh;
  END IF;

  -- Best rides: qualifying only (no r5, no deleted r6).
  IF (g #>> '{best_rides,count}')::int <> 5
     OR g #>> '{best_rides,by_distance,0,ride_id}' <> 'a0000000-0000-0000-0000-000000000003'
     OR jsonb_array_length(g #> '{best_rides,by_distance}') <> 5
     OR g #>> '{best_rides,by_climb,0,ride_id}' <> 'a0000000-0000-0000-0000-000000000007'
     OR g #>> '{best_rides,by_bends,0,ride_id}' <> 'a0000000-0000-0000-0000-000000000001'
     OR jsonb_array_length(g #> '{best_rides,by_bends}') <> 3
     OR (g -> 'best_rides')::text LIKE '%a0000000-0000-0000-0000-000000000005%'
     OR (g -> 'best_rides')::text LIKE '%a0000000-0000-0000-0000-000000000006%' THEN
    RAISE EXCEPTION 'FAIL: best_rides %', g -> 'best_rides';
  END IF;

  -- Bikes: every completed ride; the ride without a bike is Unassigned (null id).
  IF g #> '{bikes,items}' <> '[
      {"motorcycle_id": "a1000000-0000-0000-0000-000000000001", "name": "Tenere", "rides": 4,
       "distance_m": 110000, "moving_time_s": 12800},
      {"motorcycle_id": "a1000000-0000-0000-0000-000000000002", "name": "Honda CB500X", "rides": 1,
       "distance_m": 40000, "moving_time_s": 3400},
      {"motorcycle_id": null, "name": null, "rides": 1, "distance_m": 15000, "moving_time_s": 1800}]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: bikes %', g -> 'bikes';
  END IF;

  -- Countries in order of first entry; r3's 40 km splits half and half.
  IF jsonb_array_length(g #> '{countries,items}') <> 2
     OR g #>> '{countries,items,0,iso_a2}' <> 'SK' OR g #>> '{countries,items,0,name}' <> 'Slovakia'
     OR g #>> '{countries,items,0,first_date}' <> '2026-05-02'
     OR g #>> '{countries,items,0,first_ride_id}' <> 'a0000000-0000-0000-0000-000000000001'
     OR (g #>> '{countries,items,0,rides}')::int <> 5
     OR abs((g #>> '{countries,items,0,distance_m}')::int - 135000) > 50
     OR g #>> '{countries,items,1,iso_a2}' <> 'AT' OR g #>> '{countries,items,1,first_date}' <> '2026-06-10'
     OR (g #>> '{countries,items,1,rides}')::int <> 1
     OR abs((g #>> '{countries,items,1,distance_m}')::int - 20000) > 50 THEN
    RAISE EXCEPTION 'FAIL: countries %', g -> 'countries';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ride_new_roads.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
BEGIN
  IF public.ride_new_roads(a, 'a0000000-0000-0000-0000-000000000001') <> 20000 THEN
    RAISE EXCEPTION 'FAIL: first ride new road %', public.ride_new_roads(a, 'a0000000-0000-0000-0000-000000000001');
  END IF;
  IF public.ride_new_roads(a, 'a0000000-0000-0000-0000-000000000002') <> 0 THEN
    RAISE EXCEPTION 'FAIL: a repeated ride has % m new road', public.ride_new_roads(a, 'a0000000-0000-0000-0000-000000000002');
  END IF;
  IF public.ride_new_roads(a, 'a0000000-0000-0000-0000-000000000003') <> 20000
     OR public.ride_new_roads(a, 'a0000000-0000-0000-0000-000000000004') <> 7500 THEN
    RAISE EXCEPTION 'FAIL: partly new rides % and %',
      public.ride_new_roads(a, 'a0000000-0000-0000-0000-000000000003'),
      public.ride_new_roads(a, 'a0000000-0000-0000-0000-000000000004');
  END IF;
  -- Pending (no stats row) and another rider's ride: null. Rider B's own ride
  -- is all new for B although A rode the same cells.
  IF public.ride_new_roads(a, 'a0000000-0000-0000-0000-000000000007') IS NOT NULL
     OR public.ride_new_roads('bbbbbbbb-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001') IS NOT NULL
     OR public.ride_new_roads('bbbbbbbb-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001') <> 30000 THEN
    RAISE EXCEPTION 'FAIL: ride_new_roads null cases';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Records before the deletion: qualifying rides only, with the previous best.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec jsonb := public.rider_personal_records('aaaaaaaa-0000-0000-0000-000000000001');
BEGIN
  IF NOT rec @> '[{"recordType": "longest_distance", "value": 40000, "unit": "m",
                   "rideId": "a0000000-0000-0000-0000-000000000003", "previousValue": 20000,
                   "achievedAt": "2026-06-10T16:00:00+00:00"}]'::jsonb
     OR NOT rec @> '[{"recordType": "top_speed", "value": 35, "unit": "mps",
                      "rideId": "a0000000-0000-0000-0000-000000000003", "previousValue": 30.5}]'::jsonb
     OR NOT rec @> '[{"recordType": "longest_duration", "value": 3600, "unit": "s",
                      "rideId": "a0000000-0000-0000-0000-000000000003", "previousValue": 2400}]'::jsonb
     OR NOT rec @> '[{"recordType": "max_elevation_gain", "value": 900, "unit": "m",
                      "rideId": "a0000000-0000-0000-0000-000000000007", "previousValue": 500}]'::jsonb
     OR jsonb_array_length(rec) <> 4
     OR rec::text LIKE '%a0000000-0000-0000-0000-000000000005%'
     OR rec::text LIKE '%a0000000-0000-0000-0000-000000000006%' THEN
    RAISE EXCEPTION 'FAIL: records %', rec;
  END IF;
  -- Newest achievement first.
  IF rec #>> '{0,rideId}' <> 'a0000000-0000-0000-0000-000000000007' THEN
    RAISE EXCEPTION 'FAIL: records order %', rec;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- No geometry, synthetic, and another rider.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  n jsonb := public.rider_insights_season('cccccccc-0000-0000-0000-000000000001', '2026-01-01', '2026-12-31',
    ARRAY['territory', 'road_character'], 25);
  s jsonb := public.rider_insights_season('dddddddd-0000-0000-0000-000000000001', '2026-01-01', '2026-12-31',
    ARRAY['territory'], 25);
BEGIN
  IF n -> 'totals' <> '{"rides": 3, "distance_m": 18000, "countries": 0}'::jsonb
     OR (n #>> '{coverage,qualifying,with_route}')::int <> 0
     OR (n #>> '{coverage,qualifying_rides}')::int <> 3
     OR n -> 'regions' <> '[]'::jsonb
     OR (n #>> '{groups,territory,explored_cells}')::int <> 0
     OR n #> '{groups,territory,new_road_share}' <> 'null'::jsonb
     OR n #> '{groups,territory,furthest}' <> 'null'::jsonb
     OR (n #>> '{groups,road_character,rides_with_bands}')::int <> 0
     OR n #> '{groups,road_character,bends_per_10km}' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FAIL: no-geometry rider %', n;
  END IF;
  IF s -> 'totals' <> '{"rides": 1, "distance_m": 25000, "countries": 1}'::jsonb
     OR (s #>> '{groups,territory,new_road_m}')::int <> 25000 THEN
    RAISE EXCEPTION 'FAIL: synthetic rider %', s;
  END IF;
  IF (public.rider_insights_season('bbbbbbbb-0000-0000-0000-000000000001', '2026-01-01', '2026-12-31', '{}', 25)
        #>> '{totals,rides}')::int <> 1 THEN
    RAISE EXCEPTION 'FAIL: rider B sees other riders'' rides';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- A deleted ride leaves the season totals and the records.
-- ---------------------------------------------------------------------------
RESET ROLE;
UPDATE public.rides SET deleted_at = now() WHERE id = 'a0000000-0000-0000-0000-000000000003';
SET LOCAL ROLE service_role;

DO $$
DECLARE
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  res jsonb := public.rider_insights_season(a, '2026-01-01', '2026-12-31', ARRAY['best_rides', 'countries'], 25);
  rec jsonb := public.rider_personal_records(a);
BEGIN
  IF res -> 'totals' <> '{"rides": 5, "distance_m": 125000, "countries": 1}'::jsonb
     OR res::text LIKE '%a0000000-0000-0000-0000-000000000003%' THEN
    RAISE EXCEPTION 'FAIL: deleted ride still in the season %', res -> 'totals';
  END IF;
  -- r1 and r2 tie at 20 km: the earlier one holds it; last year's 5 km was the
  -- previous best.
  IF NOT rec @> '[{"recordType": "longest_distance", "value": 20000,
                   "rideId": "a0000000-0000-0000-0000-000000000001", "previousValue": 5000}]'::jsonb
     OR rec::text LIKE '%a0000000-0000-0000-0000-000000000003%' THEN
    RAISE EXCEPTION 'FAIL: deleted ride still in the records %', rec;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- rider_ride_overview: shape, time-zone day buckets, deletion, streak.
-- Rider O in UTC+2 (Etc/GMT-2 has no daylight saving):
--   o1 yesterday 23:30 local (21:30 UTC, same day) 12 km, 30 min, "Duke"
--   o2 yesterday 01:00 local (23:00 UTC the day before) 8 km, 20 min
--   o3 eight days ago 12:00 local, 10 km, 25 min
--   o4 yesterday, deleted, 50 km
-- ---------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.seed_user('eeeeeeee-0000-0000-0000-000000000001');
INSERT INTO public.motorcycles (id, user_id, make, model, nickname) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'KTM', '890 Duke', 'Duke');
SELECT pg_temp.seed_ride('e0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  (((now() AT TIME ZONE 'Etc/GMT-2')::date - 1) + time '23:30') AT TIME ZONE 'Etc/GMT-2', 30, 12000,
  '{"max_speed_mps": 25}');
SELECT pg_temp.seed_ride('e0000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  (((now() AT TIME ZONE 'Etc/GMT-2')::date - 1) + time '01:00') AT TIME ZONE 'Etc/GMT-2', 20, 8000);
SELECT pg_temp.seed_ride('e0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  (((now() AT TIME ZONE 'Etc/GMT-2')::date - 8) + time '12:00') AT TIME ZONE 'Etc/GMT-2', 25, 10000);
SELECT pg_temp.seed_ride('e0000000-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  (((now() AT TIME ZONE 'Etc/GMT-2')::date - 1) + time '12:00') AT TIME ZONE 'Etc/GMT-2', 120, 50000,
  jsonb_build_object('deleted_at', now()));
INSERT INTO public.ride_summaries (ride_id, summary_text)
VALUES ('e0000000-0000-0000-0000-000000000001', 'Evening loop');

-- Rider K: rides this week, 1 and 2 weeks ago, and 4 weeks ago: a 3-week streak.
SELECT pg_temp.seed_user('ffffffff-0000-0000-0000-000000000001');
SELECT pg_temp.seed_ride(gen_random_uuid(), 'ffffffff-0000-0000-0000-000000000001', NULL,
  (((now() AT TIME ZONE 'UTC')::date - d) + time '00:00:01') AT TIME ZONE 'UTC', 20, 5000)
FROM unnest(ARRAY[0, 7, 14, 28]) d;

SET LOCAL ROLE service_role;

DO $$
DECLARE
  o uuid := 'eeeeeeee-0000-0000-0000-000000000001';
  today date := (now() AT TIME ZONE 'Etc/GMT-2')::date;
  ov jsonb := public.rider_ride_overview(o, 'Etc/GMT-2');
  ov_utc jsonb := public.rider_ride_overview(o, 'UTC');
  keys text[];
  day_m int;
BEGIN
  SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(ov) k;
  IF keys IS DISTINCT FROM ARRAY['currentStreak', 'dailyDistances', 'last30Days', 'last7Days', 'lastRide',
                                 'personalRecords', 'thisMonth', 'thisWeek'] THEN
    RAISE EXCEPTION 'FAIL: overview keys %', keys;
  END IF;
  SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(ov -> 'lastRide') k;
  IF keys IS DISTINCT FROM ARRAY['date', 'distanceM', 'durationS', 'id', 'maxSpeedMps', 'motorcycleName',
                                 'summaryTitle'] THEN
    RAISE EXCEPTION 'FAIL: lastRide keys %', keys;
  END IF;
  IF ov #>> '{lastRide,id}' <> 'e0000000-0000-0000-0000-000000000001'
     OR (ov #>> '{lastRide,distanceM}')::int <> 12000
     OR (ov #>> '{lastRide,durationS}')::int <> 1800
     OR (ov #>> '{lastRide,maxSpeedMps}')::numeric <> 25
     OR ov #>> '{lastRide,motorcycleName}' <> 'Duke'
     OR ov #>> '{lastRide,summaryTitle}' <> 'Evening loop' THEN
    RAISE EXCEPTION 'FAIL: lastRide %', ov -> 'lastRide';
  END IF;
  IF ov -> 'last7Days' <> '{"rideCount": 2, "distanceM": 20000, "durationS": 3000}'::jsonb
     OR ov -> 'last30Days' <> '{"rideCount": 3, "distanceM": 30000, "durationS": 4500}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: periods % %', ov -> 'last7Days', ov -> 'last30Days';
  END IF;
  IF jsonb_array_length(ov -> 'dailyDistances') <> 14
     OR ov #>> '{dailyDistances,13,date}' <> today::text
     OR ov #>> '{dailyDistances,0,date}' <> (today - 13)::text THEN
    RAISE EXCEPTION 'FAIL: dailyDistances span %', ov -> 'dailyDistances';
  END IF;
  -- Both of yesterday's rides count on yesterday's local date, none on the day before.
  SELECT (e ->> 'distanceM')::int INTO day_m FROM jsonb_array_elements(ov -> 'dailyDistances') e
  WHERE e ->> 'date' = (today - 1)::text;
  IF day_m IS DISTINCT FROM 20000 THEN
    RAISE EXCEPTION 'FAIL: local day % has % m, expected 20000', today - 1, day_m;
  END IF;
  SELECT (e ->> 'distanceM')::int INTO day_m FROM jsonb_array_elements(ov -> 'dailyDistances') e
  WHERE e ->> 'date' = (today - 2)::text;
  IF day_m IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'FAIL: local day % has % m, expected 0', today - 2, day_m;
  END IF;
  -- In UTC the 01:00-local ride falls on the day before.
  SELECT (e ->> 'distanceM')::int INTO day_m FROM jsonb_array_elements(ov_utc -> 'dailyDistances') e
  WHERE e ->> 'date' = (today - 2)::text;
  IF day_m IS DISTINCT FROM 8000 THEN
    RAISE EXCEPTION 'FAIL: UTC day % has % m, expected 8000', today - 2, day_m;
  END IF;
  IF ov -> 'personalRecords' <> public.rider_personal_records(o) THEN
    RAISE EXCEPTION 'FAIL: overview records differ from rider_personal_records';
  END IF;
  IF (public.rider_ride_overview('ffffffff-0000-0000-0000-000000000001', 'UTC') ->> 'currentStreak')::int <> 3 THEN
    RAISE EXCEPTION 'FAIL: streak %', public.rider_ride_overview('ffffffff-0000-0000-0000-000000000001', 'UTC') ->> 'currentStreak';
  END IF;
  IF (public.rider_ride_overview('cccccccc-0000-0000-0000-000000000001', 'UTC') ->> 'currentStreak')::int <> 0 THEN
    RAISE EXCEPTION 'FAIL: a rider without recent rides has a streak';
  END IF;
  IF public.rider_ride_overview(gen_random_uuid(), NULL) <> jsonb_build_object(
       'lastRide', NULL,
       'last7Days', '{"rideCount": 0, "distanceM": 0, "durationS": 0}'::jsonb,
       'last30Days', '{"rideCount": 0, "distanceM": 0, "durationS": 0}'::jsonb,
       'thisWeek', '{"rideCount": 0, "distanceM": 0, "durationS": 0}'::jsonb,
       'thisMonth', '{"rideCount": 0, "distanceM": 0, "durationS": 0}'::jsonb,
       'dailyDistances', (SELECT jsonb_agg(jsonb_build_object('date', d::date::text, 'distanceM', 0) ORDER BY d)
                          FROM generate_series((now() AT TIME ZONE 'UTC')::date - 13,
                                               (now() AT TIME ZONE 'UTC')::date, interval '1 day') d),
       'currentStreak', 0,
       'personalRecords', '[]'::jsonb) THEN
    RAISE EXCEPTION 'FAIL: overview of a rider with no rides %', public.rider_ride_overview(gen_random_uuid(), NULL);
  END IF;
END $$;

RESET ROLE;
UPDATE public.rides SET deleted_at = now() WHERE id = 'e0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE service_role;

DO $$
DECLARE
  ov jsonb := public.rider_ride_overview('eeeeeeee-0000-0000-0000-000000000001', 'Etc/GMT-2');
BEGIN
  IF ov -> 'last7Days' <> '{"rideCount": 1, "distanceM": 8000, "durationS": 1200}'::jsonb
     OR ov #>> '{lastRide,id}' <> 'e0000000-0000-0000-0000-000000000002'
     OR ov::text LIKE '%e0000000-0000-0000-0000-000000000001%' THEN
    RAISE EXCEPTION 'FAIL: deleted ride still in the overview %', ov;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Heavy synthetic rider: 1,500 rides with stats and 200-point tracks.
-- ---------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.seed_user('99999999-0000-0000-0000-000000000001', true);
INSERT INTO public.motorcycles (id, user_id, make, model, distance_unit)
SELECT ('91000000-0000-0000-0000-00000000000' || b)::uuid, '99999999-0000-0000-0000-000000000001', 'Make', 'Model ' || b, 'km'
FROM generate_series(1, 3) b;

INSERT INTO public.rides (id, user_id, motorcycle_id, status, started_at, ended_at, distance_m, name)
SELECT
  ('90000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  '99999999-0000-0000-0000-000000000001',
  ('91000000-0000-0000-0000-00000000000' || (i % 3 + 1))::uuid,
  'completed',
  '2026-01-01T06:00:00Z'::timestamptz + i * interval '5 hours',
  '2026-01-01T06:00:00Z'::timestamptz + i * interval '5 hours' + interval '75 minutes',
  30000 + (i % 17) * 1000,
  'Ride ' || i
FROM generate_series(1, 1500) i;

INSERT INTO public.ride_stats (ride_id, user_id, motorcycle_id, stats_version, input_source, wp_count,
  wp_truncated, time_zone, local_date, local_start_hour, local_dow, distance_m, elapsed_s,
  moving_time_s, max_speed_mps, climb_m, bends_count, bends_per_km, band_km, lean_bands,
  countries, start_region, start_cell, cells)
SELECT r.id, r.user_id, r.motorcycle_id, 1, 'waypoints', 2000, false, 'Europe/Bratislava',
  (r.started_at AT TIME ZONE 'Europe/Bratislava')::date,
  extract(hour FROM r.started_at AT TIME ZONE 'Europe/Bratislava')::int,
  extract(isodow FROM r.started_at AT TIME ZONE 'Europe/Bratislava')::int,
  r.distance_m, 4500, 4000, 30 + (n % 10), 200 + (n % 300), 40 + (n % 30), (40 + (n % 30)) / 30.0,
  jsonb_build_object('straight', 15, 'sweeping', 8, 'twisty', 5, 'tight', 2),
  jsonb_build_object('corners', 40, 'under20', 0.6, 'from20to30', 0.25, 'from30to40', 0.1, 'from40', 0.05),
  CASE WHEN n % 50 = 0 THEN ARRAY['SK', 'AT'] ELSE ARRAY['SK'] END,
  'SK.0' || (n % 6), 600000000000000000 + (n % 7),
  ARRAY(SELECT 600000000000000000 + (n % 40) * 150 + g FROM generate_series(1, 300) g)
FROM (SELECT r.*, row_number() OVER (ORDER BY r.started_at) AS n
      FROM public.rides r WHERE r.user_id = '99999999-0000-0000-0000-000000000001') r;

INSERT INTO public.ride_tracks (ride_id, user_id, source, route, stats_version)
SELECT r.id, r.user_id, 'waypoints',
  (SELECT public.ST_MakeLine(public.ST_SetSRID(public.ST_MakePoint(
            17.05 + (r.n % 10) * 0.01 + g * 0.002, 48.1 + sin(g / 8.0) * 0.01 + (r.n % 5) * 0.01), 4326)
          ORDER BY g)
   FROM generate_series(1, 200) g),
  1
FROM (SELECT r.*, row_number() OVER (ORDER BY r.started_at) AS n
      FROM public.rides r WHERE r.user_id = '99999999-0000-0000-0000-000000000001') r;

INSERT INTO public.expenses (user_id, motorcycle_id, amount, currency, category, date)
SELECT '99999999-0000-0000-0000-000000000001', ('91000000-0000-0000-0000-00000000000' || (i % 3 + 1))::uuid,
  20 + i % 30, CASE WHEN i % 4 = 0 THEN 'USD' ELSE 'EUR' END, 'fuel', '2026-01-01'::date + (i % 300)
FROM generate_series(1, 200) i;

ANALYZE public.rides;
ANALYZE public.ride_stats;
ANALYZE public.ride_tracks;
ANALYZE public.expenses;
ANALYZE public.odometer_readings;

SET LOCAL ROLE service_role;

DO $$
DECLARE
  h uuid := '99999999-0000-0000-0000-000000000001';
  plan json;
  ms numeric;
  label text;
  stmt text;
BEGIN
  IF (public.rider_insights_season(h, '2026-01-01', '2026-12-31', '{}', 25) #>> '{totals,rides}')::int <> 1500 THEN
    RAISE EXCEPTION 'FAIL: heavy rider totals';
  END IF;
  FOR label, stmt IN
    SELECT * FROM (VALUES
      ('rider_insights_season, all groups',
       $q$SELECT public.rider_insights_season($1, '2026-01-01', '2026-12-31',
            ARRAY['territory', 'road_character', 'rhythm', 'best_rides', 'bikes', 'countries'], 25)$q$),
      ('rider_insights_season, free blocks only',
       $q$SELECT public.rider_insights_season($1, '2026-01-01', '2026-12-31', '{}', 25)$q$),
      ('rider_ride_overview', $q$SELECT public.rider_ride_overview($1, 'Europe/Bratislava')$q$),
      ('rider_personal_records', $q$SELECT public.rider_personal_records($1)$q$),
      ('ride_new_roads (latest ride)',
       $q$SELECT public.ride_new_roads($1, '90000000-0000-0000-0000-000000001500')$q$)
    ) AS t (label, stmt)
  LOOP
    -- The first run warms caches; the second is the one reported.
    EXECUTE 'EXPLAIN (ANALYZE, FORMAT JSON) ' || stmt INTO plan USING h;
    EXECUTE 'EXPLAIN (ANALYZE, FORMAT JSON) ' || stmt INTO plan USING h;
    ms := (plan -> 0 ->> 'Execution Time')::numeric;
    RAISE NOTICE 'heavy rider (1,500 rides): % took % ms', label, round(ms, 1);
    IF ms > 20000 THEN
      RAISE EXCEPTION 'FAIL: % took % ms on the heavy rider', label, ms;
    END IF;
  END LOOP;
END $$;

RESET ROLE;

ROLLBACK;
