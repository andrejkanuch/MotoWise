-- Migration: 00115_fix_updated_at_skip_counters
--
-- The updated_at trigger fires on every UPDATE, including view_count/clone_count
-- increments. This makes updated_at meaningless as a "content last modified" signal.
-- Fix: skip updated_at bump when only counters changed.

CREATE OR REPLACE FUNCTION public.update_discover_trips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip updated_at bump when only counters changed (view_count, clone_count, review aggregates)
  IF (OLD.view_count IS DISTINCT FROM NEW.view_count
      OR OLD.clone_count IS DISTINCT FROM NEW.clone_count
      OR OLD.average_rating IS DISTINCT FROM NEW.average_rating
      OR OLD.review_count IS DISTINCT FROM NEW.review_count)
    AND OLD.title IS NOT DISTINCT FROM NEW.title
    AND OLD.description IS NOT DISTINCT FROM NEW.description
    AND OLD.waypoints IS NOT DISTINCT FROM NEW.waypoints
    AND OLD.difficulty IS NOT DISTINCT FROM NEW.difficulty
    AND OLD.status IS NOT DISTINCT FROM NEW.status
  THEN
    RETURN NEW;  -- skip updated_at bump
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';
