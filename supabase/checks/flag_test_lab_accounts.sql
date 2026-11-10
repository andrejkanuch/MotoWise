-- Repeatable check for the Test Lab robot flag
-- (migrations/00201_flag_google_test_lab_accounts.sql):
--   * a new user on @cloudtestlabaccounts.com (any letter case) is synthetic;
--   * a new ordinary user is not;
--   * a user with no email is not, and the insert still works;
--   * an insert that already says synthetic stays synthetic.
--
-- SAFE ON A REAL DATABASE. Everything runs in ONE transaction that ends in
-- ROLLBACK, so the throwaway rows never persist. It uses no psql meta-commands:
--   * disposable container: supabase/checks/run.sh flag_test_lab_accounts.sql
--   * prod: send the file as-is to the Management API query endpoint (runs as
--     postgres; public.users has foreign keys there, so the check inserts into
--     auth.users first only when that schema exists). A 2xx with `[]` = pass.

BEGIN;

DO $$
DECLARE
  has_auth boolean := to_regclass('auth.users') IS NOT NULL;
  ids uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  emails text[] := ARRAY['abc-lvl-00@CloudTestLabAccounts.com', 'rider@gmail.com', NULL, 'demo@motovault.app'];
  i int;
BEGIN
  FOR i IN 1..4 LOOP
    IF has_auth THEN
      -- On Supabase, handle_new_user inserts the public.users row.
      EXECUTE 'INSERT INTO auth.users (id, email, aud, role) VALUES ($1, $2, ''authenticated'', ''authenticated'')'
        USING ids[i], emails[i];
    ELSE
      INSERT INTO public.users (id, email) VALUES (ids[i], emails[i]);
    END IF;
  END LOOP;
  UPDATE public.users SET is_synthetic = true WHERE id = ids[4];

  IF NOT (SELECT is_synthetic FROM public.users WHERE id = ids[1]) THEN
    RAISE EXCEPTION 'FAIL: Test Lab account was not flagged synthetic';
  END IF;
  IF (SELECT is_synthetic FROM public.users WHERE id = ids[2]) THEN
    RAISE EXCEPTION 'FAIL: ordinary account was flagged synthetic';
  END IF;
  IF (SELECT is_synthetic FROM public.users WHERE id = ids[3]) THEN
    RAISE EXCEPTION 'FAIL: account without email was flagged synthetic';
  END IF;
  IF NOT (SELECT is_synthetic FROM public.users WHERE id = ids[4]) THEN
    RAISE EXCEPTION 'FAIL: an explicitly synthetic account lost its flag';
  END IF;
END $$;

ROLLBACK;
