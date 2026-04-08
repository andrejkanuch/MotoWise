-- Migration: Create comments table + comment counter trigger
-- Part of NEXT Tier — Phase A: Comments on Ride Cards

-- ==========================================
-- TABLE: comments
-- Polymorphic via nullable FKs (ride_id, route_id, group_ride_id)
-- One level of threading via parent_comment_id
-- ==========================================
CREATE TABLE public.comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ride_id           UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  route_id          UUID,  -- FK added when routes table is created
  group_ride_id     UUID,  -- FK added when group_rides table is created
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  text              TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  flagged_count     INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exactly one target must be set
  CONSTRAINT comments_single_target CHECK (
    (ride_id IS NOT NULL)::int +
    (route_id IS NOT NULL)::int +
    (group_ride_id IS NOT NULL)::int = 1
  )
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES
-- ==========================================

-- Query comments for a ride, ordered by time
CREATE INDEX idx_comments_ride ON public.comments (ride_id, created_at)
  WHERE ride_id IS NOT NULL;

-- Query replies for a parent comment
CREATE INDEX idx_comments_parent ON public.comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

-- Query comments by user (for profile/moderation)
CREATE INDEX idx_comments_user ON public.comments (user_id);

-- ==========================================
-- COLUMN: rides.comment_count
-- ==========================================
ALTER TABLE public.rides ADD COLUMN comment_count INT NOT NULL DEFAULT 0;

-- ==========================================
-- FUNCTION: update_ride_comment_count()
-- Atomically maintains comment_count on rides table
-- SECURITY DEFINER with pinned search_path (follows 00060 pattern)
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_ride_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.ride_id IS NOT NULL THEN
    UPDATE public.rides SET comment_count = comment_count + 1 WHERE id = NEW.ride_id;
  ELSIF TG_OP = 'DELETE' AND OLD.ride_id IS NOT NULL THEN
    UPDATE public.rides SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.ride_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- TRIGGER: fire on comment insert/delete
-- ==========================================
CREATE TRIGGER trg_update_ride_comment_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ride_comment_count();

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Anyone can read comments (public rides have public comments)
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT
  USING (true);

-- Authenticated users can insert their own comments on public, non-deleted rides
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND (
      ride_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.rides
        WHERE id = ride_id AND is_public = true AND deleted_at IS NULL
      )
    )
  );

-- Users can delete their own comments
CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- No direct UPDATE via RLS — flagging uses a SECURITY DEFINER function below
CREATE POLICY "comments_no_update" ON public.comments
  FOR UPDATE TO authenticated
  USING (false);

-- ==========================================
-- FUNCTION: flag_comment(comment_uuid)
-- Atomically increments flagged_count by 1
-- SECURITY DEFINER bypasses the UPDATE deny policy
-- ==========================================
CREATE OR REPLACE FUNCTION public.flag_comment(comment_uuid UUID)
RETURNS INT AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE public.comments
    SET flagged_count = flagged_count + 1
    WHERE id = comment_uuid
    RETURNING flagged_count INTO new_count;

  IF new_count IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
