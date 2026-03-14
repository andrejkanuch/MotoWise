-- Add keywords array column to articles
ALTER TABLE articles ADD COLUMN keywords TEXT[] NOT NULL DEFAULT '{}';

-- Add CHECK constraint for max 20 keywords, each max 50 chars
ALTER TABLE articles ADD CONSTRAINT chk_keywords_length
  CHECK (array_length(keywords, 1) IS NULL OR array_length(keywords, 1) <= 20);

-- Drop old search_vector and recreate with weighted keywords
-- The search_vector is a GENERATED ALWAYS AS stored column
-- First drop the existing generated column, then recreate with keywords included
ALTER TABLE articles DROP COLUMN search_vector;
ALTER TABLE articles ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(raw_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(keywords, ' '), '')), 'A')
  ) STORED;

-- Recreate GIN index
CREATE INDEX IF NOT EXISTS idx_articles_search_vector ON articles USING GIN (search_vector);

-- Rollback:
-- ALTER TABLE articles DROP COLUMN search_vector;
-- ALTER TABLE articles ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(raw_text, ''))) STORED;
-- CREATE INDEX IF NOT EXISTS idx_articles_search_vector ON articles USING GIN (search_vector);
-- ALTER TABLE articles DROP CONSTRAINT chk_keywords_length;
-- ALTER TABLE articles DROP COLUMN keywords;
