-- Migration: Add country_code column to routes for per-country twist score bucketing

ALTER TABLE public.routes
  ADD COLUMN country_code TEXT;

-- Index for twist bucket grouping/lookups
CREATE INDEX idx_routes_country_code ON public.routes (country_code) WHERE country_code IS NOT NULL;
