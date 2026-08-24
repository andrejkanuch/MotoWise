-- One canonical signup event, emitted server-side.
--
-- THE PROBLEM
-- Signup has never been countable. On 2026-08-24 production had 320 signups in
-- 90 days, while PostHog held 154 `account_created` and 62 `user_signed_up`
-- events. Every previous attempt was client-side and drifted per auth path:
-- `account_created` fires from ONE onboarding screen (so it measures screen
-- traversal, not signup), and `user_signed_up` fires from the auth screens with
-- a different new-vs-returning heuristic on each. A 2026-06-09 fix
-- (docs/solutions/integration-issues/posthog-onboarding-funnel-instrumentation.md)
-- closed the OAuth undercount, shipped, and set the acceptance criterion
-- "`user_signed_up` unique users ~= new auth.users rows for that month". That
-- criterion is still failing by ~5x, because web signups were deferred and any
-- client-side signal can only see the paths someone remembered to instrument.
--
-- The `public.users` row insert is the only place that sees every signup on
-- every platform, so that is what this counts.
--
-- WHY A SWEEP AND NOT A TRIGGER ON INSERT
-- An AFTER INSERT trigger that calls pg_net would run inside the auth.users
-- transaction that creates the account. If enqueueing ever raised — extension
-- missing, permissions changed, queue table full — it would abort the insert and
-- BREAK SIGNUP to protect an analytics event. That trade is unacceptable, and an
-- exception-swallowing wrapper is a silent-failure mode instead.
--
-- A sweep is also strictly better on three of this unit's requirements:
--   * idempotency is structural (PK on the log, ON CONFLICT DO NOTHING), not
--     dependent on retry semantics;
--   * a capture failure cannot roll back the signup, because the two are in
--     different transactions;
--   * it reads the user's analytics consent AFTER onboarding has had a chance to
--     set it, which an insert-time hook cannot do — at insert time `preferences`
--     is still NULL for every user.
--
-- Delay does not distort the data: the API backdates each event to the row's
-- `created_at`, so a user who signed up at 09:58 is reported at 09:58 whether the
-- sweep runs at 10:00 or 10:10.
--
-- Mirrors the established shape of 00162 (maintenance push) and 00173 (idle-ride
-- sweep): dedup log + SECURITY DEFINER claim RPC + pg_net trigger reading a Vault
-- secret + pg_cron schedule.

-- ---------------------------------------------------------------------------
-- 1. Dedup log — the idempotency guarantee
-- ---------------------------------------------------------------------------
-- user_id is the PRIMARY KEY, not merely unique: exactly one signup event may
-- ever exist per user. That is what makes a re-run, an overlapping cron tick, or
-- a duplicated webhook delivery harmless.
CREATE TABLE IF NOT EXISTS public.signup_event_log (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.signup_event_log ENABLE ROW LEVEL SECURITY;

-- No policies + revoked grants: anon/authenticated have no access. The sweep runs
-- through SECURITY DEFINER functions; the service-role client bypasses RLS.
REVOKE ALL ON public.signup_event_log FROM anon, authenticated;

COMMENT ON TABLE public.signup_event_log IS
  'One row per user whose canonical signup event has been claimed for emission to PostHog. PRIMARY KEY on user_id guarantees at-most-once emission. Deleting a row makes the sweep re-emit that user, which is the supported way to force a backfill.';

-- ---------------------------------------------------------------------------
-- 2. Claim RPC
-- ---------------------------------------------------------------------------
-- Claim-then-send, matching 00173. The INSERT ... ON CONFLICT DO NOTHING
-- RETURNING is what makes this concurrency-safe without an advisory lock: two
-- simultaneous ticks cannot both win the same row, and only rows this call
-- actually inserted are returned for emission.
--
-- auth.users is joined for the auth provider, which is the one property worth
-- segmenting on that public.users does not carry. Reading auth.users is why this
-- must be SECURITY DEFINER.
--
-- `role = 'user'` excludes admin/staff rows, so an account created by hand in the
-- dashboard never reports as a signup.
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
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT u.id
    FROM public.users u
    LEFT JOIN public.signup_event_log l ON l.user_id = u.id
    WHERE l.user_id IS NULL
      AND u.role = 'user'
      AND u.deleted_at IS NULL
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
    -- Supabase records the identity provider on auth.users; 'email' is the
    -- default for password signups. COALESCE keeps the property present rather
    -- than null so PostHog breakdowns do not grow an "unknown" bucket silently.
    COALESCE(au.raw_app_meta_data->>'provider', 'email')::TEXT,
    -- Consent. The app's own default is ON (privacy.tsx DEFAULTS
    -- analyticsEnabled: true), and at signup `preferences` is NULL, so absent
    -- means consented. Only an EXPLICIT false counts as a refusal — matching
    -- exactly what the client-side gate does for every other event.
    COALESCE((u.preferences->'privacy'->>'analyticsEnabled')::BOOLEAN, TRUE),
    u.currency::TEXT,
    u.measurement_system::TEXT
  FROM claimed c
  JOIN public.users u ON u.id = c.id
  LEFT JOIN auth.users au ON au.id = u.id
  ORDER BY u.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_signup_events(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_pending_signup_events(INT) FROM anon, authenticated;

COMMENT ON FUNCTION public.claim_pending_signup_events(INT) IS
  'Atomically claims up to p_limit users with no signup event yet and returns the properties needed to emit it. Only rows this call inserted are returned, so overlapping ticks cannot double-emit.';

-- ---------------------------------------------------------------------------
-- 3. Release RPC — so a failed capture retries instead of vanishing
-- ---------------------------------------------------------------------------
-- Claim-before-send means a PostHog outage would otherwise burn the claim. The
-- API releases the batch when the capture fails outright, and the next tick
-- picks it up again.
CREATE OR REPLACE FUNCTION public.release_signup_event_claims(p_user_ids UUID[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_released INT;
BEGIN
  DELETE FROM public.signup_event_log
  WHERE user_id = ANY(COALESCE(p_user_ids, ARRAY[]::UUID[]));
  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

REVOKE ALL ON FUNCTION public.release_signup_event_claims(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_signup_event_claims(UUID[]) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Seed the log with everyone who already exists
-- ---------------------------------------------------------------------------
-- Without this, the first tick would emit a backdated signup event for all ~577
-- existing users. That is deliberately suppressed: the acceptance gate for this
-- work is forward-looking ("the first FULL calendar month after the event
-- ships"), and 577 historical events would overlap the existing account_created
-- / user_signed_up series and make that month ambiguous.
--
-- To force a backfill later, delete the seeded rows for the range you want.
INSERT INTO public.signup_event_log (user_id, claimed_at)
SELECT id, NOW() FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Cron trigger
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.cron_trigger_signup_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'signup_event_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE WARNING 'signup_event_secret missing from Vault; skipping signup-event sweep';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://motowise.onrender.com/webhooks/signup-events',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-signup-event-secret', v_secret
    ),
    timeout_milliseconds := 30000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cron_trigger_signup_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_trigger_signup_events() FROM anon, authenticated, service_role;

-- Every 10 minutes. Frequency is a freshness choice only, not a correctness one:
-- events are backdated to created_at, so a slower schedule would produce the same
-- monthly counts. Extra ticks are free because the log makes them no-ops.
SELECT cron.schedule(
  'signup-events',
  '*/10 * * * *',
  $$ SELECT public.cron_trigger_signup_events() $$
);

-- ---------------------------------------------------------------------------
-- 6. The reconciliation query — the actual acceptance gate for this unit
-- ---------------------------------------------------------------------------
-- The gate is NOT a green test suite (the June 2026 fix had one of those too). It
-- is this count matching PostHog's `signup_completed` unique users within +/-10%
-- for a full calendar month. The filters below MUST match
-- claim_pending_signup_events exactly, or the gate fails for a reason that does
-- not exist and sends someone hunting a phantom bug:
--
--   SELECT date_trunc('month', created_at) AS month, COUNT(*)
--   FROM public.users
--   WHERE role = 'user'
--     AND deleted_at IS NULL
--     AND created_at >= '2026-09-01' AND created_at < '2026-10-01'
--   GROUP BY 1;
--
-- Two ways to get this wrong, both of which look like a bug:
--   * comparing a partial deployment month against a full month of rows;
--   * omitting the role/deleted_at filters, which inflates the denominator.
