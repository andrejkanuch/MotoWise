-- Repeatable check for the trips.source_ride_id ownership trigger
-- (migrations/00193_trips_source_ride_owner_check.sql) and the
-- one-template-per-ride index it guards (00192).
--
-- Proves on a real database what the API specs (mocked Supabase clients) cannot:
--   * rider A cannot link a trip to rider B's ride, nor to a ride that does not
--     exist, and both fail the same way (no ride-existence oracle);
--   * A can link a trip to A's own ride;
--   * an existing link cannot be re-pointed to another ride;
--   * an unrelated update of a linked trip still works;
--   * a ride gets at most one template;
--   * an owner can clear a link (UPDATE to NULL);
--   * hard-deleting a ride nulls the link through the trigger (ON DELETE SET NULL).
--
-- SAFE ON A REAL DATABASE. Everything runs in ONE transaction that ends in
-- ROLLBACK: the throwaway auth users, rides and trips never persist. It uses no
-- psql meta-commands, so the file can be sent as-is:
--
--   * disposable container (fixtures + 00192 + 00193, then this file):
--       supabase/checks/run.sh trips_source_ride_owner.sql
--   * local Supabase stack (00193 applied):
--       psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--         -v ON_ERROR_STOP=1 -f supabase/checks/trips_source_ride_owner.sql
--   * prod, via the Management API query endpoint (runs as postgres):
--       curl -sS -X POST "https://api.supabase.com/v1/projects/<ref>/database/query" \
--         -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
--         --data "$(jq -Rs '{query: .}' supabase/checks/trips_source_ride_owner.sql)"
--     A 2xx with `[]` = pass; any FAIL comes back as a 4xx carrying its message.
--
-- A failed assertion raises, which aborts the transaction (nothing is kept) and
-- surfaces as the error. Success returns no rows and no error.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_trips_check_source_ride_owner') THEN
    RAISE EXCEPTION 'trg_trips_check_source_ride_owner does not exist: apply 00193 first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Fixtures, as the connecting (admin) role. Fresh random ids, so nothing can
-- collide with real rows; they travel to the role-switched blocks below through
-- transaction-local settings.
-- ---------------------------------------------------------------------------
SELECT
  set_config('ride_owner_check.user_a', gen_random_uuid()::text, true),
  set_config('ride_owner_check.user_b', gen_random_uuid()::text, true),
  set_config('ride_owner_check.ride_a', gen_random_uuid()::text, true),
  set_config('ride_owner_check.ride_a2', gen_random_uuid()::text, true),
  set_config('ride_owner_check.ride_b', gen_random_uuid()::text, true),
  set_config('ride_owner_check.trip', gen_random_uuid()::text, true),
  set_config('ride_owner_check.trip2', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email)
VALUES
  (current_setting('ride_owner_check.user_a')::uuid,
   'ride-owner-check-a-' || current_setting('ride_owner_check.user_a') || '@example.invalid'),
  (current_setting('ride_owner_check.user_b')::uuid,
   'ride-owner-check-b-' || current_setting('ride_owner_check.user_b') || '@example.invalid');

-- The columns production requires without a default. Completed, because
-- rides_one_active_per_user allows one recording ride per rider.
INSERT INTO public.rides (id, user_id, started_at, ended_at, status)
VALUES
  (current_setting('ride_owner_check.ride_a')::uuid, current_setting('ride_owner_check.user_a')::uuid,
   now() - interval '1 hour', now(), 'completed'),
  (current_setting('ride_owner_check.ride_a2')::uuid, current_setting('ride_owner_check.user_a')::uuid,
   now() - interval '1 hour', now(), 'completed'),
  (current_setting('ride_owner_check.ride_b')::uuid, current_setting('ride_owner_check.user_b')::uuid,
   now() - interval '1 hour', now(), 'completed');

-- ---------------------------------------------------------------------------
-- As rider A.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('ride_owner_check.user_a'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  user_a CONSTANT uuid := current_setting('ride_owner_check.user_a')::uuid;
  ride_a CONSTANT uuid := current_setting('ride_owner_check.ride_a')::uuid;
  ride_a2 CONSTANT uuid := current_setting('ride_owner_check.ride_a2')::uuid;
  ride_b CONSTANT uuid := current_setting('ride_owner_check.ride_b')::uuid;
  trip CONSTANT uuid := current_setting('ride_owner_check.trip')::uuid;
  trip2 CONSTANT uuid := current_setting('ride_owner_check.trip2')::uuid;
  linked uuid;
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'FAIL: expected to run as authenticated, running as %', current_user;
  END IF;

  -- 1. B's ride: the trips_insert policy passes (A is the organiser), so only
  --    the trigger can refuse it.
  BEGIN
    INSERT INTO public.trips (organiser_user_id, title, description, difficulty, start_date, end_date, is_template, source_ride_id)
    VALUES (user_a, 'ride-owner-check', 'check', 'moderate', current_date, current_date, true, ride_b);
    RAISE EXCEPTION 'FAIL: A linked a trip to B''s ride';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 2. A ride that does not exist fails the same way as someone else's ride,
  --    not with the FK's foreign_key_violation (which would reveal existence).
  BEGIN
    INSERT INTO public.trips (organiser_user_id, title, description, difficulty, start_date, end_date, is_template, source_ride_id)
    VALUES (user_a, 'ride-owner-check', 'check', 'moderate', current_date, current_date, true, gen_random_uuid());
    RAISE EXCEPTION 'FAIL: A linked a trip to a ride that does not exist';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 3. A's own ride: allowed.
  INSERT INTO public.trips (id, organiser_user_id, title, description, difficulty, start_date, end_date, is_template, source_ride_id)
  VALUES (trip, user_a, 'ride-owner-check', 'check', 'moderate', current_date, current_date, true, ride_a);

  -- 4. Re-pointing an existing link to another ride is refused, even to A's own.
  BEGIN
    UPDATE public.trips SET source_ride_id = ride_a2 WHERE id = trip;
    RAISE EXCEPTION 'FAIL: A re-pointed a trip''s source ride';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 5. Updating other columns of a linked trip is unaffected.
  UPDATE public.trips SET title = 'ride-owner-check renamed' WHERE id = trip;

  -- 6. The same ride cannot back a second template (00192's index).
  BEGIN
    INSERT INTO public.trips (organiser_user_id, title, description, difficulty, start_date, end_date, is_template, source_ride_id)
    VALUES (user_a, 'ride-owner-check', 'check', 'moderate', current_date, current_date, true, ride_a);
    RAISE EXCEPTION 'FAIL: one ride backs two templates';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- 7. An owner can clear a link.
  INSERT INTO public.trips (id, organiser_user_id, title, description, difficulty, start_date, end_date, is_template, source_ride_id)
  VALUES (trip2, user_a, 'ride-owner-check', 'check', 'moderate', current_date, current_date, true, ride_a2);
  UPDATE public.trips SET source_ride_id = NULL WHERE id = trip2;
  SELECT source_ride_id INTO linked FROM public.trips WHERE id = trip2;
  IF linked IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: clearing source_ride_id left %', linked;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- As the admin role: hard-deleting the ride runs ON DELETE SET NULL, an UPDATE
-- that fires the trigger; it must go through and null the link.
-- ---------------------------------------------------------------------------
RESET ROLE;

DO $$
DECLARE
  linked uuid;
BEGIN
  DELETE FROM public.rides WHERE id = current_setting('ride_owner_check.ride_a')::uuid;
  SELECT source_ride_id INTO linked FROM public.trips
  WHERE id = current_setting('ride_owner_check.trip')::uuid;
  IF linked IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: deleting the ride left source_ride_id = %', linked;
  END IF;
  RAISE NOTICE 'trips.source_ride_id ownership check: all assertions passed';
END $$;

ROLLBACK;
