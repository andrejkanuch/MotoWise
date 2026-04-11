-- Migration: 00078_odometer_sync_source
-- MOT-140: Ride-to-Odometer Automatic Sync tracking fields.
--
-- Reuses the existing rides.mileage_applied flag (added in 00047) as the
-- idempotency guard — it is semantically identical to the spec's
-- odometer_synced. Reuses motorcycles.mileage_updated_at as the
-- odometer_last_synced_at timestamp.
--
-- This migration only adds what is genuinely new:
-- * odometer_sync_source — 'manual' (default) or 'gps_ride'
-- * odometer_last_ride_id — the ride that produced the most recent GPS sync
--
-- This also fixes a pre-existing unit bug: endRide adds ride distance (in
-- meters) directly to motorcycles.current_mileage (in km or miles). The
-- service layer fix is in rides.service.ts — the DB change is only metadata.

ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS odometer_sync_source TEXT
    NOT NULL DEFAULT 'manual'
    CHECK (odometer_sync_source IN ('manual', 'gps_ride'));

ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS odometer_last_ride_id UUID
    REFERENCES public.rides(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.motorcycles.odometer_sync_source IS 'How the current_mileage value was last updated. "manual" = user entry, "gps_ride" = auto-synced from a completed ride. MOT-140.';
COMMENT ON COLUMN public.motorcycles.odometer_last_ride_id IS 'The ride that most recently auto-synced into current_mileage. Used by the UI to show provenance. MOT-140.';
