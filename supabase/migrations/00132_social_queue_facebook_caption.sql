-- Add facebook_caption column to social_post_queue.
-- Platform-specific captions: caption is for Instagram, facebook_caption is for Facebook.
-- NULL means fall back to the shared caption (backwards-compatible with existing rows).
ALTER TABLE public.social_post_queue
  ADD COLUMN IF NOT EXISTS facebook_caption text;

COMMENT ON COLUMN public.social_post_queue.facebook_caption IS
  'Facebook-tailored caption. When NULL, the shared caption column is used for both platforms.';
