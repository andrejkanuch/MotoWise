-- Migration: GDPR purge for soft-deleted rides (H15 fix)
-- Hard-deletes waypoints and anonymizes location PII after 30 days

-- ==========================================
-- FUNCTION: purge_soft_deleted_rides
-- ==========================================
CREATE FUNCTION public.purge_soft_deleted_rides()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Hard-delete waypoints for rides deleted >30 days ago
  DELETE FROM public.ride_waypoints
  WHERE ride_id IN (
    SELECT id FROM public.rides
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days'
  );

  -- Anonymize rides: null location PII
  UPDATE public.rides
  SET
    route_polyline = NULL,
    region = NULL,
    weather_snapshot = NULL
  WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '30 days';
END $$;

-- ==========================================
-- CRON: Schedule nightly purge at 04:00 UTC
-- ==========================================
SELECT cron.schedule(
  'purge-soft-deleted-rides',
  '0 4 * * *',
  $$SELECT public.purge_soft_deleted_rides()$$
);
