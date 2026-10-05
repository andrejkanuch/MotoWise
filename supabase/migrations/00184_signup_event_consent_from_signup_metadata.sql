-- Signup event consent: fall back to the decision sent with sign-up (PR #261).
--
-- 00183 made the sweep wait 10 minutes so the app's consent upload lands first.
-- That upload needs a session, and an email sign-up has none until the address
-- is confirmed — so a rider who declined and confirms after 10 minutes (or never)
-- was claimed with no saved decision, which the API counts as consent.
--
-- From mobile 3.21.0 the app sends the rider's decision with `signUp` as
-- `raw_user_meta_data.analytics_consent` (OAuth sign-ins have a session at once
-- and upload normally). This function now reads, in order:
--   1. preferences.privacy.analyticsEnabled (the account's decision),
--   2. raw_user_meta_data.analytics_consent (the decision at sign-up),
--   3. NULL.
-- Both reads accept only a JSON boolean: the old `->>…::BOOLEAN` cast raised on
-- any other value and aborted the whole sweep (pre-existing since 00174).
--
-- The rider can edit their own user metadata, but this only decides whether
-- THEIR OWN signup event is identified. CREATE OR REPLACE keeps the ACL (EXECUTE
-- revoked from PUBLIC/anon/authenticated in 00174); the signature is unchanged.
-- 00180-00182 are reserved by an unmerged branch.

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
    -- The account's saved decision, else the decision sent with an email
    -- sign-up, else NULL (no decision; the API decides what that means). Only a
    -- JSON boolean is read: a cast of any other value would raise and abort the
    -- whole sweep for everyone.
    CASE
      WHEN jsonb_typeof(u.preferences->'privacy'->'analyticsEnabled') = 'boolean'
        THEN (u.preferences->'privacy'->'analyticsEnabled')::BOOLEAN
      WHEN jsonb_typeof(au.raw_user_meta_data->'analytics_consent') = 'boolean'
        THEN (au.raw_user_meta_data->'analytics_consent')::BOOLEAN
      ELSE NULL
    END,
    u.currency::TEXT,
    u.measurement_system::TEXT
  FROM claimed c
  JOIN public.users u ON u.id = c.id
  LEFT JOIN auth.users au ON au.id = u.id
  ORDER BY u.created_at;
END;
$$;

COMMENT ON FUNCTION public.claim_pending_signup_events(INT) IS
  'Atomically claims up to p_limit users (older than 10 minutes) with no signup event yet and returns the properties needed to emit it. analytics_enabled is the account''s saved decision, else the decision sent with sign-up (raw_user_meta_data.analytics_consent), else NULL; only JSON booleans are read; the API applies the consent rule (00184). Only rows this call inserted are returned, so overlapping ticks cannot double-emit.';

-- Smoke check: abort instead of reporting success if the function raises.
DO $$
BEGIN
  PERFORM * FROM public.claim_pending_signup_events(0);
END;
$$;
