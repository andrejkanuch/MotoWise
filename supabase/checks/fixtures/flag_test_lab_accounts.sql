-- Fixture for checks/flag_test_lab_accounts.sql in the DISPOSABLE container
-- that run.sh starts. Never run this anywhere else: it creates a minimal
-- public.users (id, email, is_synthetic) and applies 00201.
--
-- On a real Supabase database skip this file: public.users already exists and
-- 00201 is applied by the normal migration path.

\set ON_ERROR_STOP on
\set QUIET on

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    RAISE EXCEPTION 'public.users already exists: this fixture only runs on an empty throwaway database';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;

CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT false
);

\i /supabase/migrations/00201_flag_google_test_lab_accounts.sql
