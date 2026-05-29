-- Migration: Allow waypoint inserts for completed rides
--
-- BUG (Sentry MOTO-VAULT-REACT-NATIVE-H, 628 events / 20 users):
-- "Failed to upload waypoints" (INTERNAL_SERVER_ERROR).
--
-- ROOT CAUSE: status mismatch between the service and RLS.
--   - rides.service.uploadWaypoints() verifies ride ownership for
--     status IN ('recording','paused','completed') and intends to accept
--     late-arriving waypoints.
--   - The RLS INSERT policy on ride_waypoints (00047) only permitted
--     WITH CHECK for status IN ('recording','paused').
--
-- The mobile offline sync queue (ride-sync-queue.ts) buffers waypoint
-- batches that fail to upload (spotty cellular / app backgrounded) and
-- retries them later. By the time the queue drains, endRide() has already
-- set status='completed', so the queued waypoints are permanently rejected
-- by RLS (PG error 42501 -> InternalServerErrorException), retried up to 5x
-- (each emitting a Sentry event), then dead-lettered and lost.
--
-- FIX: allow INSERT for the ride owner when the ride is recording, paused,
-- OR completed (still scoped to the owner and non-deleted rides). This
-- matches the service's ownership check exactly. Inserting waypoints into a
-- user's own completed ride is safe — it is their own data, bounded by the
-- MAX_WAYPOINTS_PER_RIDE quota enforced in the service.

DROP POLICY IF EXISTS "Enable insert for ride owner" ON public.ride_waypoints;

CREATE POLICY "Enable insert for ride owner"
  ON public.ride_waypoints
  FOR INSERT TO authenticated
  WITH CHECK (
    ride_id IN (
      SELECT id FROM public.rides
      WHERE user_id = auth.uid()
      AND status IN ('recording', 'paused', 'completed')
      AND deleted_at IS NULL
    )
  );
