-- Repeatable check for public.process_revenuecat_event as defined by
-- migrations/00187_revenuecat_entitlement_source_of_truth.sql (on top of 00185).
-- The 00185 scenarios now exercise 00187's fallback path (no resolved state).
--
-- THROWAWAY DATABASE ONLY. NEVER RUN THIS AGAINST PROD, STAGING OR A LOCAL
-- SUPABASE STACK. It creates its own minimal public.users and
-- public.revenuecat_webhook_events fixtures, and it refuses to start when
-- public.users already exists. Everything also runs inside one transaction
-- that is rolled back at the end.
--
-- Run it with supabase/checks/run.sh, which starts a disposable postgres:17
-- container, runs this file with psql and removes the container. It is not
-- wired into CI on purpose: nothing here may ever reach a real database.
--
-- When the function is next replaced, point the \ir below at the new
-- migration and extend the scenarios.

\set ON_ERROR_STOP on
\set QUIET on

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    RAISE EXCEPTION 'public.users already exists: this check only runs on an empty throwaway database';
  END IF;
END $$;

-- Supabase roles, and Supabase's default EXECUTE grant on new functions, so the
-- ACL assertions test what prod would do.
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
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Minimal fixtures: only the columns process_revenuecat_event touches.
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'trialing', 'active', 'past_due', 'cancelled', 'expired')),
  subscription_expires_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  revenuecat_id TEXT
);

CREATE TABLE public.revenuecat_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  app_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_type TEXT,
  product_id TEXT,
  store TEXT,
  environment TEXT,
  is_trial_conversion BOOLEAN,
  purchased_at TIMESTAMPTZ,
  expiration_at TIMESTAMPTZ,
  grace_period_expiration_at TIMESTAMPTZ,
  payload JSONB
);

-- Stand-in for the version live before 00185, carrying a stale ACL (explicit
-- PUBLIC/anon/authenticated grants). CREATE OR REPLACE keeps a function's ACL,
-- so 00185's REVOKE must clear these itself.
CREATE FUNCTION public.process_revenuecat_event(
  p_event_id TEXT, p_event_type TEXT, p_app_user_id UUID,
  p_expiration_at TIMESTAMPTZ DEFAULT NULL, p_period_type TEXT DEFAULT NULL,
  p_product_id TEXT DEFAULT NULL, p_store TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT NULL, p_is_trial_conversion BOOLEAN DEFAULT NULL,
  p_purchased_at TIMESTAMPTZ DEFAULT NULL,
  p_grace_period_expiration_at TIMESTAMPTZ DEFAULT NULL,
  p_transferred_from UUID[] DEFAULT NULL, p_payload JSONB DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$ BEGIN END; $$;
GRANT EXECUTE ON FUNCTION public.process_revenuecat_event(
  TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], JSONB
) TO PUBLIC, anon, authenticated;

-- The migrations under test: 00185 (the version live before 00187), then 00187.
\ir ../migrations/00185_revenuecat_non_renewing_expiry.sql
\ir ../migrations/00187_revenuecat_entitlement_source_of_truth.sql

-- Helpers (session-local).
CREATE FUNCTION pg_temp.expect(ok BOOLEAN, label TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: %', label;
  END IF;
  RAISE NOTICE 'ok   %', label;
END $$;

CREATE FUNCTION pg_temp.seed(
  uid UUID, tier TEXT, status TEXT, expires TIMESTAMPTZ
) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.users (id, subscription_tier, subscription_status, subscription_expires_at)
  VALUES (uid, tier, status, expires);
$$;

CREATE FUNCTION pg_temp.ev(
  event_id TEXT, event_type TEXT, uid UUID, expires TIMESTAMPTZ, product TEXT DEFAULT NULL
) RETURNS void LANGUAGE sql AS $$
  SELECT public.process_revenuecat_event(
    p_event_id => event_id, p_event_type => event_type, p_app_user_id => uid,
    p_expiration_at => expires, p_product_id => product
  );
$$;

-- An event carrying RevenueCat's resolved entitlement state (00187).
CREATE FUNCTION pg_temp.rc(
  event_id TEXT, event_type TEXT, uid UUID, expires TIMESTAMPTZ,
  rc_tier TEXT, rc_status TEXT, rc_expires TIMESTAMPTZ,
  product TEXT DEFAULT NULL, period TEXT DEFAULT NULL
) RETURNS void LANGUAGE sql AS $$
  SELECT public.process_revenuecat_event(
    p_event_id => event_id, p_event_type => event_type, p_app_user_id => uid,
    p_expiration_at => expires, p_product_id => product, p_period_type => period,
    p_rc_tier => rc_tier, p_rc_status => rc_status, p_rc_expires_at => rc_expires
  );
$$;

CREATE FUNCTION pg_temp.state(uid UUID) RETURNS TEXT LANGUAGE sql AS $$
  SELECT subscription_tier || '/' || subscription_status FROM public.users WHERE id = uid;
$$;

CREATE FUNCTION pg_temp.expiry(uid UUID) RETURNS TIMESTAMPTZ LANGUAGE sql AS $$
  SELECT subscription_expires_at FROM public.users WHERE id = uid;
$$;

DO $$
DECLARE
  past CONSTANT TIMESTAMPTZ := now() - interval '1 minute';
  soon CONSTANT TIMESTAMPTZ := now() + interval '30 days';
  later CONSTANT TIMESTAMPTZ := now() + interval '365 days';
  u1 CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  u2 CONSTANT UUID := '00000000-0000-0000-0000-000000000002';
  u3 CONSTANT UUID := '00000000-0000-0000-0000-000000000003';
  u4 CONSTANT UUID := '00000000-0000-0000-0000-000000000004';
  u5 CONSTANT UUID := '00000000-0000-0000-0000-000000000005';
  u6 CONSTANT UUID := '00000000-0000-0000-0000-000000000006';
  u7 CONSTANT UUID := '00000000-0000-0000-0000-000000000007';
  u8 CONSTANT UUID := '00000000-0000-0000-0000-000000000008';
  u9 CONSTANT UUID := '00000000-0000-0000-0000-000000000009';
  u10 CONSTANT UUID := '00000000-0000-0000-0000-000000000010';
  u11 CONSTANT UUID := '00000000-0000-0000-0000-000000000011';
  u12 CONSTANT UUID := '00000000-0000-0000-0000-000000000012';
  u13 CONSTANT UUID := '00000000-0000-0000-0000-000000000013';
  u14 CONSTANT UUID := '00000000-0000-0000-0000-000000000014';
  u15 CONSTANT UUID := '00000000-0000-0000-0000-000000000015';
  u16 CONSTANT UUID := '00000000-0000-0000-0000-000000000016';
  u17 CONSTANT UUID := '00000000-0000-0000-0000-000000000017';
  u18 CONSTANT UUID := '00000000-0000-0000-0000-000000000018';
  u19 CONSTANT UUID := '00000000-0000-0000-0000-000000000019';
  u20 CONSTANT UUID := '00000000-0000-0000-0000-000000000020';
  u21 CONSTANT UUID := '00000000-0000-0000-0000-000000000021';
  u22 CONSTANT UUID := '00000000-0000-0000-0000-000000000022';
  end_user_role TEXT;
  sig CONSTANT TEXT := 'public.process_revenuecat_event(text,text,uuid,timestamptz,text,text,text,text,boolean,timestamptz,timestamptz,uuid[],jsonb,text,text,timestamptz)';
  old_sig CONSTANT TEXT := 'public.process_revenuecat_event(text,text,uuid,timestamptz,text,text,text,text,boolean,timestamptz,timestamptz,uuid[],jsonb)';
  raised BOOLEAN := FALSE;
BEGIN
  -- Immediate cancel, EXPIRATION first.
  PERFORM pg_temp.seed(u1, 'pro', 'active', soon);
  PERFORM pg_temp.ev('u1-exp', 'EXPIRATION', u1, past);
  PERFORM pg_temp.ev('u1-can', 'CANCELLATION', u1, past);
  PERFORM pg_temp.expect(pg_temp.state(u1) = 'free/expired', 'EXPIRATION -> CANCELLATION ends free/expired');

  -- Immediate cancel, CANCELLATION first.
  PERFORM pg_temp.seed(u2, 'pro', 'active', soon);
  PERFORM pg_temp.ev('u2-can', 'CANCELLATION', u2, past);
  PERFORM pg_temp.expect(pg_temp.state(u2) = 'free/expired', 'CANCELLATION with past expiry -> free/expired');
  PERFORM pg_temp.ev('u2-exp', 'EXPIRATION', u2, past);
  PERFORM pg_temp.expect(pg_temp.state(u2) = 'free/expired', 'CANCELLATION -> EXPIRATION ends free/expired');

  -- A late CANCELLATION, even with a future expiry, never leaves 'expired'.
  PERFORM pg_temp.ev('u1-can-late', 'CANCELLATION', u1, soon);
  PERFORM pg_temp.expect(pg_temp.state(u1) = 'free/expired', 'late future-expiry CANCELLATION keeps expired');

  -- Normal cancel: Pro until the period end.
  PERFORM pg_temp.seed(u3, 'pro', 'active', soon);
  PERFORM pg_temp.ev('u3-can', 'CANCELLATION', u3, soon);
  PERFORM pg_temp.expect(pg_temp.state(u3) = 'pro/cancelled' AND pg_temp.expiry(u3) = soon,
    'future-expiry CANCELLATION -> pro/cancelled until expiry');

  -- Lifetime NON_RENEWING_PURCHASE (NULL expiry), from free and over a subscription.
  PERFORM pg_temp.seed(u4, 'free', 'free', NULL);
  PERFORM pg_temp.ev('u4-nrp', 'NON_RENEWING_PURCHASE', u4, NULL, 'motovault_lifetime_v4');
  PERFORM pg_temp.expect(pg_temp.state(u4) = 'pro/active' AND pg_temp.expiry(u4) IS NULL,
    'lifetime NRP on free user -> pro/active, NULL expiry');
  PERFORM pg_temp.seed(u5, 'pro', 'active', later);
  PERFORM pg_temp.ev('u5-nrp', 'NON_RENEWING_PURCHASE', u5, NULL, 'motovault_lifetime_v3');
  PERFORM pg_temp.expect(pg_temp.state(u5) = 'pro/active' AND pg_temp.expiry(u5) IS NULL,
    'lifetime NRP over a subscription -> NULL expiry');

  -- Time-limited NON_RENEWING_PURCHASE.
  PERFORM pg_temp.seed(u6, 'free', 'expired', past);
  PERFORM pg_temp.ev('u6-nrp', 'NON_RENEWING_PURCHASE', u6, soon, 'season_pass');
  PERFORM pg_temp.expect(pg_temp.state(u6) = 'pro/active' AND pg_temp.expiry(u6) = soon,
    'time-limited NRP on expired user -> pro/active until its expiry');

  PERFORM pg_temp.seed(u7, 'pro', 'active', NULL);
  PERFORM pg_temp.ev('u7-nrp', 'NON_RENEWING_PURCHASE', u7, soon, 'season_pass');
  PERFORM pg_temp.expect(pg_temp.state(u7) = 'pro/active' AND pg_temp.expiry(u7) IS NULL,
    'time-limited NRP on lifetime user keeps NULL expiry');

  PERFORM pg_temp.seed(u8, 'pro', 'active', later);
  PERFORM pg_temp.ev('u8-nrp', 'NON_RENEWING_PURCHASE', u8, soon, 'season_pass');
  PERFORM pg_temp.expect(pg_temp.expiry(u8) = later,
    'time-limited NRP never shortens a later-expiring subscription');

  PERFORM pg_temp.seed(u9, 'pro', 'active', soon);
  PERFORM pg_temp.ev('u9-nrp', 'NON_RENEWING_PURCHASE', u9, later, 'season_pass');
  PERFORM pg_temp.expect(pg_temp.expiry(u9) = later,
    'time-limited NRP extends an earlier-expiring subscription');

  -- Idempotency: a replayed event_id raises and changes nothing.
  PERFORM pg_temp.seed(u10, 'pro', 'active', soon);
  PERFORM pg_temp.ev('u10-exp', 'EXPIRATION', u10, past);
  UPDATE public.users SET subscription_tier = 'pro', subscription_status = 'active' WHERE id = u10;
  BEGIN
    PERFORM pg_temp.ev('u10-exp', 'EXPIRATION', u10, past);
  EXCEPTION WHEN OTHERS THEN
    raised := SQLERRM = 'already_processed';
  END;
  PERFORM pg_temp.expect(raised AND pg_temp.state(u10) = 'pro/active',
    'duplicate event_id -> already_processed, row untouched');

  -- 00187: RevenueCat's resolved entitlement decides (issue #273).
  -- Lifetime + old subscription EXPIRATION / CANCELLATION, in both orders.
  PERFORM pg_temp.seed(u11, 'pro', 'active', NULL);
  PERFORM pg_temp.rc('u11-exp', 'EXPIRATION', u11, past, 'pro', 'active', NULL, 'motovault_pro_monthly_v4');
  PERFORM pg_temp.rc('u11-can', 'CANCELLATION', u11, past, 'pro', 'active', NULL, 'motovault_pro_monthly_v4');
  PERFORM pg_temp.expect(pg_temp.state(u11) = 'pro/active' AND pg_temp.expiry(u11) IS NULL,
    'lifetime + old sub EXPIRATION -> CANCELLATION stays pro/active lifetime');
  PERFORM pg_temp.seed(u12, 'pro', 'active', NULL);
  PERFORM pg_temp.rc('u12-can', 'CANCELLATION', u12, past, 'pro', 'active', NULL, 'motovault_pro_monthly_v4');
  PERFORM pg_temp.rc('u12-exp', 'EXPIRATION', u12, past, 'pro', 'active', NULL, 'motovault_pro_monthly_v4');
  PERFORM pg_temp.expect(pg_temp.state(u12) = 'pro/active' AND pg_temp.expiry(u12) IS NULL,
    'lifetime + old sub CANCELLATION -> EXPIRATION stays pro/active lifetime');

  -- Lifetime refund: RC removed the entitlement -> free/expired.
  PERFORM pg_temp.seed(u13, 'pro', 'active', NULL);
  PERFORM pg_temp.rc('u13-ref', 'CANCELLATION', u13, NULL, 'free', 'expired', NULL, 'motovault_lifetime_v4');
  PERFORM pg_temp.expect(pg_temp.state(u13) = 'free/expired', 'lifetime refund -> free/expired');

  -- Subscription refund: entitlement expired at the refund -> free/expired, expiry recorded.
  PERFORM pg_temp.seed(u14, 'pro', 'active', later);
  PERFORM pg_temp.rc('u14-ref', 'CANCELLATION', u14, past, 'free', 'expired', past, 'motovault_pro_annual_v4');
  PERFORM pg_temp.expect(pg_temp.state(u14) = 'free/expired' AND pg_temp.expiry(u14) = past,
    'subscription refund -> free/expired at the refund time');

  -- A resolved state is written for event types the fallback ignores, and
  -- may lift a row out of 'expired' (e.g. a re-subscribe processed late).
  PERFORM pg_temp.seed(u15, 'free', 'expired', past);
  PERFORM pg_temp.rc('u15-ext', 'SUBSCRIPTION_EXTENDED', u15, NULL, 'pro', 'active', soon);
  PERFORM pg_temp.expect(pg_temp.state(u15) = 'pro/active' AND pg_temp.expiry(u15) = soon,
    'resolved state applies to SUBSCRIPTION_EXTENDED');
  PERFORM pg_temp.rc('u15-can', 'CANCELLATION', u15, soon, 'pro', 'cancelled', soon);
  PERFORM pg_temp.expect(pg_temp.state(u15) = 'pro/cancelled', 'resolved CANCELLATION -> pro/cancelled');

  -- Never-Pro rider with no entitlement at all stays free/free (the event is
  -- still logged); a rider who had Pro becomes free/expired (u13 above).
  PERFORM pg_temp.seed(u20, 'free', 'free', NULL);
  PERFORM pg_temp.rc('u20-tr', 'TRANSFER', u20, NULL, 'free', 'expired', NULL);
  PERFORM pg_temp.rc('u20-can', 'CANCELLATION', u20, NULL, 'free', 'expired', NULL);
  PERFORM pg_temp.expect(pg_temp.state(u20) = 'free/free' AND pg_temp.expiry(u20) IS NULL
    AND (SELECT revenuecat_id FROM public.users WHERE id = u20) = u20::TEXT
    AND (SELECT count(*) FROM public.revenuecat_webhook_events WHERE app_user_id = u20) = 2,
    'never-Pro + no entitlement -> stays free/free, events logged');
  PERFORM pg_temp.seed(u21, 'free', 'expired', past);
  PERFORM pg_temp.rc('u21-can', 'CANCELLATION', u21, NULL, 'free', 'expired', NULL);
  PERFORM pg_temp.expect(pg_temp.state(u21) = 'free/expired' AND pg_temp.expiry(u21) = past,
    'formerly-Pro + no entitlement -> stays free/expired, last expiry kept');

  -- Non-entitlement events (the API sends no p_rc_*): the row is untouched.
  PERFORM pg_temp.seed(u22, 'free', 'free', NULL);
  PERFORM pg_temp.ev('u22-exp', 'EXPERIMENT_ENROLLMENT', u22, NULL);
  PERFORM pg_temp.ev('u22-alias', 'SUBSCRIBER_ALIAS', u22, NULL);
  PERFORM pg_temp.ev('u22-test', 'TEST', u22, NULL);
  PERFORM pg_temp.expect(pg_temp.state(u22) = 'free/free'
    AND (SELECT count(*) FROM public.revenuecat_webhook_events WHERE app_user_id = u22) = 3,
    'non-entitlement events on a never-Pro rider keep free/free');

  -- Resolved trial start still records trial_started_at; resolved TRANSFER
  -- still downgrades the source.
  PERFORM pg_temp.seed(u16, 'free', 'free', NULL);
  PERFORM pg_temp.rc('u16-trial', 'INITIAL_PURCHASE', u16, soon, 'pro', 'trialing', soon, 'motovault_pro_annual_v4', 'TRIAL');
  PERFORM pg_temp.expect(pg_temp.state(u16) = 'pro/trialing'
    AND (SELECT trial_started_at IS NOT NULL FROM public.users WHERE id = u16),
    'resolved trial start -> pro/trialing + trial_started_at');
  PERFORM pg_temp.seed(u17, 'free', 'free', NULL);
  PERFORM public.process_revenuecat_event(
    p_event_id => 'u17-tr', p_event_type => 'TRANSFER', p_app_user_id => u17,
    p_transferred_from => ARRAY[u16], p_rc_tier => 'pro', p_rc_status => 'trialing', p_rc_expires_at => soon);
  PERFORM pg_temp.expect(pg_temp.state(u17) = 'pro/trialing' AND pg_temp.state(u16) = 'free/expired',
    'resolved TRANSFER -> receiver from RC, source downgraded');

  -- Invalid resolved state is rejected (and the event is not logged).
  raised := FALSE;
  BEGIN
    PERFORM pg_temp.rc('u17-bad', 'RENEWAL', u17, NULL, 'gold', 'active', NULL);
  EXCEPTION WHEN OTHERS THEN
    raised := SQLERRM LIKE 'invalid resolved state%';
  END;
  PERFORM pg_temp.expect(raised, 'invalid resolved tier raises');

  -- Contradictory tier/status pairs and a NULL status are rejected too.
  raised := FALSE;
  BEGIN
    PERFORM pg_temp.rc('u17-bad2', 'RENEWAL', u17, NULL, 'free', 'active', NULL);
  EXCEPTION WHEN OTHERS THEN
    raised := SQLERRM LIKE 'invalid resolved state%';
  END;
  PERFORM pg_temp.expect(raised, 'resolved free/active raises');
  raised := FALSE;
  BEGIN
    PERFORM pg_temp.rc('u17-bad3', 'RENEWAL', u17, NULL, 'pro', 'expired', NULL);
  EXCEPTION WHEN OTHERS THEN
    raised := SQLERRM LIKE 'invalid resolved state%';
  END;
  PERFORM pg_temp.expect(raised, 'resolved pro/expired raises');
  raised := FALSE;
  BEGIN
    PERFORM pg_temp.rc('u17-bad4', 'RENEWAL', u17, NULL, 'pro', NULL, NULL);
  EXCEPTION WHEN OTHERS THEN
    raised := SQLERRM LIKE 'invalid resolved state%';
  END;
  PERFORM pg_temp.expect(raised, 'resolved pro with NULL status raises');
  PERFORM pg_temp.expect(pg_temp.state(u17) = 'pro/trialing'
    AND NOT EXISTS (SELECT 1 FROM public.revenuecat_webhook_events WHERE event_id LIKE 'u17-bad%'),
    'rejected resolved states leave the row and the event log untouched');

  -- Caller-role guard: a PostgREST call carrying an end-user JWT (anon or
  -- authenticated) is refused even by a role that holds EXECUTE, and neither
  -- logs the event nor touches the row.
  PERFORM pg_temp.seed(u18, 'free', 'free', NULL);
  FOREACH end_user_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    raised := FALSE;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('role', end_user_role)::TEXT, true);
      PERFORM pg_temp.rc('u18-' || end_user_role, 'RENEWAL', u18, NULL, 'pro', 'active', NULL);
    EXCEPTION WHEN insufficient_privilege THEN
      raised := SQLERRM LIKE 'process_revenuecat_event: not allowed for role%';
    END;
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM pg_temp.expect(raised AND pg_temp.state(u18) = 'free/free'
      AND NOT EXISTS (SELECT 1 FROM public.revenuecat_webhook_events WHERE app_user_id = u18),
      format('%s JWT is refused, nothing written', end_user_role));
  END LOOP;

  -- Split apply (DROP+CREATE committed, REVOKE not yet): anon holds EXECUTE
  -- through the default privileges and calls as itself. The guard still refuses.
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', sig);
  raised := FALSE;
  BEGIN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SET LOCAL ROLE anon;
    PERFORM public.process_revenuecat_event(
      p_event_id => 'u18-split', p_event_type => 'RENEWAL', p_app_user_id => u18,
      p_rc_tier => 'pro', p_rc_status => 'active');
  EXCEPTION WHEN OTHERS THEN
    raised := SQLERRM LIKE 'process_revenuecat_event: not allowed for role%';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', sig);
  PERFORM pg_temp.expect(raised AND pg_temp.state(u18) = 'free/free',
    'split apply: anon with EXECUTE still cannot self-grant Pro');

  -- Claims without a role (PostgREST runs them as anon) and any other role
  -- are refused too: the guard is an allowlist.
  FOREACH end_user_role IN ARRAY ARRAY['{}', '{"role":"supabase_storage_admin"}'] LOOP
    raised := FALSE;
    BEGIN
      PERFORM set_config('request.jwt.claims', end_user_role, true);
      PERFORM pg_temp.rc('u18-claims-' || md5(end_user_role), 'RENEWAL', u18, NULL, 'pro', 'active', NULL);
    EXCEPTION WHEN insufficient_privilege THEN
      raised := SQLERRM LIKE 'process_revenuecat_event: not allowed for role%';
    END;
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM pg_temp.expect(raised AND pg_temp.state(u18) = 'free/free',
      format('claims %s are refused', end_user_role));
  END LOOP;

  -- The API's own path (service_role JWT through PostgREST) is allowed; a
  -- direct database session (no JWT, as everywhere above) is allowed too.
  PERFORM pg_temp.seed(u19, 'free', 'free', NULL);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM pg_temp.rc('u19-sr', 'RENEWAL', u19, NULL, 'pro', 'active', soon);
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM pg_temp.expect(pg_temp.state(u19) = 'pro/active', 'service_role JWT is allowed');

  -- Only the 16-argument version exists (no PGRST203 ambiguity).
  PERFORM pg_temp.expect(to_regprocedure(old_sig) IS NULL, '13-argument overload dropped');
  PERFORM pg_temp.expect(
    (SELECT count(*) FROM pg_proc WHERE proname = 'process_revenuecat_event') = 1,
    'exactly one process_revenuecat_event');

  -- ACL: service_role only, stale grants cleared.
  PERFORM pg_temp.expect(NOT has_function_privilege('anon', sig, 'EXECUTE'), 'anon has no EXECUTE');
  PERFORM pg_temp.expect(NOT has_function_privilege('authenticated', sig, 'EXECUTE'), 'authenticated has no EXECUTE');
  PERFORM pg_temp.expect(has_function_privilege('service_role', sig, 'EXECUTE'), 'service_role has EXECUTE');
  PERFORM pg_temp.expect(
    (SELECT prosecdef FROM pg_proc WHERE oid = sig::regprocedure), 'function is SECURITY DEFINER');
END $$;

ROLLBACK;

\echo 'process_revenuecat_event (00187): all checks passed'
