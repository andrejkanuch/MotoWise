-- Migration: 00201_flag_google_test_lab_accounts
-- Google Play's pre-launch report runs every upload on Firebase Test Lab
-- devices. Their robots sign in with Google accounts on the
-- cloudtestlabaccounts.com domain (shown as "Nuage Laboratoire") and create
-- real-looking users, rides included. This marks such accounts as synthetic
-- the moment their public.users row is created, so they stay out of stats and
-- rollups the same way the demo accounts do (users.is_synthetic, 00197).
-- Owner request 2026-11-10; the two existing robot accounts were flagged by hand
-- the same day.
--
-- A separate BEFORE INSERT trigger, so handle_new_user (the auth.users trigger
-- that inserts the row) stays untouched. The column default stays false; the
-- trigger only ever turns the flag on.
--
-- PREREQUISITES: 00197 applied (users.is_synthetic).
-- DEPLOY ORDER: independent of API and app.
-- Apply as ONE statement batch (one Management API call) with this leading
-- comment block stripped, record version 00201 in
-- supabase_migrations.schema_migrations, then run the footer query.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_users_flag_test_lab ON public.users;
--   DROP FUNCTION IF EXISTS public.flag_test_lab_user();

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.flag_test_lab_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF lower(NEW.email) LIKE '%@cloudtestlabaccounts.com' THEN
    NEW.is_synthetic := true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.flag_test_lab_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_users_flag_test_lab ON public.users;
CREATE TRIGGER trg_users_flag_test_lab
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.flag_test_lab_user();

COMMENT ON FUNCTION public.flag_test_lab_user() IS
  'Marks Firebase Test Lab robot sign-ups (Google Play pre-launch report) as synthetic.';

COMMIT;

-- Footer check (expect trigger_exists = true, unflagged_robots = 0):
--   SELECT
--     EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_flag_test_lab'
--             AND tgrelid = 'public.users'::regclass) AS trigger_exists,
--     (SELECT count(*) FROM public.users
--      WHERE lower(email) LIKE '%@cloudtestlabaccounts.com' AND NOT is_synthetic) AS unflagged_robots;
