-- MOT-278 (U9): schedule the daily maintenance-due push run. pg_cron fires a
-- SECURITY DEFINER function that reads the shared secret from Vault (never stored
-- in this migration) and POSTs the HMAC-guarded API endpoint via pg_net. The
-- endpoint does the actual work (find tasks due tomorrow → push to owners).
--
-- The Vault secret `maintenance_push_secret` and the API's MAINTENANCE_PUSH_SECRET
-- must hold the same value, or the endpoint rejects the call (401, no push sent).

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Reads the Vault secret and POSTs the trigger endpoint. SECURITY DEFINER so the
-- cron job (and only it) can read the secret; locked down from direct callers.
CREATE OR REPLACE FUNCTION public.cron_trigger_maintenance_due_push()
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
  WHERE name = 'maintenance_push_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE WARNING 'maintenance_push_secret missing from Vault; skipping push trigger';
    RETURN;
  END IF;

  -- 30s timeout: the endpoint does several DB round-trips + an Expo API call and
  -- can cold-start on Render; pg_net's 1s default would expire mid-run.
  PERFORM net.http_post(
    url := 'https://motowise.onrender.com/webhooks/maintenance-due-push',
    body := jsonb_build_object('daysBefore', 1),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-maintenance-push-secret', v_secret
    ),
    timeout_milliseconds := 30000
  );
END;
$$;

-- Not user-callable: only the cron job (running as postgres, which owns this
-- SECURITY DEFINER function) may trigger a run. Revoke from every app role —
-- including service_role — so neither the anon/user clients nor the API's
-- service-role client can invoke it directly (the HTTP endpoint is the entrypoint).
REVOKE ALL ON FUNCTION public.cron_trigger_maintenance_due_push() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_trigger_maintenance_due_push() FROM anon, authenticated, service_role;

-- Daily at 17:00 UTC (≈ noon ET / 09:00 PT / 18:00 CET). Idempotent: re-running
-- this migration updates the existing schedule rather than duplicating it.
SELECT cron.schedule(
  'maintenance-due-push',
  '0 17 * * *',
  $$ SELECT public.cron_trigger_maintenance_due_push() $$
);
