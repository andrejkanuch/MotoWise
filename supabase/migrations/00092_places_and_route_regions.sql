-- Migration: Create places table + add region/slug columns to routes
-- Part of MOT-161 — Region and country index pages for route discovery

-- ==========================================
-- TABLE: places (country / region / city hierarchy)
-- ==========================================
CREATE TABLE public.places (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT NOT NULL CHECK (kind IN ('country', 'region', 'city')),
  name          TEXT NOT NULL,
  country_code  TEXT NOT NULL,          -- ISO 3166-1 alpha-2
  region_code   TEXT,                   -- ISO 3166-2 subdivision or free-text
  slug          TEXT NOT NULL,          -- kebab-case, ASCII-folded
  parent_id     UUID REFERENCES public.places(id),
  route_count   INT NOT NULL DEFAULT 0, -- denormalized for fast listing
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, country_code, COALESCE(region_code, ''), slug)
);

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

-- Places are fully public (read-only for discovery)
CREATE POLICY "places_select" ON public.places
  FOR SELECT
  USING (true);

-- Only service-role can insert/update places
CREATE POLICY "places_insert_admin" ON public.places
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "places_update_admin" ON public.places
  FOR UPDATE TO service_role
  USING (true);

-- ==========================================
-- INDEXES: places
-- ==========================================
CREATE INDEX idx_places_country ON public.places (country_code);
CREATE INDEX idx_places_parent ON public.places (parent_id);
CREATE INDEX idx_places_kind_country ON public.places (kind, country_code);
CREATE INDEX idx_places_slug ON public.places (slug);
CREATE INDEX idx_places_search ON public.places USING gin(to_tsvector('simple', name));

-- ==========================================
-- COLUMNS: routes — add region/slug fields
-- ==========================================
ALTER TABLE public.routes ADD COLUMN country_code TEXT;
ALTER TABLE public.routes ADD COLUMN region_code TEXT;
ALTER TABLE public.routes ADD COLUMN region_slug TEXT;
ALTER TABLE public.routes ADD COLUMN slug TEXT;
ALTER TABLE public.routes ADD COLUMN display_name TEXT;

-- Unique slug within country+region
CREATE UNIQUE INDEX idx_routes_slug_unique
  ON public.routes (country_code, region_slug, slug)
  WHERE slug IS NOT NULL;

-- Filter by country/region for index pages
CREATE INDEX idx_routes_country ON public.routes (country_code) WHERE status = 'published';
CREATE INDEX idx_routes_region ON public.routes (country_code, region_code) WHERE status = 'published';
