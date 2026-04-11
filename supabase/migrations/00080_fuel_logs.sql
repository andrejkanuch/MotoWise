-- Migration: 00080_fuel_logs
-- MOT-137: Fuel Fill-up Logging & MPG Tracking
--
-- All quantities stored normalised to metric units (km + litres) regardless
-- of the user's display preference. Conversion to MPG / mi happens at the
-- display layer, consistent with how distances are handled elsewhere in
-- the app.

CREATE TABLE public.fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  odometer_km NUMERIC(10, 2) NOT NULL CHECK (odometer_km >= 0),
  fuel_litres NUMERIC(8, 3) NOT NULL CHECK (fuel_litres > 0),
  total_cost NUMERIC(10, 2) CHECK (total_cost IS NULL OR total_cost >= 0),
  currency TEXT DEFAULT 'USD',
  fuel_type TEXT DEFAULT 'regular' CHECK (fuel_type IN ('regular', 'premium', 'diesel', 'e85')),
  is_partial BOOLEAN DEFAULT FALSE NOT NULL,
  notes TEXT,
  filled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_fuel_logs_bike_filled
  ON public.fuel_logs (motorcycle_id, filled_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_fuel_logs_user
  ON public.fuel_logs (user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON public.fuel_logs
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "owner_insert" ON public.fuel_logs
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "owner_update" ON public.fuel_logs
  FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "owner_delete" ON public.fuel_logs
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.fuel_logs IS 'MOT-137: fill-up entries per motorcycle. Used to compute MPG / L per 100km trends. Auto-creates a fuel-category expense on insert at the application layer.';
