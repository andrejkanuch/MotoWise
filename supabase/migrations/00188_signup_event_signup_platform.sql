-- Signup event: return where the account was created (signup_platform).
--
-- PostHog cannot split `signup_completed` by platform, so it cannot measure how
-- many web signups open the app. From this change the web writes
-- `raw_user_meta_data.signup_platform = 'web'`: in `signUp` options for an email
-- sign-up, and from the OAuth callback for a new Google/Apple account. This
-- function now returns that value; the API sends it as `signup_platform`.
--
-- A new OUT column changes the return type, which CREATE OR REPLACE cannot do,
-- so the function is dropped and re-created. That resets its ACL to the
-- defaults (EXECUTE for PUBLIC and, through this project's default privileges,
-- anon and authenticated), so the 00174 revokes are applied again below. The
-- body is otherwise identical to 00184.
--
-- The rider can edit their own user metadata, but this only labels THEIR OWN
-- signup event, and the API accepts only the known value.
-- 00187 is taken by an open branch.

DROP FUNCTION IF EXISTS public.claim_pending_signup_events(INT);

CREATE FUNCTION public.claim_pending_signup_events(p_limit INT DEFAULT 200)
RETURNS TABLE (
  user_id UUID,
  created_at TIMESTAMPTZ,
  auth_method TEXT,
  analytics_enabled BOOLEAN,
  currency TEXT,
  measurement_system TEXT,
  signup_platform TEXT
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
    u.measurement_system::TEXT,
    -- Where the account was created, as the web writes it at sign-up. NULL for
    -- app sign-ups, which send no tag. `->>` never raises, whatever the type.
    au.raw_user_meta_data->>'signup_platform'
  FROM claimed c
  JOIN public.users u ON u.id = c.id
  LEFT JOIN auth.users au ON au.id = u.id
  ORDER BY u.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_signup_events(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_pending_signup_events(INT) FROM anon, authenticated;

COMMENT ON FUNCTION public.claim_pending_signup_events(INT) IS
  'Atomically claims up to p_limit users (older than 10 minutes) with no signup event yet and returns the properties needed to emit it. analytics_enabled is the account''s saved decision, else the decision sent with sign-up (raw_user_meta_data.analytics_consent), else NULL; only JSON booleans are read; the API applies the consent rule (00184). signup_platform is raw_user_meta_data.signup_platform as text, NULL when absent (00188). Only rows this call inserted are returned, so overlapping ticks cannot double-emit.';

-- Smoke check: abort instead of reporting success if the function raises.
DO $$
BEGIN
  PERFORM * FROM public.claim_pending_signup_events(0);
END;
$$;
