-- Fixture for checks/recall_acknowledgements_rls.sql in the DISPOSABLE
-- container that run.sh starts. Never run this anywhere else: it creates a
-- stand-in `auth` schema and a minimal public.motorcycles, then applies 00189.
--
-- On a real Supabase database (local stack or prod) skip this file: those
-- already have auth.users, auth.uid() and public.motorcycles, and 00189 is
-- applied by the normal migration path.
--
-- What it reproduces from Supabase, because the check depends on it:
--   * the anon / authenticated / service_role roles;
--   * the default privileges that GRANT ALL on new public tables to them
--     (so 00189's REVOKE is actually exercised);
--   * auth.uid() reading the `sub` of request.jwt.claims;
--   * public.motorcycles with the owner-only, live-bike SELECT policy (00025),
--     which the INSERT policy's EXISTS subquery runs under.

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
  email text,
  aud text,
  role text
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

CREATE TABLE public.motorcycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  distance_unit text NOT NULL,
  deleted_at timestamptz
);

ALTER TABLE public.motorcycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own motorcycles" ON public.motorcycles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

COMMIT;

\ir ../../migrations/00189_recall_acknowledgements.sql
