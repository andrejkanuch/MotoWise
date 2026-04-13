-- Migration: RPC helpers for route slug + geo backfill script
-- Used by apps/api/scripts/backfill-route-slugs.ts

-- ==========================================
-- RPC: get_routes_needing_slug(batch_size, batch_offset)
-- Returns routes missing slug with lat/lng extracted from start_point
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_routes_needing_slug(
  batch_size INT DEFAULT 100,
  batch_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      r.id,
      r.name,
      ST_Y(r.start_point::geometry) AS lat,
      ST_X(r.start_point::geometry) AS lng
    FROM public.routes r
    WHERE r.slug IS NULL
    ORDER BY r.created_at
    LIMIT batch_size
    OFFSET batch_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- EXTENSIONS: cube + earthdistance for KNN lookups on places
-- ==========================================
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- ==========================================
-- RPC: find_nearest_place(lat, lng, kind)
-- Uses earthdistance ll_to_earth for fast nearest-neighbor
-- ==========================================
CREATE OR REPLACE FUNCTION public.find_nearest_place(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_kind TEXT DEFAULT 'city'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  country_code TEXT,
  region_code TEXT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id,
      p.name,
      p.country_code,
      p.region_code
    FROM public.places p
    WHERE p.kind = p_kind
    ORDER BY ll_to_earth(p.latitude, p.longitude) <-> ll_to_earth(p_lat, p_lng)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
