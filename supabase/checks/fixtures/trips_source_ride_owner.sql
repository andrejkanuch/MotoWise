-- Fixture for checks/trips_source_ride_owner.sql in the DISPOSABLE container
-- that run.sh starts. Never run this anywhere else: it creates a stand-in
-- `auth` schema and minimal public.rides / public.trips, then applies 00192 and
-- 00193.
--
-- On a real Supabase database (local stack or prod) skip this file: those
-- already have the real tables, and both migrations are applied by the normal
-- migration path.
--
-- What it reproduces from Supabase and earlier migrations, because the check
-- depends on it:
--   * the anon / authenticated / service_role roles and Supabase's default
--     table grants;
--   * auth.uid() reading the `sub` of request.jwt.claims;
--   * public.rides with its owner-only SELECT policy, so the trigger must see
--     past the caller's RLS (it is SECURITY DEFINER);
--   * public.trips with the trips_insert (00072) and trips_update (00085)
--     policies, which check organiser_user_id and nothing about the ride.

\set ON_ERROR_STOP on
\set QUIET on

DO $$
BEGIN
  IF to_regclass('public.trips') IS NOT NULL OR to_regnamespace('auth') IS NOT NULL THEN
    RAISE EXCEPTION 'trips/auth already exist: this fixture only runs on an empty throwaway database';
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

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

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

CREATE TABLE public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'recording',
  deleted_at timestamptz
);

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_select_own ON public.rides
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND deleted_at IS NULL);

CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organiser_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  difficulty text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_template boolean NOT NULL DEFAULT false
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY trips_select ON public.trips
  FOR SELECT TO authenticated
  USING (organiser_user_id = (SELECT auth.uid()));

CREATE POLICY trips_insert ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (organiser_user_id = (SELECT auth.uid()));

CREATE POLICY trips_update ON public.trips
  FOR UPDATE TO authenticated
  USING (organiser_user_id = (SELECT auth.uid()))
  WITH CHECK (organiser_user_id = (SELECT auth.uid()));

COMMIT;

\ir ../../migrations/00192_trips_source_ride_id.sql
\ir ../../migrations/00193_trips_source_ride_owner_check.sql
