-- Add day_index to trip_waypoints for day-by-day itinerary grouping
-- Default 0 = Day 1 (zero-indexed)

ALTER TABLE public.trip_waypoints
  ADD COLUMN day_index INT NOT NULL DEFAULT 0;

-- Index for efficient day-based grouping queries
CREATE INDEX idx_trip_waypoints_day
  ON public.trip_waypoints (trip_id, day_index, sort_order);
