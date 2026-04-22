-- Migration: 00116_condition_tags_size_check
--
-- Add defense-in-depth CHECK on condition_tags JSONB to prevent
-- unbounded data via direct PostgREST writes or future code paths.

ALTER TABLE public.discover_trip_reviews
  ADD CONSTRAINT chk_condition_tags_size
  CHECK (jsonb_typeof(condition_tags) = 'array' AND octet_length(condition_tags::text) <= 2048);
