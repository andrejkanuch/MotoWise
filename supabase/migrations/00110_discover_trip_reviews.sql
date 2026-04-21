-- Migration: 00110_discover_trip_reviews
--
-- Review system for discover trip templates.
-- Mirrors route_reviews schema (00065) with key differences:
--   - user_id ON DELETE SET NULL (not CASCADE) — preserves rating data when reviewer deletes account
--   - RLS SELECT gated on parent trip's published status
--   - Trigger maintains denormalized average_rating + review_count on discover_trips

BEGIN;

-- ==========================================
-- TABLE: discover_trip_reviews
-- ==========================================
CREATE TABLE public.discover_trip_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discover_trip_id  UUID NOT NULL REFERENCES public.discover_trips(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rating            INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text              TEXT CHECK (text IS NULL OR char_length(text) BETWEEN 1 AND 500),
  condition_tags    JSONB DEFAULT '[]'::jsonb,
  bike_id           UUID REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One review per user per trip
  CONSTRAINT discover_trip_reviews_unique UNIQUE (discover_trip_id, user_id)
);

ALTER TABLE public.discover_trip_reviews ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_discover_trip_reviews_trip
  ON public.discover_trip_reviews (discover_trip_id, created_at DESC);

CREATE INDEX idx_discover_trip_reviews_user
  ON public.discover_trip_reviews (user_id) WHERE user_id IS NOT NULL;

-- ==========================================
-- TRIGGER: maintain average_rating + review_count on discover_trips
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_discover_trip_rating()
RETURNS TRIGGER AS $$
DECLARE
  new_avg FLOAT;
  new_count INT;
  target_trip_id UUID;
BEGIN
  target_trip_id := COALESCE(NEW.discover_trip_id, OLD.discover_trip_id);

  SELECT AVG(rating)::FLOAT, COUNT(*)::INT
    INTO new_avg, new_count
    FROM public.discover_trip_reviews
    WHERE discover_trip_id = target_trip_id;

  UPDATE public.discover_trips
    SET average_rating = new_avg, review_count = COALESCE(new_count, 0)
    WHERE id = target_trip_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER trg_update_discover_trip_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.discover_trip_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_discover_trip_rating();

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Reviews visible when parent trip is published, or user is review author, or admin
CREATE POLICY "discover_trip_reviews_select" ON public.discover_trip_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.discover_trips dt
      WHERE dt.id = discover_trip_reviews.discover_trip_id
        AND dt.status = 'published'
    )
    OR user_id = (SELECT auth.uid())
    OR public.is_admin()
  );

-- Authenticated users can create reviews (user_id must match caller)
CREATE POLICY "discover_trip_reviews_insert" ON public.discover_trip_reviews
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- No update allowed (create new review if needed)
-- Delete: only the review author
CREATE POLICY "discover_trip_reviews_delete" ON public.discover_trip_reviews
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

COMMIT;
