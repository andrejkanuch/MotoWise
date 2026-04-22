-- Migration: 00117_trip_unification_schema
--
-- Phase 1 of trip unification: Adds template columns to trips table,
-- creates unified trip_reviews and trip_saves tables.
-- NON-BREAKING: All new columns are nullable or have defaults.
-- Old tables (routes, discover_trips) remain untouched.
--
-- See: docs/plans/2026-04-22-002-refactor-trip-unification-implementation-plan.md

BEGIN;

-- ==========================================
-- 1. ALTER TABLE trips — template columns
-- ==========================================

-- Widen title from 100 → 150 chars (matches discover_trips)
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_title_check;
ALTER TABLE public.trips ADD CONSTRAINT trips_title_check
  CHECK (char_length(title) BETWEEN 1 AND 150);

-- Template flag
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

-- Template metadata (only populated when is_template = true)
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS polyline TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS distance_m INT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS elevation_gain_m INT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS estimated_duration_minutes INT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS surface_type TEXT
  CHECK (surface_type IS NULL OR surface_type IN ('paved', 'mixed', 'off-road', 'unknown'));
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS curvature_index FLOAT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS day_count INT DEFAULT 1;

-- Template counters (maintained by triggers/RPCs)
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS clone_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS average_rating FLOAT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS review_count INT NOT NULL DEFAULT 0;

-- Template editorial flags
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS is_motovault_pick BOOLEAN NOT NULL DEFAULT false;

-- Geo columns (all trips, not just templates)
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS region_code TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS start_point GEOGRAPHY(POINT, 4326);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS start_lat DOUBLE PRECISION;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS start_lng DOUBLE PRECISION;

-- Template publishing + search
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS search_tsv TSVECTOR;

-- Moderation
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false;

-- Self-referencing FKs for cloning/forking
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS forked_from_trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cloned_from_trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL;

-- Migration tracking (used during data migration, then ignored)
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS migrated_from_discover_trip_id UUID;

-- ==========================================
-- 2. INDEXES — partial indexes for template queries
-- ==========================================

-- Discover feed listing (templates only, ordered by published_at)
CREATE INDEX IF NOT EXISTS idx_trips_template_feed
  ON public.trips (published_at DESC, id DESC)
  WHERE is_template = true AND is_flagged = false;

-- Country + feed listing
CREATE INDEX IF NOT EXISTS idx_trips_template_country_feed
  ON public.trips (country_code, published_at DESC, id DESC)
  WHERE is_template = true AND is_flagged = false;

-- Full-text search (templates only)
CREATE INDEX IF NOT EXISTS idx_trips_template_search
  ON public.trips USING GIN (search_tsv)
  WHERE is_template = true;

-- Slug lookup for SEO/deep links (partial unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_template_slug
  ON public.trips (country_code, region_code, slug)
  WHERE is_template = true AND slug IS NOT NULL;

-- Spatial queries (nearest templates)
CREATE INDEX IF NOT EXISTS idx_trips_template_start_point
  ON public.trips USING GIST (start_point)
  WHERE is_template = true;

-- Migration guard (idempotent migration)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_migrated_discover_trip
  ON public.trips (migrated_from_discover_trip_id)
  WHERE migrated_from_discover_trip_id IS NOT NULL;

-- ==========================================
-- 3. TRIGGER: tsvector maintenance for template trips
-- Only fires when is_template = true and title/description/city change
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_trip_search_tsv()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_template = true THEN
    IF (TG_OP = 'INSERT') OR
       (OLD.title IS DISTINCT FROM NEW.title) OR
       (OLD.description IS DISTINCT FROM NEW.description) OR
       (OLD.city IS DISTINCT FROM NEW.city) OR
       (OLD.is_template IS DISTINCT FROM NEW.is_template) THEN
      NEW.search_tsv :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.city, '')), 'C');
    END IF;
  ELSE
    NEW.search_tsv := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER trg_trips_search_tsv
  BEFORE INSERT OR UPDATE OF title, description, city, is_template ON public.trips
  FOR EACH ROW
  WHEN (NEW.is_template = true)
  EXECUTE FUNCTION public.update_trip_search_tsv();

-- ==========================================
-- 4. TABLE: trip_reviews (unified)
-- Replaces route_reviews + discover_trip_reviews
-- ==========================================

CREATE TABLE public.trip_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        TEXT CHECK (text IS NULL OR char_length(text) BETWEEN 1 AND 500),
  condition_tags JSONB DEFAULT '[]'::jsonb,
  bike_id     UUID REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT trip_reviews_unique UNIQUE (trip_id, user_id)
);

ALTER TABLE public.trip_reviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_trip_reviews_trip
  ON public.trip_reviews (trip_id, created_at DESC);

CREATE INDEX idx_trip_reviews_user
  ON public.trip_reviews (user_id) WHERE user_id IS NOT NULL;

-- ==========================================
-- 5. TRIGGER: maintain average_rating + review_count on trips
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_trip_rating()
RETURNS TRIGGER AS $$
DECLARE
  new_avg FLOAT;
  new_count INT;
  target_trip_id UUID;
BEGIN
  target_trip_id := COALESCE(NEW.trip_id, OLD.trip_id);

  SELECT AVG(rating)::FLOAT, COUNT(*)::INT
    INTO new_avg, new_count
    FROM public.trip_reviews
    WHERE trip_id = target_trip_id;

  UPDATE public.trips
    SET average_rating = new_avg, review_count = COALESCE(new_count, 0)
    WHERE id = target_trip_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER trg_update_trip_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trip_rating();

-- ==========================================
-- 6. TABLE: trip_saves (unified)
-- Replaces route_saves
-- ==========================================

CREATE TABLE public.trip_saves (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id   UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT trip_saves_unique UNIQUE (trip_id, user_id)
);

ALTER TABLE public.trip_saves ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_trip_saves_user
  ON public.trip_saves (user_id, saved_at DESC);

-- ==========================================
-- 7. RLS — Split policies for performance
-- Template reads bypass expensive participant checks
-- ==========================================

-- trip_reviews: visible when parent trip is a published template, or user is author, or admin
CREATE POLICY "trip_reviews_select" ON public.trip_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_reviews.trip_id
        AND t.is_template = true
        AND NOT t.is_flagged
    )
    OR user_id = (SELECT auth.uid())
    OR public.is_admin()
  );

-- trip_reviews: only on template trips (WITH CHECK prevents reviewing non-templates)
CREATE POLICY "trip_reviews_insert" ON public.trip_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_reviews.trip_id
        AND t.is_template = true
        AND NOT t.is_flagged
    )
  );

-- trip_reviews: author can delete own review
CREATE POLICY "trip_reviews_delete" ON public.trip_reviews
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- trip_saves: user owns their saves (full CRUD)
CREATE POLICY "trip_saves_select" ON public.trip_saves
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "trip_saves_insert" ON public.trip_saves
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "trip_saves_delete" ON public.trip_saves
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ==========================================
-- 8. RPC: Atomic view count increment for templates
-- ==========================================

CREATE OR REPLACE FUNCTION public.increment_trip_view(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.trips
  SET view_count = view_count + 1
  WHERE id = p_id AND is_template = true AND NOT is_flagged;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

REVOKE ALL ON FUNCTION public.increment_trip_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_trip_view(UUID) TO service_role;

-- Atomic clone count increment for templates
CREATE OR REPLACE FUNCTION public.increment_trip_clone(p_trip_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.trips
  SET clone_count = clone_count + 1
  WHERE id = p_trip_id AND is_template = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

REVOKE ALL ON FUNCTION public.increment_trip_clone(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_trip_clone(UUID) TO service_role;

-- ==========================================
-- 9. COMMENTS
-- ==========================================
COMMENT ON COLUMN public.trips.is_template IS 'When true, trip appears in Discover feed as a browseable template. Independent of trip status.';
COMMENT ON COLUMN public.trips.slug IS 'URL-safe identifier for template trips. Unique per (country_code, region_code).';
COMMENT ON COLUMN public.trips.is_flagged IS 'Content moderation flag. Flagged templates are hidden from Discover feed.';
COMMENT ON COLUMN public.trips.published_at IS 'When the trip was first published as a template. Used for feed ordering.';
COMMENT ON COLUMN public.trips.migrated_from_discover_trip_id IS 'Migration tracking: maps to the original discover_trips row. Used for idempotent data migration.';
COMMENT ON TABLE public.trip_reviews IS 'Unified review system for trip templates. Replaces route_reviews and discover_trip_reviews.';
COMMENT ON TABLE public.trip_saves IS 'Unified bookmark/save system. Replaces route_saves.';

COMMIT;
