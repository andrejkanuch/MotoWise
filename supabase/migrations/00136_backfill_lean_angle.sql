-- =====================================================
-- Migration: backfill max_lean_angle from ride_waypoints
-- Ticket: MOT-236
-- =====================================================

-- The max_lean_angle column already exists on rides but endRide never wrote it.
-- Backfill from existing waypoint data. At ~105 rides this runs in <1s.
UPDATE public.rides r
SET max_lean_angle = sub.peak
FROM (
  SELECT ride_id, MAX(ABS(lean_angle)) AS peak
  FROM public.ride_waypoints
  WHERE lean_angle IS NOT NULL
  GROUP BY ride_id
) sub
WHERE r.id = sub.ride_id
  AND r.max_lean_angle IS NULL;
