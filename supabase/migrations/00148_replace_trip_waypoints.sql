-- Migration: 00148_replace_trip_waypoints (audit H11)
--
-- TripLifecycleService.updateTrip replaced waypoints with a bare delete then a
-- separate insert. If the insert failed (or the request died between the two),
-- the trip was left with zero waypoints and no rollback. This RPC performs the
-- delete + bulk insert in a single transaction, so a failed insert rolls the
-- delete back — the trip never ends up empty.
--
-- Mirrors reorder_trip_waypoints (00085): organiser ownership is checked via
-- auth.uid() INSIDE the function (NO p_user_id parameter — never trust a
-- caller-supplied identity on a user-callable RPC). SECURITY DEFINER + pinned
-- search_path = '' per house rules; called via the per-request user client.

BEGIN;

CREATE OR REPLACE FUNCTION public.replace_trip_waypoints(
  p_trip_id uuid,
  p_waypoints jsonb
)
RETURNS VOID AS $$
BEGIN
  -- Organiser ownership check (identity from the JWT, never a parameter).
  IF NOT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = p_trip_id
      AND organiser_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Atomic replacement: both statements run in the same transaction, so a
  -- failing insert rolls the delete back.
  DELETE FROM public.trip_waypoints WHERE trip_id = p_trip_id;

  IF jsonb_array_length(p_waypoints) > 0 THEN
    INSERT INTO public.trip_waypoints (
      trip_id, type, name, lat, lng, notes, sort_order, day_index, period_of_day
    )
    SELECT
      p_trip_id,
      wp->>'type',
      wp->>'name',
      (wp->>'lat')::double precision,
      (wp->>'lng')::double precision,
      wp->>'notes',
      (wp->>'sort_order')::integer,
      COALESCE((wp->>'day_index')::integer, 0),
      wp->>'period_of_day'
    FROM jsonb_array_elements(p_waypoints) AS wp;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.replace_trip_waypoints(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_trip_waypoints(uuid, jsonb) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
