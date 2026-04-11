-- Migration: Fix trip participant counting, add atomic join RPC, fix RLS
-- Addresses P1 review findings

-- ==========================================
-- FIX 1: Replace participant_count trigger
-- Only count participants with status = 'going'
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_trip_participant_count()
RETURNS TRIGGER AS $$
DECLARE
  new_count INT;
BEGIN
  -- Recount 'going' participants for the affected trip
  IF TG_OP = 'DELETE' THEN
    SELECT COUNT(*) INTO new_count
    FROM public.trip_participants
    WHERE trip_id = OLD.trip_id AND status = 'going';

    UPDATE public.trips
    SET participant_count = new_count
    WHERE id = OLD.trip_id;
  ELSE
    SELECT COUNT(*) INTO new_count
    FROM public.trip_participants
    WHERE trip_id = NEW.trip_id AND status = 'going';

    UPDATE public.trips
    SET participant_count = new_count
    WHERE id = NEW.trip_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Also fire on UPDATE (status changes affect the count)
DROP TRIGGER IF EXISTS trg_update_trip_participant_count ON public.trip_participants;

CREATE TRIGGER trg_update_trip_participant_count
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trip_participant_count();

-- ==========================================
-- FIX 2: Atomic join_trip RPC with FOR UPDATE
-- Prevents race condition on max_riders
-- Matches join_group_ride pattern from 00068
-- ==========================================

CREATE OR REPLACE FUNCTION public.join_trip(
  p_trip_id UUID,
  p_user_id UUID,
  p_status TEXT DEFAULT 'going',
  p_bike_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Validate status
  IF p_status NOT IN ('going', 'maybe', 'declined') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  -- Lock the trip row and check it is joinable
  PERFORM 1 FROM public.trips
    WHERE id = p_trip_id
      AND status IN ('published', 'active')
      AND organiser_user_id != p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot join: trip not found, not published/active, or you are the organiser';
  END IF;

  -- Check capacity only for 'going' status
  IF p_status = 'going' THEN
    PERFORM 1 FROM public.trips
      WHERE id = p_trip_id
        AND participant_count >= max_riders;

    IF FOUND THEN
      RAISE EXCEPTION 'Cannot join: trip is full';
    END IF;
  END IF;

  -- Upsert participant (insert or update status)
  INSERT INTO public.trip_participants (trip_id, user_id, role, status, bike_id)
    VALUES (p_trip_id, p_user_id, 'rider', p_status, p_bike_id)
    ON CONFLICT (trip_id, user_id)
    DO UPDATE SET status = EXCLUDED.status, bike_id = EXCLUDED.bike_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- FIX 3: Update RLS to allow joining 'active' trips
-- ==========================================

DROP POLICY IF EXISTS "trip_participants_insert" ON public.trip_participants;

CREATE POLICY "trip_participants_insert" ON public.trip_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND status IN ('published', 'active')
    )
  );

-- ==========================================
-- FIX 4: Add updated_at trigger (missed in 00072)
-- ==========================================

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ==========================================
-- FIX 5: Reorder waypoints RPC (atomic, single transaction)
-- ==========================================

CREATE OR REPLACE FUNCTION public.reorder_trip_waypoints(
  p_trip_id UUID,
  p_waypoint_ids UUID[]
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.trip_waypoints
  SET sort_order = t.idx - 1
  FROM unnest(p_waypoint_ids) WITH ORDINALITY AS t(wid, idx)
  WHERE trip_waypoints.id = t.wid
    AND trip_waypoints.trip_id = p_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
