-- Migration: Create routes table with PostGIS for Route Discovery
-- Part of NEXT Tier — Phase A: Route Discovery Page

-- ==========================================
-- EXTENSION: PostGIS for spatial queries
-- ==========================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ==========================================
-- TABLE: routes
-- ==========================================
CREATE TABLE public.routes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_ride_id        UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  name                  TEXT,  -- AI-generated or user-set
  description           TEXT,
  polyline              TEXT NOT NULL,  -- Google encoded polyline for client rendering
  geography             GEOGRAPHY(LINESTRING, 4326),  -- PostGIS for spatial queries
  start_point           GEOGRAPHY(POINT, 4326),  -- Cropped +500m from actual start
  end_point             GEOGRAPHY(POINT, 4326),  -- Cropped -500m from actual end
  distance_m            FLOAT NOT NULL,
  elevation_gain_m      FLOAT,
  surface_type          TEXT CHECK (surface_type IN ('paved', 'mixed', 'off-road', 'unknown')) DEFAULT 'unknown',
  curvature_index       FLOAT,  -- total heading change / distance
  is_motovault_pick     BOOLEAN NOT NULL DEFAULT false,
  editorial_description TEXT,  -- Only for MotoVault Picks
  rating_avg            FLOAT,  -- Denormalized from route_reviews
  rating_count          INT NOT NULL DEFAULT 0,
  comment_count         INT NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES
-- ==========================================

-- Spatial index for "routes near me" queries
CREATE INDEX idx_routes_geography ON public.routes USING GIST (geography);
CREATE INDEX idx_routes_start_point ON public.routes USING GIST (start_point);

-- Filter queries
CREATE INDEX idx_routes_status ON public.routes (status) WHERE status = 'published';
CREATE INDEX idx_routes_contributor ON public.routes (contributor_user_id);
CREATE INDEX idx_routes_rating ON public.routes (rating_avg DESC NULLS LAST) WHERE status = 'published';
CREATE INDEX idx_routes_distance ON public.routes (distance_m) WHERE status = 'published';
CREATE INDEX idx_routes_source_ride ON public.routes (source_ride_id) WHERE source_ride_id IS NOT NULL;

-- ==========================================
-- FK: Link comments.route_id -> routes.id
-- ==========================================
ALTER TABLE public.comments
  ADD CONSTRAINT fk_comments_route
  FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE;

-- ==========================================
-- FUNCTION: update_route_comment_count()
-- Atomically maintains comment_count on routes table
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_route_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.route_id IS NOT NULL THEN
    UPDATE public.routes SET comment_count = comment_count + 1 WHERE id = NEW.route_id;
  ELSIF TG_OP = 'DELETE' AND OLD.route_id IS NOT NULL THEN
    UPDATE public.routes SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.route_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_update_route_comment_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_route_comment_count();

-- ==========================================
-- FUNCTION: update_route_geography(route_uuid, linestring_wkt, start_wkt, end_wkt)
-- Sets PostGIS geography columns from WKT strings
-- Used by the API service since Supabase client can't set geography directly
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_route_geography(
  route_uuid UUID,
  linestring_wkt TEXT,
  start_wkt TEXT,
  end_wkt TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE public.routes SET
    geography = ST_GeogFromText(linestring_wkt),
    start_point = ST_GeogFromText(start_wkt),
    end_point = ST_GeogFromText(end_wkt)
  WHERE id = route_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Anyone can view published routes
CREATE POLICY "routes_select" ON public.routes
  FOR SELECT
  USING (status = 'published');

-- Authenticated users can insert routes they contribute
CREATE POLICY "routes_insert" ON public.routes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = contributor_user_id);

-- Contributors can update their own routes
CREATE POLICY "routes_update" ON public.routes
  FOR UPDATE TO authenticated
  USING (auth.uid() = contributor_user_id);

-- Contributors can delete (hide) their own routes
CREATE POLICY "routes_delete" ON public.routes
  FOR DELETE TO authenticated
  USING (auth.uid() = contributor_user_id);
