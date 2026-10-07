-- Signup event consent: let the app's saved decision land first (PR #261).
--
-- From mobile 3.21.0 riders in the EEA/UK/CH answer a consent screen, often
-- BEFORE the account exists; the app saves that decision to
-- `preferences.privacy` on the first signed-in load. 00174/00175 claimed new
-- accounts on the next 10-minute tick and turned a missing decision into TRUE
-- in SQL, so a rider who had just declined could be identified at signup.
--
-- Two changes, nothing else:
--   1. Claim only accounts older than 10 minutes, so the app's upload lands
--      first. Events keep `timestamp = created_at`, so daily counts don't move;
--      they arrive up to ~20 minutes after signup instead of ~10.
--   2. Return the stored value as-is (NULL when none is saved) instead of
--      COALESCE(..., TRUE), so the API — not SQL — owns the consent rule.
--      signup-events.service treats only a saved FALSE as "no" for now (NULL
--      still counts as consent: apps before 3.21.0 save no decision).
--
-- Safe with the current API: it already treats anything but FALSE as consent.
-- CREATE OR REPLACE keeps the existing ACL (EXECUTE revoked from PUBLIC/anon in
-- 00174) and the signature is unchanged.

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
    -- NULL = no decision saved; the API decides what that means (see header).
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
  'Atomically claims up to p_limit users (older than 10 minutes) with no signup event yet and returns the properties needed to emit it. analytics_enabled is the stored decision, or NULL when none is saved; the API applies the consent rule (00183). Only rows this call inserted are returned, so overlapping ticks cannot double-emit.';

-- Smoke check, as in 00175: abort instead of reporting success if the function raises.
DO $$
BEGIN
  PERFORM * FROM public.claim_pending_signup_events(0);
END;
$$;
