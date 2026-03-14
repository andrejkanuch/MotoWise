-- Unique constraint on content_flags to prevent duplicate flagging
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_flags_user_article
  ON content_flags (user_id, article_id);

-- Auto-hide articles when flag_count >= 3
CREATE OR REPLACE FUNCTION auto_hide_flagged_article()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.flag_count >= 3 AND (OLD.flag_count IS NULL OR OLD.flag_count < 3) THEN
    NEW.is_hidden := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_hide_flagged ON articles;
CREATE TRIGGER trg_auto_hide_flagged
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION auto_hide_flagged_article();

-- Partial index for popular articles query (non-hidden only)
CREATE INDEX IF NOT EXISTS idx_articles_popular
  ON articles (view_count DESC)
  WHERE is_hidden = false;
