-- Add updated_at auto-update triggers for routes and group_rides tables.
-- Uses the existing update_updated_at() function from migration 00003.

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.group_rides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add comment_count to group_rides for cached count display
ALTER TABLE public.group_rides ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0;

-- Trigger to maintain comment_count on group_rides
CREATE OR REPLACE FUNCTION public.update_group_ride_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.group_ride_id IS NOT NULL AND NEW.parent_comment_id IS NULL THEN
    UPDATE public.group_rides SET comment_count = comment_count + 1 WHERE id = NEW.group_ride_id;
  ELSIF TG_OP = 'DELETE' AND OLD.group_ride_id IS NOT NULL AND OLD.parent_comment_id IS NULL THEN
    UPDATE public.group_rides SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.group_ride_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_update_group_ride_comment_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_ride_comment_count();
