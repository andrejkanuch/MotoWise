-- Repeatable check for the Test Lab robot flag
-- (migrations/00201_flag_google_test_lab_accounts.sql):
--   * a new user on @cloudtestlabaccounts.com (any letter case) is synthetic;
--   * a new ordinary user is not, nor are look-alike domains
--     (a subdomain, or the domain followed by more labels);
--   * on a plain insert (no auth schema), a row inserted already synthetic
--     stays synthetic.
--
-- SAFE ON A REAL DATABASE. Everything runs in ONE transaction that ends in
-- ROLLBACK, so the throwaway rows never persist. Every address is built from a
-- fresh uuid on reserved domains, so it cannot collide with a real account.
-- It uses no psql meta-commands:
--   * disposable container: supabase/checks/run.sh flag_test_lab_accounts.sql
--   * prod: send the file as-is to the Management API query endpoint (runs as
--     postgres). There it inserts into auth.users, and handle_new_user creates
--     the public.users rows, which is the real sign-up path. A 2xx with `[]` = pass.

BEGIN;

DO $$
DECLARE
  has_auth boolean := to_regclass('auth.users') IS NOT NULL;
  -- expected is_synthetic after a plain sign-up insert, per email
  cases text[][] := ARRAY[
    ARRAY['robot-%s-lvl-00@CloudTestLabAccounts.com', 'true'],
    ARRAY['robot-%s@cloudtestlabaccounts.com',        'true'],
    ARRAY['rider-%s@example.invalid',                 'false'],
    ARRAY['rider-%s@sub.cloudtestlabaccounts.com',    'false'],
    ARRAY['rider-%s@cloudtestlabaccounts.com.example.invalid', 'false']
  ];
  uid uuid;
  addr text;
  got boolean;
  i int;
BEGIN
  FOR i IN 1..array_length(cases, 1) LOOP
    uid := gen_random_uuid();
    addr := format(cases[i][1], uid);
    IF has_auth THEN
      -- On Supabase, handle_new_user inserts the public.users row.
      EXECUTE 'INSERT INTO auth.users (id, email, aud, role) VALUES ($1, $2, ''authenticated'', ''authenticated'')'
        USING uid, addr;
    ELSE
      INSERT INTO public.users (id, email) VALUES (uid, addr);
    END IF;

    SELECT is_synthetic INTO got FROM public.users WHERE id = uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FAIL: no public.users row created for %', addr;
    END IF;
    IF got IS DISTINCT FROM cases[i][2]::boolean THEN
      RAISE EXCEPTION 'FAIL: % got is_synthetic = %, expected %', addr, got, cases[i][2];
    END IF;
  END LOOP;

  -- The trigger only ever turns the flag on. Only testable where the row is
  -- inserted directly; handle_new_user never passes the flag.
  IF NOT has_auth THEN
    uid := gen_random_uuid();
    INSERT INTO public.users (id, email, is_synthetic)
      VALUES (uid, format('demo-%s@example.invalid', uid), true);
    IF NOT (SELECT is_synthetic FROM public.users WHERE id = uid) THEN
      RAISE EXCEPTION 'FAIL: a row inserted as synthetic lost its flag';
    END IF;
  END IF;
END $$;

ROLLBACK;
