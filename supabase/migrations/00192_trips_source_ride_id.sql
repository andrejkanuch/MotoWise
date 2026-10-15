-- 00192: trips.source_ride_id, which "share ride to Discover" has always needed.
--
-- TripLifecycleService.shareRideAsTrip filters and inserts trips.source_ride_id,
-- but the column only ever existed on public.routes (00064). Every share failed
-- its duplicate check with 42703 "column trips.source_ride_id does not exist"
-- and returned a 500 (Sentry MOTO-VAULT-NODE-NESTJS-Q). The Supabase client in
-- that service is untyped, so typecheck never saw it.
--
-- ON DELETE SET NULL matches routes.source_ride_id: deleting the ride keeps the
-- shared trip. The partial unique index makes "one Discover template per ride"
-- hold under concurrent requests; the service's SELECT check alone is racy.
-- Additive only: no RLS, grant or existing-row change (trips has no column grants).

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS source_ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_one_template_per_source_ride
  ON public.trips (source_ride_id)
  WHERE is_template AND source_ride_id IS NOT NULL;
