-- Repeatable check for public.process_revenuecat_event as defined by
-- migrations/00185_revenuecat_non_renewing_expiry.sql.
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

-- The migration under test.
\ir ../migrations/00185_revenuecat_non_renewing_expiry.sql

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
  sig CONSTANT TEXT := 'public.process_revenuecat_event(text,text,uuid,timestamptz,text,text,text,text,boolean,timestamptz,timestamptz,uuid[],jsonb)';
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

  -- ACL: service_role only, stale grants cleared.
  PERFORM pg_temp.expect(NOT has_function_privilege('anon', sig, 'EXECUTE'), 'anon has no EXECUTE');
  PERFORM pg_temp.expect(NOT has_function_privilege('authenticated', sig, 'EXECUTE'), 'authenticated has no EXECUTE');
  PERFORM pg_temp.expect(has_function_privilege('service_role', sig, 'EXECUTE'), 'service_role has EXECUTE');
  PERFORM pg_temp.expect(
    (SELECT prosecdef FROM pg_proc WHERE oid = sig::regprocedure), 'function is SECURITY DEFINER');
END $$;

ROLLBACK;

\echo 'process_revenuecat_event (00185): all checks passed'
