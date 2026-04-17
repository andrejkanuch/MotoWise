-- Add period_of_day to trip_waypoints for intra-day grouping
-- (morning / afternoon / evening). Nullable for backward compatibility.

ALTER TABLE public.trip_waypoints
  ADD COLUMN period_of_day TEXT
  CHECK (period_of_day IS NULL OR period_of_day IN ('morning', 'afternoon', 'evening'));

-- Composite index for fetching waypoints ordered within a day and period.
-- NULLS FIRST keeps legacy (unlabelled) stops at the top of each day.
CREATE INDEX idx_trip_waypoints_trip_day_period_sort
  ON public.trip_waypoints (trip_id, day_index, period_of_day NULLS FIRST, sort_order);
