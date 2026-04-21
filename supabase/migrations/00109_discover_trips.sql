-- Migration: 00109_discover_trips
--
-- Creates the discover_trips table — the core of the trip template library.
-- Every piece of content on Discover is now a trip template (routes become
-- 1-day trips, planned itineraries become multi-day trips).
--
-- Design decisions (see docs/brainstorms/2026-04-18-discover-trip-templates-brainstorm.md):
--   - Snapshot table (not live view) for structural privacy
--   - Inline view_count/clone_count (tsvector trigger has IS DISTINCT FROM guard)
--   - No pg_jsonschema (Zod parse on every read + simple jsonb_typeof CHECK)
--   - No immutable-columns trigger (RLS + WITH CHECK sufficient at current scale)
--   - Composite slug unique on (country_code, region_code, slug) matching URL structure
--   - Counter RPCs restricted to service_role only (REVOKE from PUBLIC)
--   - search_path = 'public' on SECURITY DEFINER functions (avoids pg_catalog resolution issues)

BEGIN;

-- ==========================================
-- TABLE: discover_trips
-- ==========================================
CREATE TABLE public.discover_trips (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                       TEXT NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  title                      TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
  description                TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 3000),
  difficulty                 TEXT NOT NULL CHECK (difficulty IN ('easy', 'moderate', 'challenging', 'expert')),
  day_count                  INT NOT NULL DEFAULT 1,
  waypoints                  JSONB NOT NULL DEFAULT '[]'
    CHECK (jsonb_typeof(waypoints) = 'array' AND octet_length(waypoints::text) <= 65536),
  polyline                   TEXT,
  start_point                GEOGRAPHY(POINT, 4326),
  -- Generated columns for fast feed queries (avoid JSONB extraction per row)
  start_lat                  DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(start_point::geometry)) STORED,
  start_lng                  DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(start_point::geometry)) STORED,
  contributor_user_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source_trip_id             UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  forked_from_discover_trip_id UUID REFERENCES public.discover_trips(id) ON DELETE SET NULL,
  country_code               TEXT NOT NULL,
  region_code                TEXT,
  city                       TEXT,
  distance_m                 INT,
  elevation_gain_m           INT,
  estimated_duration_minutes INT,
  surface_type               TEXT CHECK (surface_type IS NULL OR surface_type IN ('paved', 'mixed', 'off-road', 'unknown')),
  curvature_index            FLOAT,
  status                     TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'flagged', 'unpublished')),
  is_featured                BOOLEAN NOT NULL DEFAULT false,
  featured_order             INT,
  is_motovault_pick          BOOLEAN NOT NULL DEFAULT false,
  -- Inline counters (tsvector trigger has IS DISTINCT FROM guard — counter updates don't recompute)
  view_count                 BIGINT NOT NULL DEFAULT 0,
  clone_count                BIGINT NOT NULL DEFAULT 0,
  -- Review aggregates (maintained by trigger on discover_trip_reviews)
  average_rating             FLOAT,
  review_count               INT NOT NULL DEFAULT 0,
  -- Migration tracking
  migrated_from_route_id     UUID,
  -- Timestamps
  published_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Full-text search (set by trigger, NOT generated — avoids recompute on non-text updates)
  search_tsv                 TSVECTOR
);

ALTER TABLE public.discover_trips ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- UNIQUE CONSTRAINTS
-- ==========================================

-- Composite slug unique matching URL structure /trips/[country]/[region]/[slug]
CREATE UNIQUE INDEX idx_discover_trips_slug
  ON public.discover_trips (country_code, region_code, slug);

-- One publish per source trip
CREATE UNIQUE INDEX idx_discover_trips_source_trip
  ON public.discover_trips (source_trip_id) WHERE source_trip_id IS NOT NULL;

-- Idempotent migration guard
CREATE UNIQUE INDEX idx_discover_trips_migrated_route
  ON public.discover_trips (migrated_from_route_id) WHERE migrated_from_route_id IS NOT NULL;

-- ==========================================
-- INDEXES
-- ==========================================

-- Primary browse + pagination (covers country filter + published_at cursor)
CREATE INDEX idx_discover_trips_country_published
  ON public.discover_trips (country_code, published_at DESC);

-- Rating sort
CREATE INDEX idx_discover_trips_rating
  ON public.discover_trips (average_rating DESC NULLS LAST) WHERE average_rating IS NOT NULL;

-- "Near me" proximity discovery
CREATE INDEX idx_discover_trips_start_point
  ON public.discover_trips USING GIST (start_point);

-- Full-text search (GIN index created AFTER data migration in 00113 for performance)
-- CREATE INDEX idx_discover_trips_search ON public.discover_trips USING GIN (search_tsv);

-- Contributor lookup
CREATE INDEX idx_discover_trips_contributor
  ON public.discover_trips (contributor_user_id);

-- ==========================================
-- TRIGGER: tsvector maintenance
-- Only recomputes when title/description/city actually change
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_discover_trip_search_tsv()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR
     (OLD.title IS DISTINCT FROM NEW.title) OR
     (OLD.description IS DISTINCT FROM NEW.description) OR
     (OLD.city IS DISTINCT FROM NEW.city) THEN
    NEW.search_tsv :=
      setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(NEW.city, '')), 'C');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER trg_discover_trips_search_tsv
  BEFORE INSERT OR UPDATE ON public.discover_trips
  FOR EACH ROW EXECUTE FUNCTION public.update_discover_trip_search_tsv();

-- ==========================================
-- TRIGGER: updated_at maintenance
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_discover_trips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER trg_discover_trips_updated_at
  BEFORE UPDATE ON public.discover_trips
  FOR EACH ROW EXECUTE FUNCTION public.update_discover_trips_updated_at();

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Anyone can view published trips; contributors see their own (any status); admins see all
CREATE POLICY "discover_trips_select" ON public.discover_trips
  FOR SELECT USING (
    status = 'published'
    OR contributor_user_id = (SELECT auth.uid())
    OR public.is_admin()
  );

-- Authenticated users can insert their own (with source_trip ownership check)
CREATE POLICY "discover_trips_insert" ON public.discover_trips
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = contributor_user_id
    AND (
      source_trip_id IS NULL
      OR source_trip_id IN (
        SELECT id FROM public.trips WHERE organiser_user_id = (SELECT auth.uid())
      )
    )
  );

-- Contributors can update their own (WITH CHECK for defense-in-depth)
CREATE POLICY "discover_trips_update" ON public.discover_trips
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = contributor_user_id)
  WITH CHECK ((SELECT auth.uid()) = contributor_user_id);

-- Contributors can delete their own
CREATE POLICY "discover_trips_delete" ON public.discover_trips
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = contributor_user_id);

-- ==========================================
-- RPCs: Atomic counter increments
-- SECURITY DEFINER bypasses RLS — must REVOKE from PUBLIC
-- ==========================================

CREATE OR REPLACE FUNCTION public.increment_discover_trip_view(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.discover_trips
  SET view_count = view_count + 1
  WHERE id = p_id AND status = 'published';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Only callable by service_role (NestJS API via SUPABASE_ADMIN)
REVOKE ALL ON FUNCTION public.increment_discover_trip_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_discover_trip_view(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.increment_discover_trip_clone(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.discover_trips
  SET clone_count = clone_count + 1
  WHERE id = p_id AND status = 'published';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

REVOKE ALL ON FUNCTION public.increment_discover_trip_clone(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_discover_trip_clone(UUID) TO service_role;

COMMIT;
