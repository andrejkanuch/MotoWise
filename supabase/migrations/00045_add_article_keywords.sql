-- Add keywords array column to articles
ALTER TABLE articles ADD COLUMN keywords TEXT[] NOT NULL DEFAULT '{}';

-- Add CHECK constraint for max 20 keywords
ALTER TABLE articles ADD CONSTRAINT chk_keywords_length
  CHECK (array_length(keywords, 1) IS NULL OR array_length(keywords, 1) <= 20);

-- Drop the generated search_vector column and recreate as a regular column
ALTER TABLE articles DROP COLUMN search_vector;
ALTER TABLE articles ADD COLUMN search_vector tsvector;

-- Backfill search_vector for existing rows
UPDATE articles SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(raw_text, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(keywords, ' '), '')), 'A');

-- Create trigger function to keep search_vector in sync
CREATE OR REPLACE FUNCTION articles_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.raw_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.keywords, ' '), '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_articles_search_vector ON articles;
CREATE TRIGGER trg_articles_search_vector
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION articles_search_vector_update();

-- Recreate GIN index
CREATE INDEX IF NOT EXISTS idx_articles_search_vector ON articles USING GIN (search_vector);
