-- Feed query performance index
-- The feed queries rides by user_id (from follows), is_public, and started_at DESC.
-- Without this index, the query degrades to a sequential scan as the rides table grows.

CREATE INDEX idx_rides_feed_user
  ON public.rides (user_id, started_at DESC)
  WHERE is_public = true AND deleted_at IS NULL;
