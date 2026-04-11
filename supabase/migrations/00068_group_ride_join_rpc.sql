-- Migration: Atomic group ride join with row-level locking
-- Prevents race condition where two users can exceed max_riders

CREATE OR REPLACE FUNCTION public.join_group_ride(p_group_ride_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM 1 FROM public.group_rides
    WHERE id = p_group_ride_id
      AND status = 'published'
      AND participant_count < max_riders
      AND date_time > now()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot join: ride is full, not published, or already started';
  END IF;

  INSERT INTO public.group_ride_participants (group_ride_id, user_id)
    VALUES (p_group_ride_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
