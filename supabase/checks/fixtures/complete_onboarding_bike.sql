-- Fixture for checks/complete_onboarding_bike.sql in the DISPOSABLE container
-- that run.sh starts. Never run this anywhere else: it creates a stand-in
-- `auth` schema and minimal public.users / public.motorcycles, then applies
-- 00191.
--
-- On a real Supabase database (local stack or prod) skip this file: those
-- already have the schema, and 00191 is applied by the normal migration path.
--
-- What it reproduces from Supabase, because the check depends on it:
--   * the authenticated role, and auth.uid() reading the `sub` of
--     request.jwt.claims (the function's ownership check);
--   * the columns complete_onboarding reads and writes, with prod's NOT NULL
--     constraints (motorcycles.model is NOT NULL: the reason a make-only bike
--     is stored with an empty model);
--   * distance_unit, which prod's trg_motorcycles_default_distance_unit fills;
--     a column default stands in for that trigger here.

\set ON_ERROR_STOP on
\set QUIET on

DO $$
BEGIN
  IF to_regclass('public.motorcycles') IS NOT NULL OR to_regnamespace('auth') IS NOT NULL THEN
    RAISE EXCEPTION 'motorcycles/auth already exist: this fixture only runs on an empty throwaway database';
  END IF;
END $$;

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  aud text,
  role text,
  raw_user_meta_data jsonb
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

CREATE TYPE public.user_role AS ENUM ('user', 'admin');
CREATE TYPE public.motorcycle_type AS ENUM (
  'cruiser', 'sportbike', 'standard', 'touring', 'dual_sport', 'dirt_bike', 'scooter', 'other'
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role public.user_role NOT NULL DEFAULT 'user',
  preferences jsonb DEFAULT '{}'::jsonb,
  onboarding_completed_at timestamptz,
  currency text NOT NULL DEFAULT 'USD'
);

CREATE TABLE public.motorcycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL CHECK (year >= 1900),
  type public.motorcycle_type DEFAULT 'other',
  current_mileage integer DEFAULT 0,
  nickname text,
  is_primary boolean NOT NULL DEFAULT false,
  primary_photo_url text,
  mileage_unit varchar DEFAULT 'mi',
  distance_unit text NOT NULL DEFAULT 'mi',
  metadata jsonb DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;

\i /supabase/migrations/00191_complete_onboarding_make_only_bike.sql

GRANT EXECUTE ON FUNCTION public.complete_onboarding TO authenticated;
