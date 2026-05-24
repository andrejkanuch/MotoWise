-- =====================================================
-- Migration: ride_records table for personal bests
-- Ticket: MOT-235
-- =====================================================

-- Full enum includes north-star types for forward compatibility.
-- Phase 0.5 only uses: longest_distance, longest_duration,
-- top_speed, most_elevation_gain, longest_streak.
CREATE TYPE public.ride_record_type AS ENUM (
  'longest_distance',
  'longest_duration',
  'top_speed',
  'max_lean',
  'max_elevation_gain',
  'most_distance_week',
  'most_distance_month',
  'most_rides_week',
  'most_rides_month',
  'longest_streak'
);

CREATE TABLE public.ride_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id   UUID NOT NULL DEFAULT public.all_bikes_sentinel(),
  record_type     public.ride_record_type NOT NULL,
  value           REAL NOT NULL,
  unit            TEXT NOT NULL,
  ride_id         UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  achieved_at     TIMESTAMPTZ NOT NULL,
  previous_value  REAL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique per (user, bike, record_type). Sentinel UUID = all-bikes record.
-- Plain index — no COALESCE tricks.
CREATE UNIQUE INDEX ride_records_unique_per_user_bike_type
  ON public.ride_records (user_id, motorcycle_id, record_type);

CREATE INDEX ride_records_user_achieved_idx
  ON public.ride_records (user_id, achieved_at DESC);

ALTER TABLE public.ride_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ride_records_owner_read" ON public.ride_records
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
