-- Fixture for checks/expense_cost_trend.sql in the DISPOSABLE container that
-- run.sh starts. Never run this anywhere else: it creates a stand-in `auth`
-- schema and minimal public tables, then applies 00203.
--
-- On a real Supabase database (local stack or prod) skip this file: those
-- already have the full schema, and 00203 is applied by the normal migration
-- path.
--
-- What it reproduces from Supabase and earlier migrations, because the check
-- depends on it:
--   * the anon / authenticated / service_role roles and Supabase's default
--     privileges, which grant ALL on new tables and EXECUTE on new functions to
--     all three, so 00203's REVOKE is exercised;
--   * auth.uid() reading the `sub` of request.jwt.claims;
--   * public.expenses with the columns the read uses and 00036's
--     `Users read own expenses` SELECT policy.

\set ON_ERROR_STOP on
\set QUIET on

DO $$
BEGIN
  IF to_regclass('public.expenses') IS NOT NULL OR to_regnamespace('auth') IS NOT NULL THEN
    RAISE EXCEPTION 'expenses/auth already exist: this fixture only runs on an empty throwaway database';
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
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Supabase's definition.
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- 00036 with 00194's currency column; no foreign keys, they are not under test.
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  motorcycle_id uuid NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  category text NOT NULL DEFAULT 'fuel',
  date date NOT NULL,
  deleted_at timestamptz
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

COMMIT;

\ir ../../migrations/00203_expense_cost_trend.sql
