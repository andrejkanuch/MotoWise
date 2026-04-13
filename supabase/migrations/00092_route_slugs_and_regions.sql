-- Migration: Add slugs, regions, and full-text search to routes table
-- Ticket: MOT-149
-- Purely additive — no drops, no type changes, no constraint changes

-- ==========================================
-- EXTENSION: pg_trgm for fuzzy search
-- ==========================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==========================================
-- NEW COLUMNS
-- ==========================================
ALTER TABLE public.routes ADD COLUMN slug TEXT;
ALTER TABLE public.routes ADD COLUMN country_code TEXT;   -- ISO 3166-1 alpha-2
ALTER TABLE public.routes ADD COLUMN region_code TEXT;    -- ISO 3166-2 subdivision
ALTER TABLE public.routes ADD COLUMN city TEXT;
ALTER TABLE public.routes ADD COLUMN featured_tag TEXT;   -- editorial curation tag

ALTER TABLE public.routes ADD COLUMN search_tsv TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(editorial_description, '') || ' ' || coalesce(city, ''))
  ) STORED;

-- ==========================================
-- INDEXES
-- ==========================================

-- Full-text search via tsvector
CREATE INDEX idx_routes_search_tsv ON public.routes USING GIN (search_tsv);

-- Trigram index on name for fuzzy / ILIKE queries
CREATE INDEX idx_routes_name_trgm ON public.routes USING GIN (name gin_trgm_ops);

-- Regional aggregation queries
CREATE INDEX idx_routes_country_region ON public.routes (country_code, region_code);

-- Editorial curation — only index rows that have a tag
CREATE INDEX idx_routes_featured_tag ON public.routes (featured_tag) WHERE featured_tag IS NOT NULL;
