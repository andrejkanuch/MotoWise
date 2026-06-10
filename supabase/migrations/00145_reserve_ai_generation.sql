-- Migration: 00145_reserve_ai_generation (audit H6 + H7)
--
-- TOCTOU fix for per-user AI quota metering: the API previously counted
-- content_generation_log rows and then inserted the log row AFTER the OpenAI
-- call, so N concurrent requests all passed the count check and overran the
-- limit (H6). This RPC makes the reservation row BE the log row: it takes a
-- per-user advisory lock, counts today's non-failed rows, and atomically
-- inserts a 'pending' row that the service later finalizes to
-- 'success'/'failed' with model/tokens/cost. Because the pending row exists
-- before any money is spent, surfaces that previously "forgot" to log
-- (onboarding insights — H7) are now structurally forced to.
--
-- SECURITY: this function takes p_user_id INSTEAD of auth.uid(). That is a
-- deliberate exception to the house rule ("user-callable RPCs must use
-- auth.uid()"): it is a system-side metering primitive called ONLY by the
-- NestJS API via the service_role client (where auth.uid() IS NULL). The
-- forgeability hole is closed by grants, not by identity derivation:
-- EXECUTE is revoked from PUBLIC/anon/authenticated and granted to
-- service_role only, so no PostgREST caller can reach it.

BEGIN;

-- Allow the new 'pending' reservation state and the onboarding_insights
-- surface (H7: insights generations were invisible to budgets until now).
ALTER TABLE public.content_generation_log
  DROP CONSTRAINT IF EXISTS content_generation_log_status_check;

ALTER TABLE public.content_generation_log
  ADD CONSTRAINT content_generation_log_status_check
  CHECK (status IN ('pending', 'success', 'failed', 'rate_limited', 'rejected'));

ALTER TABLE public.content_generation_log
  DROP CONSTRAINT IF EXISTS content_generation_log_content_type_check;

ALTER TABLE public.content_generation_log
  ADD CONSTRAINT content_generation_log_content_type_check
  CHECK (
    content_type IN (
      'article',
      'quiz',
      'diagnostic_response',
      'diagnostic',
      'ride_summary',
      'trip_assistant',
      'onboarding_insights'
    )
  );

CREATE OR REPLACE FUNCTION public.reserve_ai_generation(
  p_user_id uuid,
  p_content_type text,
  p_daily_limit integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- Serialize concurrent reservations for this user: the count below is only
  -- race-free while competing transactions queue on this lock (released at
  -- commit/rollback).
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Today's (UTC) reservations + completions. Failed generations don't count
  -- against the quota; pending rows DO (that's the whole point — a concurrent
  -- in-flight generation already holds a slot).
  SELECT count(*)
  INTO v_count
  FROM public.content_generation_log
  WHERE user_id = p_user_id
    AND content_type = p_content_type
    AND status <> 'failed'
    AND created_at >= (date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc');

  IF v_count >= p_daily_limit THEN
    RAISE EXCEPTION 'daily_limit_exceeded';
  END IF;

  INSERT INTO public.content_generation_log (user_id, content_type, status)
  VALUES (p_user_id, p_content_type, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Money/quota RPC: service_role only (see header — p_user_id would otherwise
-- be forgeable by any authenticated PostgREST caller).
REVOKE ALL ON FUNCTION public.reserve_ai_generation(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(uuid, text, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
