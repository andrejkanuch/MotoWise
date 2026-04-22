-- Migration: 00120_atomic_clone_trip_template
--
-- Atomic RPC for cloning a trip template into a user's personal draft trip.
-- Single transaction: copies trip + waypoints + adds organiser participant + increments clone_count.
-- Replaces the multi-step service-level clone that was not atomic.

BEGIN;

CREATE OR REPLACE FUNCTION public.clone_trip_template(
  p_trip_id UUID,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_source public.trips%ROWTYPE;
  v_new_trip_id UUID;
BEGIN
  -- Fetch the source trip (must be a template and not flagged)
  SELECT * INTO v_source
    FROM public.trips
    WHERE id = p_trip_id
      AND is_template = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip template not found' USING ERRCODE = 'P0002';
  END IF;

  -- Check if user already has an active clone of this template
  IF EXISTS (
    SELECT 1 FROM public.trips
    WHERE cloned_from_trip_id = p_trip_id
      AND organiser_user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'You have already cloned this template' USING ERRCODE = 'P0003';
  END IF;

  -- Create the new draft trip from the template
  INSERT INTO public.trips (
    organiser_user_id,
    title,
    description,
    difficulty,
    max_riders,
    visibility,
    cover_image_url,
    start_date,
    end_date,
    dates_pending,
    status,
    country_code,
    region_code,
    city,
    polyline,
    distance_m,
    elevation_gain_m,
    estimated_duration_minutes,
    surface_type,
    curvature_index,
    day_count,
    start_lat,
    start_lng,
    cloned_from_trip_id,
    is_template
  ) VALUES (
    p_user_id,
    LEFT(v_source.title, 100),
    LEFT(v_source.description, 2000),
    v_source.difficulty,
    v_source.max_riders,
    'private',
    v_source.cover_image_url,
    '1970-01-01'::date,
    '1970-01-01'::date,
    true,
    'draft',
    v_source.country_code,
    v_source.region_code,
    v_source.city,
    v_source.polyline,
    v_source.distance_m,
    v_source.elevation_gain_m,
    v_source.estimated_duration_minutes,
    v_source.surface_type,
    v_source.curvature_index,
    v_source.day_count,
    v_source.start_lat,
    v_source.start_lng,
    p_trip_id,
    false
  ) RETURNING id INTO v_new_trip_id;

  -- Copy all waypoints from the source template
  INSERT INTO public.trip_waypoints (
    trip_id, sort_order, day_index, period_of_day, type, name, notes, lat, lng
  )
  SELECT
    v_new_trip_id,
    tw.sort_order,
    COALESCE(tw.day_index, 0),
    tw.period_of_day,
    tw.type,
    tw.name,
    tw.notes,
    tw.lat,
    tw.lng
  FROM public.trip_waypoints tw
  WHERE tw.trip_id = p_trip_id
  ORDER BY tw.day_index, tw.sort_order;

  -- Auto-enrol organiser as participant
  INSERT INTO public.trip_participants (trip_id, user_id, role, status)
  VALUES (v_new_trip_id, p_user_id, 'organizer', 'going');

  -- Increment clone_count on the source template
  UPDATE public.trips
  SET clone_count = clone_count + 1
  WHERE id = p_trip_id;

  RETURN v_new_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Only callable by service_role (NestJS API calls this via SUPABASE_ADMIN)
REVOKE ALL ON FUNCTION public.clone_trip_template(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_trip_template(UUID, UUID) TO service_role;

COMMIT;
