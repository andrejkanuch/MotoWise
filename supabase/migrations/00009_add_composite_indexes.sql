-- Migration: Add composite indexes for common query patterns
-- Improves performance for article listing, learning progress, diagnostics, and content flags

-- Articles: covers is_hidden filter + generated_at sort + cursor pagination
CREATE INDEX idx_articles_visible_generated
  ON public.articles (generated_at DESC) WHERE is_hidden = false;

-- Learning progress: covers user filter + last_read_at sort (replaces single-column index)
DROP INDEX IF EXISTS idx_learning_progress_user_id;
CREATE INDEX idx_learning_progress_user_read
  ON public.learning_progress (user_id, last_read_at DESC NULLS LAST);

-- Diagnostics: covers user filter + created_at sort (replaces single-column index)
DROP INDEX IF EXISTS idx_diagnostics_user_id;
CREATE INDEX idx_diagnostics_user_created
  ON public.diagnostics (user_id, created_at DESC);

-- Content flags: user lookup for RLS filter
CREATE INDEX idx_content_flags_user_id ON public.content_flags (user_id);

-- Diagnostics: FK index for article deletion (ON DELETE SET NULL)
CREATE INDEX idx_diagnostics_related_article
  ON public.diagnostics (related_article_id) WHERE related_article_id IS NOT NULL;
