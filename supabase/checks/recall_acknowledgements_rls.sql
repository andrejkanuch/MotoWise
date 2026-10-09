-- Repeatable check for the owner-only RLS and grants of
-- public.recall_acknowledgements (migrations/00189_recall_acknowledgements.sql).
--
-- Proves on a real database what the API specs (mocked Supabase clients) cannot:
--   * as rider A, an insert on A's own live bike succeeds;
--   * an insert carrying A's id on rider B's bike fails;
--   * an insert on A's soft-deleted bike fails;
--   * A can neither SELECT nor DELETE B's row;
--   * anon holds no privilege on the table, and authenticated has no UPDATE.
--
-- SAFE ON A REAL DATABASE. Everything runs in ONE transaction that ends in
-- ROLLBACK: the two throwaway auth users, their bikes and acknowledgements never
-- persist. It uses no psql meta-commands, so the file can be sent as-is:
--
--   * disposable container (fixtures + 00189, then this file):
--       supabase/checks/run.sh recall_acknowledgements_rls.sql
--   * local Supabase stack (00189 applied):
--       psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--         -v ON_ERROR_STOP=1 -f supabase/checks/recall_acknowledgements_rls.sql
--   * prod, via the Management API query endpoint (runs as postgres):
--       curl -sS -X POST "https://api.supabase.com/v1/projects/<ref>/database/query" \
--         -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
--         --data "$(jq -Rs '{query: .}' supabase/checks/recall_acknowledgements_rls.sql)"
--     A 2xx with `[]` = pass; any FAIL comes back as a 4xx carrying its message.
--
-- A failed assertion raises, which aborts the transaction (nothing is kept) and
-- surfaces as the error. Success returns no rows and no error.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.recall_acknowledgements') IS NULL THEN
    RAISE EXCEPTION 'public.recall_acknowledgements does not exist: apply 00189 first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Grants: anon gets nothing, authenticated gets SELECT/INSERT/DELETE only.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  priv TEXT;
BEGIN
  FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
    IF has_table_privilege('anon', 'public.recall_acknowledgements', priv) THEN
      RAISE EXCEPTION 'FAIL: anon has % on recall_acknowledgements', priv;
    END IF;
  END LOOP;
  FOREACH priv IN ARRAY ARRAY['UPDATE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
    IF has_table_privilege('authenticated', 'public.recall_acknowledgements', priv) THEN
      RAISE EXCEPTION 'FAIL: authenticated has % on recall_acknowledgements', priv;
    END IF;
  END LOOP;
  FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'DELETE'] LOOP
    IF NOT has_table_privilege('authenticated', 'public.recall_acknowledgements', priv) THEN
      RAISE EXCEPTION 'FAIL: authenticated lacks % on recall_acknowledgements', priv;
    END IF;
  END LOOP;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.recall_acknowledgements'::regclass) THEN
    RAISE EXCEPTION 'FAIL: RLS is not enabled on recall_acknowledgements';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Fixtures, as the connecting (admin) role. Fresh random ids, so nothing can
-- collide with real rows; their ids travel to the role-switched blocks below
-- through transaction-local settings.
-- ---------------------------------------------------------------------------
SELECT
  set_config('rls_check.user_a', gen_random_uuid()::text, true),
  set_config('rls_check.user_b', gen_random_uuid()::text, true),
  set_config('rls_check.bike_a', gen_random_uuid()::text, true),
  set_config('rls_check.bike_a_deleted', gen_random_uuid()::text, true),
  set_config('rls_check.bike_b', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, aud, role)
VALUES
  (current_setting('rls_check.user_a')::uuid,
   'rls-check-a-' || current_setting('rls_check.user_a') || '@example.invalid',
   'authenticated', 'authenticated'),
  (current_setting('rls_check.user_b')::uuid,
   'rls-check-b-' || current_setting('rls_check.user_b') || '@example.invalid',
   'authenticated', 'authenticated');

INSERT INTO public.motorcycles (id, user_id, make, model, year, distance_unit, deleted_at)
VALUES
  (current_setting('rls_check.bike_a')::uuid, current_setting('rls_check.user_a')::uuid,
   'Honda', 'Africa Twin', 2022, 'km', NULL),
  (current_setting('rls_check.bike_a_deleted')::uuid, current_setting('rls_check.user_a')::uuid,
   'Honda', 'Africa Twin', 2020, 'km', now()),
  (current_setting('rls_check.bike_b')::uuid, current_setting('rls_check.user_b')::uuid,
   'BMW', 'R 1250 GS', 2021, 'km', NULL);

-- ---------------------------------------------------------------------------
-- As rider B: one acknowledgement on B's own bike (the row A must not reach).
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('rls_check.user_b'), 'role', 'authenticated')::text,
  true
);

DO $$
BEGIN
  INSERT INTO public.recall_acknowledgements (user_id, motorcycle_id, campaign_number)
  VALUES (current_setting('rls_check.user_b')::uuid, current_setting('rls_check.bike_b')::uuid, '24V200000');
END $$;

-- ---------------------------------------------------------------------------
-- As rider A.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('rls_check.user_a'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  user_a CONSTANT uuid := current_setting('rls_check.user_a')::uuid;
  user_b CONSTANT uuid := current_setting('rls_check.user_b')::uuid;
  bike_a CONSTANT uuid := current_setting('rls_check.bike_a')::uuid;
  bike_a_deleted CONSTANT uuid := current_setting('rls_check.bike_a_deleted')::uuid;
  bike_b CONSTANT uuid := current_setting('rls_check.bike_b')::uuid;
  affected INTEGER;
  visible INTEGER;
BEGIN
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'FAIL: expected to run as authenticated, running as %', current_user;
  END IF;

  -- 1. Own live bike: allowed, and the row is readable back.
  INSERT INTO public.recall_acknowledgements (user_id, motorcycle_id, campaign_number)
  VALUES (user_a, bike_a, '23V100000');
  SELECT count(*) INTO visible FROM public.recall_acknowledgements
  WHERE motorcycle_id = bike_a AND campaign_number = '23V100000';
  IF visible <> 1 THEN
    RAISE EXCEPTION 'FAIL: A cannot read back their own acknowledgement (saw %)', visible;
  END IF;

  -- 2. A's id on B's bike: the ownership EXISTS must reject it.
  BEGIN
    INSERT INTO public.recall_acknowledgements (user_id, motorcycle_id, campaign_number)
    VALUES (user_a, bike_b, '23V100001');
    RAISE EXCEPTION 'FAIL: A inserted an acknowledgement on B''s bike';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 3. B's id on B's bike, sent by A: user_id must match the caller.
  BEGIN
    INSERT INTO public.recall_acknowledgements (user_id, motorcycle_id, campaign_number)
    VALUES (user_b, bike_b, '23V100002');
    RAISE EXCEPTION 'FAIL: A inserted an acknowledgement as B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 4. A's own soft-deleted bike: only live bikes qualify. Enforced twice: the
  --    policy's `m.deleted_at IS NULL`, and the motorcycles SELECT policy the
  --    EXISTS subquery runs under; this fails only if both are dropped.
  BEGIN
    INSERT INTO public.recall_acknowledgements (user_id, motorcycle_id, campaign_number)
    VALUES (user_a, bike_a_deleted, '23V100003');
    RAISE EXCEPTION 'FAIL: A inserted an acknowledgement on a soft-deleted bike';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 5. B's row is invisible to A.
  SELECT count(*) INTO visible FROM public.recall_acknowledgements WHERE motorcycle_id = bike_b;
  IF visible <> 0 THEN
    RAISE EXCEPTION 'FAIL: A can SELECT % of B''s acknowledgements', visible;
  END IF;

  -- 6. ...and cannot be deleted by A (0 rows, no error: RLS filters it out).
  DELETE FROM public.recall_acknowledgements WHERE motorcycle_id = bike_b;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'FAIL: A deleted % of B''s acknowledgements', affected;
  END IF;

  -- 7. No UPDATE privilege at all, even on A's own row.
  BEGIN
    UPDATE public.recall_acknowledgements SET campaign_number = '23V199999'
    WHERE motorcycle_id = bike_a;
    RAISE EXCEPTION 'FAIL: A updated an acknowledgement';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 8. A can undo (hard delete) their own row.
  DELETE FROM public.recall_acknowledgements WHERE motorcycle_id = bike_a;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'FAIL: A could not delete their own acknowledgement (deleted %)', affected;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- As anon: no access at all (the grant check above, observed).
-- ---------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

DO $$
DECLARE
  visible INTEGER;
BEGIN
  BEGIN
    SELECT count(*) INTO visible FROM public.recall_acknowledgements;
    RAISE EXCEPTION 'FAIL: anon can SELECT recall_acknowledgements';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- As rider B again: B's row survived A's DELETE.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('rls_check.user_b'), 'role', 'authenticated')::text,
  true
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.recall_acknowledgements
    WHERE motorcycle_id = current_setting('rls_check.bike_b')::uuid
  ) THEN
    RAISE EXCEPTION 'FAIL: B''s acknowledgement is gone after A''s DELETE';
  END IF;
  RAISE NOTICE 'recall_acknowledgements RLS check: all assertions passed';
END $$;

RESET ROLE;
ROLLBACK;
