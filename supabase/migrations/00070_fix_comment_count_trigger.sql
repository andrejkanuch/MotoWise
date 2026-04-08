-- Fix comment count triggers to only count top-level comments (not replies)
-- This aligns with the service which returns totalCount of top-level comments only.

CREATE OR REPLACE FUNCTION public.update_ride_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.ride_id IS NOT NULL AND NEW.parent_comment_id IS NULL THEN
    UPDATE public.rides SET comment_count = comment_count + 1 WHERE id = NEW.ride_id;
  ELSIF TG_OP = 'DELETE' AND OLD.ride_id IS NOT NULL AND OLD.parent_comment_id IS NULL THEN
    UPDATE public.rides SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.ride_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.update_route_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.route_id IS NOT NULL AND NEW.parent_comment_id IS NULL THEN
    UPDATE public.routes SET comment_count = comment_count + 1 WHERE id = NEW.route_id;
  ELSIF TG_OP = 'DELETE' AND OLD.route_id IS NOT NULL AND OLD.parent_comment_id IS NULL THEN
    UPDATE public.routes SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.route_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Add missing indexes for route and group_ride comment queries
CREATE INDEX IF NOT EXISTS idx_comments_route ON public.comments (route_id, created_at)
  WHERE route_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_group_ride ON public.comments (group_ride_id, created_at)
  WHERE group_ride_id IS NOT NULL;

-- Drop and recreate the comments_insert policy to validate all target types
DROP POLICY IF EXISTS "comments_insert" ON public.comments;

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
    AND (
      route_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.routes
        WHERE id = route_id AND status = 'published'
      )
    )
    AND (
      group_ride_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.group_rides
        WHERE id = group_ride_id AND status IN ('published', 'full')
      )
    )
  );
