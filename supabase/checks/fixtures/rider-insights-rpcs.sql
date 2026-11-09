-- Fixture for checks/rider-insights-rpcs.sql in the DISPOSABLE container that
-- run.sh starts (postgis/postgis image). Never run this anywhere else: it
-- creates a stand-in `auth` schema, `cron.schedule`, and minimal public.users,
-- motorcycles, rides, ride_waypoints, ride_summaries and expenses, then applies
-- 00048, 00181, 00197 and 00199.
--
-- On a real Supabase database (local stack or prod) skip this file: those
-- already have the real tables, and the migrations are applied by the normal
-- migration path.
--
-- What it reproduces from Supabase and earlier migrations, because the check
-- depends on it:
--   * the anon / authenticated / service_role roles and Supabase's default
--     privileges, which grant ALL on new tables and EXECUTE on new functions to
--     all three, so 00199's REVOKEs are exercised;
--   * auth.uid() reading the `sub` of request.jwt.claims;
--   * public.users with 00178's column grants (00197 adds is_synthetic);
--   * public.rides with the 00047 columns the insight reads use (name, pauses,
--     max speed, elevation gain) and 00173's auto_ended_reason, plus 00084's
--     visibility read policy;
--   * public.ride_summaries (00058) and public.expenses (00036, 00154 categories,
--     00194 currencies), the other tables the overview and cost reads touch;
--   * public.motorcycles with nickname and the odometer columns 00078/00180 add,
--     so 00181's odometer log, RPC and trigger apply as written;
--   * PostGIS in public, as 00064 created it.

\set ON_ERROR_STOP on
\set QUIET on

DO $$
BEGIN
  IF to_regclass('public.rides') IS NOT NULL OR to_regnamespace('auth') IS NOT NULL THEN
    RAISE EXCEPTION 'rides/auth already exist: this fixture only runs on an empty throwaway database';
  END IF;
END $$;

BEGIN;

DO $$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;
ALTER ROLE service_role BYPASSRLS;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text
);

-- Supabase's definition.
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- 00048 schedules its purge through pg_cron; the container has no pg_cron.
CREATE SCHEMA cron;
CREATE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint
LANGUAGE sql AS $$ SELECT 1::bigint $$;

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  display_name text,
  handle text,
  role text NOT NULL DEFAULT 'user',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own data" ON public.users
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users update own data" ON public.users
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- 00178: column grants are the privacy boundary.
REVOKE ALL ON public.users FROM authenticated, anon;
GRANT SELECT (id, handle, display_name, is_public, created_at) ON public.users TO authenticated, anon;
GRANT UPDATE (full_name, display_name, handle, is_public) ON public.users TO authenticated;

CREATE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
$$;

-- 00003's shared trigger function.
CREATE FUNCTION public.update_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE public.motorcycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  make text NOT NULL,
  model text NOT NULL,
  current_mileage integer NOT NULL DEFAULT 0,
  mileage_updated_at timestamptz,
  odometer_sync_source text NOT NULL DEFAULT 'manual'
    CHECK (odometer_sync_source IN ('manual', 'gps_ride')),
  odometer_last_ride_id uuid,
  distance_unit text NOT NULL DEFAULT 'km',
  nickname text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.motorcycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own motorcycles" ON public.motorcycles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- 00047 columns the check and the migrations touch, plus 00173's auto_ended_reason.
CREATE TABLE public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  motorcycle_id uuid REFERENCES public.motorcycles (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'paused', 'completed')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  paused_duration_s integer NOT NULL DEFAULT 0,
  auto_paused_duration_s integer NOT NULL DEFAULT 0,
  distance_m integer,
  max_speed_mps real,
  elevation_gain real,
  name text,
  route_polyline text,
  region text,
  weather_snapshot jsonb,
  mileage_applied boolean NOT NULL DEFAULT false,
  auto_ended_reason text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- 00084's policy without the ride_shares branch (no table here).
CREATE POLICY "rides_select_with_visibility" ON public.rides
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      user_id = (SELECT auth.uid())
      OR visibility = 'public'
      OR visibility = 'unlisted'
      OR public.is_admin()
    )
  );

CREATE POLICY "Enable update for ride owner" ON public.rides
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.ride_waypoints (
  ride_id uuid NOT NULL REFERENCES public.rides (id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  altitude real,
  speed_mps real,
  heading real,
  lean_angle real,
  accuracy real,
  PRIMARY KEY (ride_id, recorded_at)
);

ALTER TABLE public.ride_waypoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for ride owner" ON public.ride_waypoints
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ride_waypoints.ride_id
        AND rides.user_id = auth.uid()
        AND rides.deleted_at IS NULL
    )
    OR public.is_admin()
  );

-- 00058, the columns the overview reads.
CREATE TABLE public.ride_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL UNIQUE REFERENCES public.rides (id) ON DELETE CASCADE,
  summary_text text
);

-- 00036 with 00154's categories; the cost-per-km read uses these columns.
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles (id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  category text NOT NULL CHECK (category IN (
    'fuel', 'maintenance', 'parts', 'tires', 'gear', 'accessories',
    'modifications', 'insurance', 'registration', 'taxes_fees',
    'tolls', 'parking', 'training', 'other')),
  date date NOT NULL,
  deleted_at timestamptz
);

COMMIT;

\ir ../../migrations/00048_purge_soft_deleted_rides.sql
\ir ../../migrations/00181_odometer_readings.sql
\ir ../../migrations/00197_rider_insights_schema.sql
\ir ../../migrations/00199_rider_insights_rpcs.sql
