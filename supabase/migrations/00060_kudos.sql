-- Migration: Create ride_kudos table + kudos counter trigger
-- Part of Community Layer — Phase 4: Social Feed

-- ==========================================
-- TABLE: ride_kudos
-- ==========================================
CREATE TABLE public.ride_kudos (
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ride_id    UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, ride_id)
);

ALTER TABLE public.ride_kudos ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES
-- ==========================================

-- Feed query: check if current user has kudos'd each ride (ride_id first for feed joins)
CREATE INDEX idx_ride_kudos_ride_user
  ON public.ride_kudos (ride_id, user_id);

-- ==========================================
-- FUNCTION: update_kudos_count()
-- Atomically maintains kudos_count on rides table
-- SECURITY DEFINER with pinned search_path (migration 00007 pattern)
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_kudos_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.rides SET kudos_count = kudos_count + 1 WHERE id = NEW.ride_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.rides SET kudos_count = GREATEST(kudos_count - 1, 0) WHERE id = OLD.ride_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- TRIGGER: fire on kudos/unkudos
-- ==========================================
CREATE TRIGGER trg_update_kudos_count
  AFTER INSERT OR DELETE ON public.ride_kudos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_kudos_count();

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- User can kudos public, non-deleted rides
CREATE POLICY "kudos_insert" ON public.ride_kudos
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.rides
      WHERE id = ride_id AND is_public = true AND deleted_at IS NULL
    )
  );

-- Any authenticated user can see kudos (needed for feed "has_kudos" check)
CREATE POLICY "kudos_select" ON public.ride_kudos
  FOR SELECT TO authenticated
  USING (true);

-- User can remove their own kudos
CREATE POLICY "kudos_delete" ON public.ride_kudos
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- Explicit deny UPDATE
CREATE POLICY "kudos_no_update" ON public.ride_kudos
  FOR UPDATE TO authenticated
  USING (false);
