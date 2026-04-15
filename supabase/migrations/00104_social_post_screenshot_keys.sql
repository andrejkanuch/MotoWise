-- Add screenshot_keys column to social_post_queue.
-- Stores an array of screenshot catalog keys (e.g. ["home-dashboard", "garage"])
-- that the worker resolves to real app screenshots when generating images.
-- Nullable — posts without screenshot_keys use pure text-to-image generation.

ALTER TABLE social_post_queue
  ADD COLUMN screenshot_keys text[] DEFAULT NULL;

COMMENT ON COLUMN social_post_queue.screenshot_keys IS
  'Array of screenshot catalog keys. Worker fetches these from Supabase Storage and passes as reference images to Gemini image generation.';
