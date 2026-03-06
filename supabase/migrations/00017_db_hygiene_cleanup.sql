-- Database hygiene: JSONB validation, unused extension cleanup

-- Add minimal JSONB structural validation on critical columns
ALTER TABLE public.articles
  ADD CONSTRAINT chk_articles_content_json_object
  CHECK (jsonb_typeof(content_json) = 'object') NOT VALID;

ALTER TABLE public.quizzes
  ADD CONSTRAINT chk_quizzes_questions_json_array
  CHECK (jsonb_typeof(questions_json) = 'array') NOT VALID;

-- Drop unused uuid-ossp extension (all tables use gen_random_uuid() which is built-in)
DROP EXTENSION IF EXISTS "uuid-ossp";

-- Note: pg_trgm is kept for planned fuzzy search on motorcycle make/model
-- Note: content_generation_log CHECK constraints (vs PG enums) are intentional
-- for a logging table that may gain new content types without ALTER TYPE
