-- Repeatable check for trip comments (migrations/00202_comments_trip_target.sql):
-- the widened comments_single_target CHECK and the trip gates on comments_insert
-- and comments_select.
--
-- Proves on a real Postgres what the API spec (mocked Supabase client) cannot:
--   * a trip-only comment passes the CHECK; trip_id + ride_id is rejected (23514);
--   * a rider can comment on a public, non-draft trip;
--   * a participant can comment on a private and on an unlisted trip they joined;
--   * an outsider cannot comment on a private, unlisted or someone else's draft
--     trip (42501), and cannot comment as somebody else;
--   * an outsider and anon cannot SELECT comments on those private/unlisted
--     trips, even filtering by trip_id IS NOT NULL, while public-trip and ride
--     comments stay readable by anyone.
--
-- Runs in the DISPOSABLE container only:
--   supabase/checks/run.sh comments_trip_target_rls.sql
-- Its trip rows carry only the columns the fixture's minimal public.trips has;
-- on a real database (local stack or prod) they would need the full trip
-- columns. Everything runs in ONE transaction that ends in ROLLBACK.
--
-- A failed assertion raises, which aborts the transaction (nothing is kept) and
-- surfaces as the error. Success returns no rows and no error.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.comments') IS NULL OR to_regclass('public.trips') IS NULL THEN
    RAISE EXCEPTION 'public.comments / public.trips missing: run via run.sh with its fixture';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Fixtures, as the connecting (admin) role. Fresh random ids; they travel to
-- the role-switched blocks below through transaction-local settings.
--   organiser O owns every trip; participant P joined the private and the
--   unlisted trip; outsider X joined nothing.
-- ---------------------------------------------------------------------------
SELECT
  set_config('rls_check.user_o', gen_random_uuid()::text, true),
  set_config('rls_check.user_p', gen_random_uuid()::text, true),
  set_config('rls_check.user_x', gen_random_uuid()::text, true),
  set_config('rls_check.trip_public', gen_random_uuid()::text, true),
  set_config('rls_check.trip_private', gen_random_uuid()::text, true),
  set_config('rls_check.trip_unlisted', gen_random_uuid()::text, true),
  set_config('rls_check.trip_draft', gen_random_uuid()::text, true),
  set_config('rls_check.ride_public', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, aud, role)
SELECT u::uuid, 'rls-check-' || u || '@example.invalid', 'authenticated', 'authenticated'
FROM unnest(ARRAY[
  current_setting('rls_check.user_o'),
  current_setting('rls_check.user_p'),
  current_setting('rls_check.user_x')
]) AS u;

INSERT INTO public.users (id)
SELECT u::uuid
FROM unnest(ARRAY[
  current_setting('rls_check.user_o'),
  current_setting('rls_check.user_p'),
  current_setting('rls_check.user_x')
]) AS u;

INSERT INTO public.trips (id, organiser_user_id, visibility, status)
VALUES
  (current_setting('rls_check.trip_public')::uuid, current_setting('rls_check.user_o')::uuid, 'public', 'published'),
  (current_setting('rls_check.trip_private')::uuid, current_setting('rls_check.user_o')::uuid, 'private', 'published'),
  (current_setting('rls_check.trip_unlisted')::uuid, current_setting('rls_check.user_o')::uuid, 'unlisted', 'published'),
  (current_setting('rls_check.trip_draft')::uuid, current_setting('rls_check.user_o')::uuid, 'public', 'draft');

INSERT INTO public.trip_participants (trip_id, user_id)
VALUES
  (current_setting('rls_check.trip_private')::uuid, current_setting('rls_check.user_p')::uuid),
  (current_setting('rls_check.trip_unlisted')::uuid, current_setting('rls_check.user_p')::uuid);

INSERT INTO public.rides (id, visibility) VALUES (current_setting('rls_check.ride_public')::uuid, 'public');

-- The CHECK, as admin (RLS does not apply to the table owner here).
DO $$
BEGIN
  BEGIN
    INSERT INTO public.comments (user_id, trip_id, ride_id, text)
    VALUES (current_setting('rls_check.user_o')::uuid, current_setting('rls_check.trip_public')::uuid,
            current_setting('rls_check.ride_public')::uuid, 'two targets');
    RAISE EXCEPTION 'FAIL: a comment with trip_id and ride_id passed comments_single_target';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.comments (user_id, text)
    VALUES (current_setting('rls_check.user_o')::uuid, 'no target');
    RAISE EXCEPTION 'FAIL: a comment with no target passed comments_single_target';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- As participant P.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('rls_check.user_p'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  user_p CONSTANT uuid := current_setting('rls_check.user_p')::uuid;
  visible INTEGER;
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'FAIL: expected to run as authenticated, running as %', current_user;
  END IF;

  -- 1. Trip-only comments on the public, private and unlisted trips: allowed.
  INSERT INTO public.comments (user_id, trip_id, text)
  VALUES
    (user_p, current_setting('rls_check.trip_public')::uuid, 'public trip'),
    (user_p, current_setting('rls_check.trip_private')::uuid, 'private trip'),
    (user_p, current_setting('rls_check.trip_unlisted')::uuid, 'unlisted trip');

  -- 2. A ride comment still works next to them.
  INSERT INTO public.comments (user_id, ride_id, text)
  VALUES (user_p, current_setting('rls_check.ride_public')::uuid, 'ride');

  -- 3. P reads back all four.
  SELECT count(*) INTO visible FROM public.comments WHERE user_id = user_p;
  IF visible <> 4 THEN
    RAISE EXCEPTION 'FAIL: participant reads back % of their 4 comments', visible;
  END IF;

  -- 4. Someone else's draft trip: not readable, so not commentable.
  BEGIN
    INSERT INTO public.comments (user_id, trip_id, text)
    VALUES (user_p, current_setting('rls_check.trip_draft')::uuid, 'draft trip');
    RAISE EXCEPTION 'FAIL: participant commented on another rider''s draft trip';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- As outsider X.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('rls_check.user_x'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  user_x CONSTANT uuid := current_setting('rls_check.user_x')::uuid;
  user_p CONSTANT uuid := current_setting('rls_check.user_p')::uuid;
  hidden uuid;
  visible INTEGER;
BEGIN
  -- 5. Private, unlisted and draft trips: insert rejected.
  FOREACH hidden IN ARRAY ARRAY[
    current_setting('rls_check.trip_private')::uuid,
    current_setting('rls_check.trip_unlisted')::uuid,
    current_setting('rls_check.trip_draft')::uuid
  ] LOOP
    BEGIN
      INSERT INTO public.comments (user_id, trip_id, text) VALUES (user_x, hidden, 'outsider');
      RAISE EXCEPTION 'FAIL: outsider commented on hidden trip %', hidden;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;

  -- 6. Public trip: allowed. As P on a public trip: rejected (user_id must match).
  INSERT INTO public.comments (user_id, trip_id, text)
  VALUES (user_x, current_setting('rls_check.trip_public')::uuid, 'outsider on public');
  BEGIN
    INSERT INTO public.comments (user_id, trip_id, text)
    VALUES (user_p, current_setting('rls_check.trip_public')::uuid, 'spoofed');
    RAISE EXCEPTION 'FAIL: outsider commented as the participant';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 7. Comments on the private and unlisted trips are invisible, by id and by scan.
  SELECT count(*) INTO visible FROM public.comments
  WHERE trip_id IN (current_setting('rls_check.trip_private')::uuid,
                    current_setting('rls_check.trip_unlisted')::uuid);
  IF visible <> 0 THEN
    RAISE EXCEPTION 'FAIL: outsider reads % comments on private/unlisted trips', visible;
  END IF;
  SELECT count(*) INTO visible FROM public.comments WHERE trip_id IS NOT NULL;
  IF visible <> 2 THEN
    RAISE EXCEPTION 'FAIL: outsider sees % trip comments, expected the 2 on the public trip', visible;
  END IF;

  -- 8. Ride comments stay open.
  SELECT count(*) INTO visible FROM public.comments
  WHERE ride_id = current_setting('rls_check.ride_public')::uuid;
  IF visible <> 1 THEN
    RAISE EXCEPTION 'FAIL: outsider reads % ride comments, expected 1', visible;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- As anon: same read rule, no insert.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

DO $$
DECLARE
  visible INTEGER;
BEGIN
  SELECT count(*) INTO visible FROM public.comments WHERE trip_id IS NOT NULL;
  IF visible <> 2 THEN
    RAISE EXCEPTION 'FAIL: anon sees % trip comments, expected the 2 on the public trip', visible;
  END IF;
  SELECT count(*) INTO visible FROM public.comments WHERE ride_id IS NOT NULL;
  IF visible <> 1 THEN
    RAISE EXCEPTION 'FAIL: anon reads % ride comments, expected 1', visible;
  END IF;
  BEGIN
    INSERT INTO public.comments (user_id, trip_id, text)
    VALUES (current_setting('rls_check.user_x')::uuid, current_setting('rls_check.trip_public')::uuid, 'anon');
    RAISE EXCEPTION 'FAIL: anon inserted a comment';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- As organiser O: sees every comment on their trips.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('rls_check.user_o'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  visible INTEGER;
BEGIN
  SELECT count(*) INTO visible FROM public.comments WHERE trip_id IS NOT NULL;
  IF visible <> 4 THEN
    RAISE EXCEPTION 'FAIL: organiser sees % comments on their trips, expected 4', visible;
  END IF;
  RAISE NOTICE 'comments trip-target RLS check: all assertions passed';
END $$;

RESET ROLE;
ROLLBACK;
