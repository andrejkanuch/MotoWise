-- Fix: claim_pending_signup_events has never been able to claim anything.
--
-- THE BUG
-- 00174 declared the function as
--   RETURNS TABLE (user_id UUID, created_at TIMESTAMPTZ, ...)
-- which makes `user_id` a PL/pgSQL variable inside the body. The body then does
--   INSERT INTO public.signup_event_log (user_id) ... ON CONFLICT (user_id) DO NOTHING
-- and PostgreSQL cannot tell whether `user_id` in the ON CONFLICT target means the
-- OUT parameter or the column:
--
--   ERROR: 42702: column reference "user_id" is ambiguous
--   DETAIL: It could refer to either a PL/pgSQL variable or a table column.
--   CONTEXT: PL/pgSQL function public.claim_pending_signup_events(integer)
--            line 3 at RETURN QUERY
--
-- So the function raised on EVERY call and claimed zero users, from the moment
-- 00174 was applied (2026-08-24) until this migration.
--
-- WHY IT LOOKED HEALTHY FOR A DAY
-- `SignupEventsService.sweepPendingSignups()` catches the RPC error, logs it, and
-- returns `{claimed: 0, identified: 0, anonymous: 0, released: 0}` — which is
-- byte-identical to the response for "there is nothing pending", and identical
-- again to the fail-closed path taken when POSTHOG_PROJECT_TOKEN is unset. The
-- webhook therefore answered HTTP 200 `status: ok` on every tick while doing
-- nothing, and pg_cron recorded 19 consecutive "succeeded" runs.
--
-- It was caught only because a real user signed up at 2026-08-25 08:07 UTC and was
-- still unclaimed three hours later. `claimed: 0` is indistinguishable from success
-- until there is something to claim — which is precisely why this unit's acceptance
-- gate is a reconciliation against Postgres and not a passing test suite. The 14
-- unit tests all mock the RPC, so none of them ever executed this SQL.
--
-- THE FIX
-- `#variable_conflict use_column` tells PL/pgSQL to resolve an ambiguous identifier
-- to the column rather than the variable. That is the correct precedence here: the
-- only bare, unqualified occurrences of these names in the body are the INSERT
-- column list and the ON CONFLICT target, and both mean the column.
--
-- Renaming the OUT parameters was the alternative and was rejected: the service
-- reads `user_id`, `created_at`, `auth_method`, `analytics_enabled`, `currency` and
-- `measurement_system` by name off the RPC result (see `PendingSignupRow` in
-- apps/api/src/modules/analytics/signup-events.service.ts), so renaming them would
-- silently return nulls instead of failing loudly.
--
-- Body is otherwise byte-for-byte 00174's. No behaviour change beyond working.

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
    COALESCE((u.preferences->'privacy'->>'analyticsEnabled')::BOOLEAN, TRUE),
    u.currency::TEXT,
    u.measurement_system::TEXT
  FROM claimed c
  JOIN public.users u ON u.id = c.id
  LEFT JOIN auth.users au ON au.id = u.id
  ORDER BY u.created_at;
END;
$$;

COMMENT ON FUNCTION public.claim_pending_signup_events(INT) IS
  'Atomically claims up to p_limit users with no signup event yet and returns the properties needed to emit it. Only rows this call inserted are returned, so overlapping ticks cannot double-emit. Requires #variable_conflict use_column: the RETURNS TABLE column names shadow the real columns in the ON CONFLICT target (fixed in 00175).';

-- Sanity check, so a repeat of this failure cannot be applied silently. If the
-- function still raises, this migration aborts instead of reporting success.
DO $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  -- p_limit = 0 exercises the whole query plan (including the ON CONFLICT target
  -- that was ambiguous) while being unable to claim anybody.
  PERFORM * FROM public.claim_pending_signup_events(0);
  v_ok := TRUE;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'claim_pending_signup_events smoke check did not run';
  END IF;
END;
$$;
