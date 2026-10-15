-- Repeatable check for the bike branch of public.complete_onboarding
-- (migrations/00191_complete_onboarding_make_only_bike.sql).
--
-- Proves on a real database what the API specs (mocked Supabase clients) cannot:
--   * make + year with no model creates exactly one bike, stored with model '';
--   * a blank model is treated as no model;
--   * repeating either call does not create a second bike;
--   * a rider who already has a primary bike still completes onboarding, and
--     the new bike is added as a non-primary bike;
--   * make + model + year still creates exactly one bike with that model;
--   * a soft-deleted bike that matches is not reused: a live bike is created,
--     and it is primary when the only primary bike was the deleted one;
--   * no make, or a blank make, creates no bike but still completes onboarding;
--   * a rider cannot complete onboarding for someone else.
--
-- SAFE ON A REAL DATABASE. Everything runs in ONE transaction that ends in
-- ROLLBACK: the throwaway auth users, their profiles and bikes never persist.
-- It uses no psql meta-commands, so the file can be sent as-is:
--
--   * disposable container (fixtures + 00191, then this file):
--       supabase/checks/run.sh complete_onboarding_bike.sql
--   * local Supabase stack (00191 applied):
--       psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--         -v ON_ERROR_STOP=1 -f supabase/checks/complete_onboarding_bike.sql
--   * prod, via the Management API query endpoint (runs as postgres):
--       curl -sS -X POST "https://api.supabase.com/v1/projects/<ref>/database/query" \
--         -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
--         --data "$(jq -Rs '{query: .}' supabase/checks/complete_onboarding_bike.sql)"
--     A 2xx with `[]` = pass; any FAIL comes back as a 4xx carrying its message.
--
-- A failed assertion raises, which aborts the transaction (nothing is kept) and
-- surfaces as the error. Success returns no rows and no error.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.complete_onboarding(uuid, jsonb, text, text, integer, public.motorcycle_type, integer, text, text, text, boolean, text, boolean, boolean, boolean, text, text, text)') IS NULL THEN
    RAISE EXCEPTION 'public.complete_onboarding with the 18-argument signature does not exist';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Fixtures, as the connecting (admin) role. Fresh random ids, so nothing can
-- collide with real rows; their ids travel to the role-switched blocks below
-- through transaction-local settings.
-- ---------------------------------------------------------------------------
SELECT
  set_config('onb_check.make_only', gen_random_uuid()::text, true),
  set_config('onb_check.blank_model', gen_random_uuid()::text, true),
  set_config('onb_check.full_bike', gen_random_uuid()::text, true),
  set_config('onb_check.no_bike', gen_random_uuid()::text, true),
  set_config('onb_check.has_primary', gen_random_uuid()::text, true),
  set_config('onb_check.deleted_match', gen_random_uuid()::text, true),
  set_config('onb_check.blank_make', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, aud, role)
SELECT id, 'onb-check-' || id || '@example.invalid', 'authenticated', 'authenticated'
FROM (VALUES
  (current_setting('onb_check.make_only')::uuid),
  (current_setting('onb_check.blank_model')::uuid),
  (current_setting('onb_check.full_bike')::uuid),
  (current_setting('onb_check.no_bike')::uuid),
  (current_setting('onb_check.has_primary')::uuid),
  (current_setting('onb_check.deleted_match')::uuid),
  (current_setting('onb_check.blank_make')::uuid)
) AS t (id);

-- A live primary bike that the onboarding bike below does not match.
INSERT INTO public.motorcycles (user_id, make, model, year, is_primary, distance_unit)
VALUES (current_setting('onb_check.has_primary')::uuid, 'BMW', 'R 1250 GS', 2021, true, 'km');

-- A soft-deleted primary bike identical to the onboarding bike below.
INSERT INTO public.motorcycles (user_id, make, model, year, is_primary, distance_unit, deleted_at)
VALUES (current_setting('onb_check.deleted_match')::uuid, 'Venom', '', 2023, true, 'mi', now());

SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Make + year, no model: one bike with model '', and a repeat adds nothing.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('onb_check.make_only'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  rider CONSTANT uuid := current_setting('onb_check.make_only')::uuid;
  result jsonb;
  repeat jsonb;
BEGIN
  result := public.complete_onboarding(
    p_user_id => rider, p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_make => 'Venom', p_bike_model => NULL, p_bike_year => 2023,
    p_bike_type => 'standard', p_bike_mileage => 1200, p_mileage_unit => 'mi'
  );
  IF result ->> 'motorcycle_id' IS NULL THEN
    RAISE EXCEPTION 'FAIL: make-only onboarding returned no motorcycle_id';
  END IF;
  repeat := public.complete_onboarding(
    p_user_id => rider, p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_make => 'Venom', p_bike_year => 2023, p_mileage_unit => 'mi'
  );
  IF repeat ->> 'motorcycle_id' IS DISTINCT FROM result ->> 'motorcycle_id' THEN
    RAISE EXCEPTION 'FAIL: repeated make-only onboarding returned a different motorcycle_id';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- A blank model is treated as no model, including on a repeat call.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('onb_check.blank_model'), 'role', 'authenticated')::text,
  true
);

DO $$
BEGIN
  PERFORM public.complete_onboarding(
    p_user_id => current_setting('onb_check.blank_model')::uuid,
    p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_make => 'Ducati', p_bike_model => '   ', p_bike_year => 2021
  );
  PERFORM public.complete_onboarding(
    p_user_id => current_setting('onb_check.blank_model')::uuid,
    p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_make => 'Ducati', p_bike_model => ' ', p_bike_year => 2021
  );
END $$;

-- ---------------------------------------------------------------------------
-- A rider who already has a primary bike: onboarding still completes.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('onb_check.has_primary'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  rider CONSTANT uuid := current_setting('onb_check.has_primary')::uuid;
  first_result jsonb;
  repeat_result jsonb;
BEGIN
  first_result := public.complete_onboarding(
    p_user_id => rider, p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_make => 'Venom', p_bike_year => 2023
  );
  repeat_result := public.complete_onboarding(
    p_user_id => rider, p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_make => 'Venom', p_bike_year => 2023
  );
  IF repeat_result ->> 'motorcycle_id' IS DISTINCT FROM first_result ->> 'motorcycle_id' THEN
    RAISE EXCEPTION 'FAIL: existing-primary repeat returned a different motorcycle_id';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- A matching soft-deleted bike is not reused.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('onb_check.deleted_match'), 'role', 'authenticated')::text,
  true
);

DO $$
BEGIN
  PERFORM public.complete_onboarding(
    p_user_id => current_setting('onb_check.deleted_match')::uuid,
    p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_make => 'Venom', p_bike_year => 2023
  );
END $$;

-- ---------------------------------------------------------------------------
-- A blank make is treated as no make.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('onb_check.blank_make'), 'role', 'authenticated')::text,
  true
);

DO $$
BEGIN
  PERFORM public.complete_onboarding(
    p_user_id => current_setting('onb_check.blank_make')::uuid,
    p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_make => '   ', p_bike_year => 2023
  );
END $$;

-- ---------------------------------------------------------------------------
-- Make + model + year: unchanged behaviour, including no duplicate on repeat.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('onb_check.full_bike'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  rider CONSTANT uuid := current_setting('onb_check.full_bike')::uuid;
BEGIN
  PERFORM public.complete_onboarding(
    p_user_id => rider, p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_make => 'Honda', p_bike_model => 'Africa Twin', p_bike_year => 2022
  );
  PERFORM public.complete_onboarding(
    p_user_id => rider, p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_make => 'Honda', p_bike_model => 'Africa Twin', p_bike_year => 2022
  );
END $$;

-- ---------------------------------------------------------------------------
-- No make: no bike, and a rider cannot complete onboarding for someone else.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('onb_check.no_bike'), 'role', 'authenticated')::text,
  true
);

DO $$
BEGIN
  PERFORM public.complete_onboarding(
    p_user_id => current_setting('onb_check.no_bike')::uuid,
    p_preferences => '{"onboardingCompleted": true}'::jsonb,
    p_bike_year => 2023
  );

  BEGIN
    PERFORM public.complete_onboarding(
      p_user_id => current_setting('onb_check.make_only')::uuid,
      p_preferences => '{"onboardingCompleted": true}'::jsonb,
      p_bike_make => 'Intruder', p_bike_year => 2020
    );
    RAISE EXCEPTION 'FAIL: completed onboarding for another rider';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Unauthorized%' THEN
        RAISE;
      END IF;
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Assertions, as the connecting role.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  make_only CONSTANT uuid := current_setting('onb_check.make_only')::uuid;
  blank_model CONSTANT uuid := current_setting('onb_check.blank_model')::uuid;
  full_bike CONSTANT uuid := current_setting('onb_check.full_bike')::uuid;
  no_bike CONSTANT uuid := current_setting('onb_check.no_bike')::uuid;
  has_primary CONSTANT uuid := current_setting('onb_check.has_primary')::uuid;
  deleted_match CONSTANT uuid := current_setting('onb_check.deleted_match')::uuid;
  blank_make CONSTANT uuid := current_setting('onb_check.blank_make')::uuid;
  bikes INTEGER;
  bike public.motorcycles;
BEGIN
  SELECT count(*) INTO bikes FROM public.motorcycles WHERE user_id = make_only;
  IF bikes <> 1 THEN
    RAISE EXCEPTION 'FAIL: make-only rider has % bikes, expected 1', bikes;
  END IF;
  SELECT * INTO bike FROM public.motorcycles WHERE user_id = make_only;
  IF bike.make <> 'Venom' OR bike.model <> '' OR bike.year <> 2023
     OR bike.type <> 'standard' OR bike.current_mileage <> 1200
     OR bike.mileage_unit <> 'mi' OR NOT bike.is_primary THEN
    RAISE EXCEPTION 'FAIL: make-only bike stored as % % % (type %, mileage % %, primary %)',
      bike.year, bike.make, quote_literal(bike.model), bike.type,
      bike.current_mileage, bike.mileage_unit, bike.is_primary;
  END IF;

  SELECT count(*) INTO bikes FROM public.motorcycles WHERE user_id = blank_model;
  IF bikes <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.motorcycles WHERE user_id = blank_model AND model = ''
  ) THEN
    RAISE EXCEPTION 'FAIL: blank-model rider has % bikes, expected 1 with an empty model', bikes;
  END IF;

  SELECT count(*) INTO bikes FROM public.motorcycles
  WHERE user_id = has_primary AND deleted_at IS NULL;
  IF bikes <> 2 THEN
    RAISE EXCEPTION 'FAIL: existing-primary rider has % live bikes, expected 2', bikes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = has_primary AND onboarding_completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: rider with an existing primary bike did not complete onboarding';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.motorcycles
    WHERE user_id = has_primary AND make = 'Venom' AND model = '' AND NOT is_primary
  ) OR NOT EXISTS (
    SELECT 1 FROM public.motorcycles
    WHERE user_id = has_primary AND make = 'BMW' AND is_primary
  ) THEN
    RAISE EXCEPTION 'FAIL: rider with an existing primary bike: expected BMW primary and a non-primary Venom';
  END IF;

  SELECT count(*) INTO bikes FROM public.motorcycles
  WHERE user_id = full_bike AND model = 'Africa Twin';
  IF bikes <> 1 THEN
    RAISE EXCEPTION 'FAIL: full-bike rider has % Africa Twins, expected 1', bikes;
  END IF;

  SELECT count(*) INTO bikes FROM public.motorcycles WHERE user_id = no_bike;
  IF bikes <> 0 THEN
    RAISE EXCEPTION 'FAIL: rider with no make has % bikes, expected 0', bikes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = no_bike AND onboarding_completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: rider with no make did not complete onboarding';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.motorcycles
    WHERE user_id = deleted_match AND make = 'Venom' AND deleted_at IS NULL AND is_primary
  ) THEN
    RAISE EXCEPTION 'FAIL: matching soft-deleted bike was reused instead of creating a live primary bike';
  END IF;

  SELECT count(*) INTO bikes FROM public.motorcycles WHERE user_id = blank_make;
  IF bikes <> 0 THEN
    RAISE EXCEPTION 'FAIL: rider with a blank make has % bikes, expected 0', bikes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = blank_make AND onboarding_completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: rider with a blank make did not complete onboarding';
  END IF;

  RAISE NOTICE 'complete_onboarding bike check: all assertions passed';
END $$;

ROLLBACK;
