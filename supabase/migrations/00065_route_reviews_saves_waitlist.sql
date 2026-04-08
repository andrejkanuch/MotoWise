-- Migration: Route reviews, route saves, premium waitlist
-- Part of NEXT Tier — Phase B: Route Intelligence

-- ==========================================
-- TABLE: route_reviews
-- ==========================================
CREATE TABLE public.route_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id        UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text            TEXT CHECK (text IS NULL OR char_length(text) BETWEEN 1 AND 500),
  condition_tags  JSONB DEFAULT '[]'::jsonb,  -- Array of: Good Surface, Gravel Hazard, Construction, Low Traffic, Heavy Traffic, Scenic, Technical Curves
  bike_id         UUID REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One review per user per route
  CONSTRAINT route_reviews_unique UNIQUE (route_id, user_id)
);

ALTER TABLE public.route_reviews ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_route_reviews_route ON public.route_reviews (route_id, created_at DESC);
CREATE INDEX idx_route_reviews_user ON public.route_reviews (user_id);

-- ==========================================
-- FUNCTION: update_route_rating()
-- Recalculates rating_avg and rating_count on routes table
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_route_rating()
RETURNS TRIGGER AS $$
DECLARE
  new_avg FLOAT;
  new_count INT;
  target_route_id UUID;
BEGIN
  target_route_id := COALESCE(NEW.route_id, OLD.route_id);

  SELECT AVG(rating)::FLOAT, COUNT(*)::INT
    INTO new_avg, new_count
    FROM public.route_reviews
    WHERE route_id = target_route_id;

  UPDATE public.routes
    SET rating_avg = new_avg, rating_count = COALESCE(new_count, 0)
    WHERE id = target_route_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_update_route_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.route_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_route_rating();

-- RLS
CREATE POLICY "route_reviews_select" ON public.route_reviews
  FOR SELECT USING (true);

CREATE POLICY "route_reviews_insert" ON public.route_reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "route_reviews_update" ON public.route_reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "route_reviews_delete" ON public.route_reviews
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ==========================================
-- TABLE: route_saves
-- ==========================================
CREATE TABLE public.route_saves (
  route_id  UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (route_id, user_id)
);

ALTER TABLE public.route_saves ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_route_saves_user ON public.route_saves (user_id, saved_at DESC);

-- RLS: only owner can read/write their saves
CREATE POLICY "route_saves_select" ON public.route_saves
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "route_saves_insert" ON public.route_saves
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "route_saves_delete" ON public.route_saves
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "route_saves_no_update" ON public.route_saves
  FOR UPDATE TO authenticated
  USING (false);

-- ==========================================
-- TABLE: premium_waitlist
-- ==========================================
CREATE TABLE public.premium_waitlist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feature      TEXT NOT NULL CHECK (feature IN ('offline_routes', 'premium_general')),
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One sign-up per user per feature
  CONSTRAINT premium_waitlist_unique UNIQUE (user_id, feature)
);

ALTER TABLE public.premium_waitlist ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated can insert; only service role can read (for admin export)
CREATE POLICY "waitlist_insert" ON public.premium_waitlist
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "waitlist_select_own" ON public.premium_waitlist
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
