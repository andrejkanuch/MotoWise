-- Migration: 00111_trips_clone_support
--
-- Adds clone support to the trips table:
--   - dates_pending flag for cloned trips with sentinel dates
--   - cloned_from_discover_trip_id for attribution tracking
--   - Updated CHECK constraint allowing sentinel dates when dates_pending=true
--   - Atomic clone_discover_trip RPC (single transaction: trip + participant + waypoints + counter)
--
-- The sentinel date approach (1970-01-01) avoids making start_date/end_date nullable,
-- which would break pagination cursors, Zod schemas, and the GraphQL model.

BEGIN;

-- ==========================================
-- ADD COLUMNS to trips
-- ==========================================
ALTER TABLE public.trips
  ADD COLUMN dates_pending BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.trips
  ADD COLUMN cloned_from_discover_trip_id UUID REFERENCES public.discover_trips(id) ON DELETE SET NULL;

-- ==========================================
-- UPDATE CHECK CONSTRAINT (single ALTER to avoid gap)
-- ==========================================
ALTER TABLE public.trips
  DROP CONSTRAINT chk_trips_date_range,
  ADD CONSTRAINT chk_trips_date_range CHECK (
    (dates_pending = true AND start_date = '1970-01-01' AND end_date = '1970-01-01')
    OR (dates_pending = false AND end_date >= start_date)
  );

-- Index for "cloned from" lookups (e.g., "You already cloned this" check)
CREATE INDEX idx_trips_cloned_from
  ON public.trips (cloned_from_discover_trip_id)
  WHERE cloned_from_discover_trip_id IS NOT NULL;

-- ==========================================
-- RPC: clone_discover_trip (atomic — single transaction)
--
-- Creates trip + organiser participant + waypoints + increments clone_count.
-- If any step fails, the entire operation rolls back cleanly.
-- ==========================================
CREATE OR REPLACE FUNCTION public.clone_discover_trip(
  p_discover_trip_id UUID,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_dt public.discover_trips%ROWTYPE;
  v_trip_id UUID;
  v_waypoint JSONB;
  v_sort INT := 0;
  v_title TEXT;
  v_description TEXT;
BEGIN
  -- Fetch the discover trip (must be published)
  SELECT * INTO v_dt
    FROM public.discover_trips
    WHERE id = p_discover_trip_id
      AND status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discover trip not found or not published' USING ERRCODE = 'P0002';
  END IF;

  -- Check if user already has an active clone
  IF EXISTS (
    SELECT 1 FROM public.trips
    WHERE cloned_from_discover_trip_id = p_discover_trip_id
      AND organiser_user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'You have already cloned this trip' USING ERRCODE = 'P0003';
  END IF;

  -- Truncate to fit trips table constraints (title: 100, description: 2000)
  v_title := LEFT(v_dt.title, 100);
  v_description := LEFT(v_dt.description, 2000);

  -- Create the trip with sentinel dates
  INSERT INTO public.trips (
    organiser_user_id, title, description,
    start_date, end_date, dates_pending,
    difficulty, status, cloned_from_discover_trip_id
  ) VALUES (
    p_user_id, v_title, v_description,
    '1970-01-01'::date, '1970-01-01'::date, true,
    v_dt.difficulty, 'draft', p_discover_trip_id
  ) RETURNING id INTO v_trip_id;

  -- Auto-enrol organiser as participant
  INSERT INTO public.trip_participants (trip_id, user_id, role, status)
  VALUES (v_trip_id, p_user_id, 'organizer', 'going');

  -- Copy waypoints from JSONB into trip_waypoints rows
  FOR v_waypoint IN SELECT jsonb_array_elements(v_dt.waypoints)
  LOOP
    INSERT INTO public.trip_waypoints (
      trip_id, sort_order, day_index, type, name, lat, lng
    ) VALUES (
      v_trip_id,
      (v_waypoint ->> 'sortOrder')::INT,
      COALESCE((v_waypoint ->> 'dayIndex')::INT, 0),
      v_waypoint ->> 'type',
      v_waypoint ->> 'name',
      (v_waypoint ->> 'lat')::FLOAT,
      (v_waypoint ->> 'lng')::FLOAT
    );
  END LOOP;

  -- Increment clone count on the discover trip (atomic within this transaction)
  UPDATE public.discover_trips
  SET clone_count = clone_count + 1
  WHERE id = p_discover_trip_id;

  RETURN v_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Only callable by service_role (NestJS API calls this via SUPABASE_ADMIN)
REVOKE ALL ON FUNCTION public.clone_discover_trip(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_discover_trip(UUID, UUID) TO service_role;

COMMIT;
