-- Signup event consent: no decision is not consent (PR #261).
--
-- 00174/00175 defaulted a missing `preferences.privacy.analyticsEnabled` to TRUE,
-- justified by the app's old Privacy-screen default (analyticsEnabled: true).
-- From mobile 3.21.0 riders in the EEA/UK/CH opt in on a consent screen, often
-- BEFORE the account exists, and the app saves that decision to the account on
-- the first signed-in load. With the TRUE default, the sweep identified every
-- new account in PostHog — including riders who had just declined.
--
-- Two changes, nothing else:
--   1. Return the stored value as-is (NULL when absent). signup-events.service
--      sends an identified event only for an explicit TRUE; NULL and FALSE go to
--      the shared anonymous bucket, so the signup is still counted.
--   2. Claim only accounts older than 10 minutes, so the app's consent upload
--      lands first and consenting riders are still identified.
--
-- Deploy order is free: old API + this function treats NULL as `!== false`
-- (consented, as today); new API + old function sees TRUE for NULL (as today).
-- CREATE OR REPLACE keeps the existing ACL (EXECUTE was revoked from PUBLIC and
-- anon in 00174), and the signature is unchanged.

CREATE OR REPLACE FUNCTION public.claim_pending_signup_events(p_limit INT DEFAULT 200)
RETURNS TABLE (
  user_id UUID,
  created_at TIMESTAMPTZ,
  auth_method TEXT,
  analytics_enabled BOOLEAN,
  currency TEXT,
  measurement_system TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT u.id
    FROM public.users u
    LEFT JOIN public.signup_event_log l ON l.user_id = u.id
    WHERE l.user_id IS NULL
      AND u.role = 'user'
      AND u.deleted_at IS NULL
      -- Give the app time to save the rider's consent decision to the account
      -- (the root layout uploads the device decision on the first signed-in
      -- load). Signups are still emitted, just a few minutes later.
      AND u.created_at < now() - INTERVAL '10 minutes'
    ORDER BY u.created_at
    LIMIT GREATEST(p_limit, 0)
  ),
  claimed AS (
    INSERT INTO public.signup_event_log (user_id)
    SELECT c.id FROM candidates c
    ON CONFLICT (user_id) DO NOTHING
    RETURNING public.signup_event_log.user_id AS id
  )
  SELECT
    u.id,
    u.created_at,
    COALESCE(au.raw_app_meta_data->>'provider', 'email')::TEXT,
    -- NULL = no decision saved. The API treats only an explicit TRUE as
    -- consent, so an undecided or declining rider is counted anonymously.
    (u.preferences->'privacy'->>'analyticsEnabled')::BOOLEAN,
    u.currency::TEXT,
    u.measurement_system::TEXT
  FROM claimed c
  JOIN public.users u ON u.id = c.id
  LEFT JOIN auth.users au ON au.id = u.id
  ORDER BY u.created_at;
END;
$$;

COMMENT ON FUNCTION public.claim_pending_signup_events(INT) IS
  'Atomically claims up to p_limit users (older than 10 minutes) with no signup event yet and returns the properties needed to emit it. analytics_enabled is the stored decision or NULL when none is saved; only TRUE means consent (00183). Only rows this call inserted are returned, so overlapping ticks cannot double-emit.';

-- Smoke check, as in 00175: abort instead of reporting success if the function raises.
DO $$
BEGIN
  PERFORM * FROM public.claim_pending_signup_events(0);
END;
$$;
