-- Migration: 00198_ride_stats_sweep_cron
-- Rider insights: schedule the per-ride stats sweep.
--
-- Every 10 minutes pg_cron calls cron_trigger_ride_stats_sweep(), which reads
-- the Vault secret `ride_stats_sweep_secret` and POSTs the API's
-- /webhooks/ride-stats-sweep with it in the `x-ride-stats-secret` header. Each
-- call computes up to 10 stale rides (no ride_stats row, an older
-- stats_version, or a track changed after the row was computed): this is both
-- the backfill of existing rides and the catch-up for completion events the
-- API lost. Same pattern as 00173 (idle-ride sweep).
--
-- PREREQUISITES (in this order; docs/runbooks/rider-insights-data.md):
--   * 00197 applied and verified, and the reference geodata loaded
--     (scripts/load-ref-geodata.ts). While ref_country_parts is empty the
--     sweep leaves rides stale and reports it, so loading first avoids noise.
--   * The API build that serves POST /webhooks/ride-stats-sweep is DEPLOYED.
--     Before that the endpoint 404s on every tick.
--   * The same random value is set as the Vault secret `ride_stats_sweep_secret`
--     AND as RIDE_STATS_SWEEP_SECRET on Render (env changes need a new deploy).
--     If they differ the endpoint answers 401; if the Vault secret is missing
--     the trigger logs a WARNING and skips the tick.
--
-- Apply as ONE statement batch (one Management API call) with this leading
-- comment block stripped, record version 00198 in
-- supabase_migrations.schema_migrations, then run the footer queries.
--
-- ROLLBACK:
--   SELECT cron.unschedule('ride-stats-sweep');
--   DROP FUNCTION public.cron_trigger_ride_stats_sweep();

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Reads the Vault secret and POSTs the sweep endpoint. SECURITY DEFINER so only
-- the cron job can read the secret; nobody else may execute it.
CREATE OR REPLACE FUNCTION public.cron_trigger_ride_stats_sweep()
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
  WHERE name = 'ride_stats_sweep_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE WARNING 'ride_stats_sweep_secret missing from Vault; skipping ride stats sweep';
    RETURN;
  END IF;

  -- 60 s: up to 10 rides computed one after another (about 2 s each for a long
  -- ride) plus a Render cold start. The timeout only stops pg_net waiting for
  -- the response; the API finishes its batch regardless, and the next tick
  -- picks up whatever is still stale.
  PERFORM net.http_post(
    url := 'https://motowise.onrender.com/webhooks/ride-stats-sweep',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ride-stats-secret', v_secret
    ),
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cron_trigger_ride_stats_sweep() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_trigger_ride_stats_sweep() FROM anon, authenticated, service_role;

-- Every 10 minutes, offset to minute 5 so it does not share a tick with the
-- signup-events job (*/10) or the idle-ride sweep (minute 7).
-- Idempotent: re-running updates the existing schedule rather than duplicating.
SELECT cron.schedule(
  'ride-stats-sweep',
  '5-59/10 * * * *',
  $$ SELECT public.cron_trigger_ride_stats_sweep() $$
);

COMMIT;

-- ============================================================
-- POST-APPLY VERIFICATION (run each; report the output)
-- ============================================================
-- 1. The job exists, is active, and runs the trigger every 10 minutes:
--   SELECT jobname, schedule, command, active
--   FROM cron.job WHERE jobname = 'ride-stats-sweep';
--   -- expect 1 row: '5-59/10 * * * *', active = true
--
-- 2. Only the owner can execute the trigger (no PUBLIC, anon, authenticated or
--    service_role entry in proacl), and it is SECURITY DEFINER with an empty
--    search_path:
--   SELECT p.proname, p.prosecdef, p.proconfig, p.proacl
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'cron_trigger_ride_stats_sweep';
--   -- expect prosecdef = true, proconfig = {search_path=""},
--   -- proacl = {postgres=X/postgres} (owner only)
--
-- 3. The Vault secret exists (never select decrypted_secret here):
--   SELECT name, created_at FROM vault.secrets WHERE name = 'ride_stats_sweep_secret';
--   -- expect 1 row
--
-- 4. After the next tick (minute 5, 15, 25, ...), the run succeeded and the API
--    answered 200:
--   SELECT d.status, d.return_message, d.start_time
--   FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
--   WHERE j.jobname = 'ride-stats-sweep' ORDER BY d.start_time DESC LIMIT 3;
--   -- expect status = 'succeeded'
--   SELECT id, status_code, timed_out, error_msg, created
--   FROM net._http_response
--   WHERE created > now() - interval '15 minutes'
--   ORDER BY created DESC LIMIT 10;
--   -- expect status_code = 200 for the sweep call; 401 = secrets differ,
--   -- 404 = the API with the endpoint is not deployed. (pg_net keeps responses
--   -- for about 6 hours.)
