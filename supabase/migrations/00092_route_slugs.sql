-- Migration: Add slug, country_code, region_slug columns to routes table
-- Part of MOT-153/159 — enables SEO-friendly URLs /route/{country}/{region}/{slug}

-- New columns (all nullable — existing rows will be backfilled later)
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS country_code CHAR(2),
  ADD COLUMN IF NOT EXISTS region_slug TEXT;

-- Unique index: slug is unique within a (country_code, region_slug) tuple
CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_slug_unique
  ON public.routes (country_code, region_slug, slug)
  WHERE slug IS NOT NULL;

-- Fast lookup by slug triplet (used by routeBySlug query)
CREATE INDEX IF NOT EXISTS idx_routes_slug_lookup
  ON public.routes (country_code, region_slug, slug)
  WHERE status = 'published' AND slug IS NOT NULL;
