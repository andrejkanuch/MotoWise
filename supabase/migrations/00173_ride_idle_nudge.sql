-- Idle-ride nudge + auto-end safety net.
--
-- Riders forget to stop recording. Measured on 2026-08-03: 10 rides sat in
-- `recording` indefinitely (max 72 days, 10 distinct users ≈ 25% of active
-- riders), and 8 of those 10 had ZERO waypoints — the device had stopped
-- reporting entirely. That last fact is why this lives server-side: a
-- client-only timer cannot fire in an app that was killed or is offline.
--
-- Two stages, both driven by "last signal" = latest waypoint, falling back to
-- started_at when a ride never produced one:
--   * idle >= 2h   -> one push asking whether the ride is still going
--   * idle >= 24h  -> auto-end, with ended_at TRIMMED BACK to the last signal
--
-- Trimming matters: `startRide`'s stale-ride cleanup used to complete abandoned
-- rides with `ended_at = now()`, which is what manufactured the 605-hour
-- (25-day) "completed" rides polluting history, rollups and records.
--
-- A ride still receiving waypoints is NEVER auto-ended regardless of total
-- duration — a genuine 14-hour iron-butt day must survive untouched.

-- ---------------------------------------------------------------------------
-- 1. Mark auto-ended rides so stats can exclude them
-- ---------------------------------------------------------------------------
-- A dedicated column rather than a `metadata` key: rollups/records need to
-- FILTER on this cheaply, and a jsonb predicate can't use a plain index.
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS auto_ended_reason TEXT;

ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_auto_ended_reason_check;
ALTER TABLE public.rides ADD CONSTRAINT rides_auto_ended_reason_check
  CHECK (auto_ended_reason IS NULL OR auto_ended_reason IN ('idle_timeout', 'stale_on_start'));

COMMENT ON COLUMN public.rides.auto_ended_reason IS
  'Set when the ride was ended by the system rather than the rider: idle_timeout (24h no signal, closed by the idle sweep) or stale_on_start (superseded when a newer ride began). NULL for rider-ended rides. Excluded from records/rollups so a forgotten ride cannot set a personal best.';

-- Partial index: the only queries are "find/exclude auto-ended rides", so index
-- just those rows rather than the (overwhelmingly NULL) whole column.
CREATE INDEX IF NOT EXISTS idx_rides_auto_ended
  ON public.rides (user_id, auto_ended_reason)
  WHERE auto_ended_reason IS NOT NULL;

-- Finding candidate rides is the sweep's hot path: status + not-deleted.
CREATE INDEX IF NOT EXISTS idx_rides_active_for_idle_sweep
  ON public.rides (started_at)
  WHERE status IN ('recording', 'paused') AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Dedup log (mirrors maintenance_push_log)
-- ---------------------------------------------------------------------------
-- UNIQUE(ride_id, stage) makes the sweep idempotent: an hourly cron tick can
-- re-evaluate the same idle ride without re-pushing. Rows are claimed BEFORE
-- the Expo send and released when the send fully fails, so a lost push retries.
CREATE TABLE IF NOT EXISTS public.ride_idle_nudge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('nudge', 'auto_end')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ride_id, stage)
);

ALTER TABLE public.ride_idle_nudge_log ENABLE ROW LEVEL SECURITY;

-- No policies + revoked grants: anon/authenticated have no access; the
-- service-role client used by the sweep bypasses RLS.
REVOKE ALL ON public.ride_idle_nudge_log FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_ride_idle_nudge_log_user
  ON public.ride_idle_nudge_log (user_id);

COMMENT ON TABLE public.ride_idle_nudge_log IS
  'Dedup log for the idle-ride sweep. Service-role only; UNIQUE(ride_id, stage) guarantees one nudge and one auto-end per ride.';

-- ---------------------------------------------------------------------------
-- 3. Hourly cron trigger (mirrors 00162)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Reads the Vault secret and POSTs the sweep endpoint. SECURITY DEFINER so only
-- the cron job can read the secret. The Vault secret `ride_idle_secret` and the
-- API's RIDE_IDLE_SECRET must match, or the endpoint rejects the call (401).
CREATE OR REPLACE FUNCTION public.cron_trigger_ride_idle_check()
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
  WHERE name = 'ride_idle_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE WARNING 'ride_idle_secret missing from Vault; skipping idle-ride sweep';
    RETURN;
  END IF;

  -- 30s timeout to match the maintenance push trigger: the endpoint does several
  -- DB round-trips plus an Expo call and can cold-start on Render.
  PERFORM net.http_post(
    url := 'https://motowise.onrender.com/webhooks/ride-idle-check',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ride-idle-secret', v_secret
    ),
    timeout_milliseconds := 30000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cron_trigger_ride_idle_check() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_trigger_ride_idle_check() FROM anon, authenticated, service_role;

-- Hourly, not daily: a 2h nudge threshold needs finer granularity than the
-- once-a-day maintenance push, and the dedup log makes extra ticks free.
-- Idempotent: re-running updates the existing schedule rather than duplicating.
SELECT cron.schedule(
  'ride-idle-check',
  '7 * * * *',
  $$ SELECT public.cron_trigger_ride_idle_check() $$
);
