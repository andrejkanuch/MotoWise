-- Migration: sync denormalized counters
-- Adds triggers/RPCs to keep articles.flag_count, articles.view_count,
-- and learning_progress.quiz_best_score / quiz_completed in sync.

-- 1. flag_count trigger: increment articles.flag_count when a content_flag is inserted
CREATE OR REPLACE FUNCTION public.update_article_flag_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.articles SET flag_count = flag_count + 1 WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_content_flag_created
  AFTER INSERT ON public.content_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_article_flag_count();

-- 2. view_count: increment via RPC (not trigger — reads happen outside INSERT)
CREATE OR REPLACE FUNCTION public.increment_article_view_count(p_article_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.articles SET view_count = view_count + 1 WHERE id = p_article_id;
END;
$$;

-- 3. quiz score trigger: update learning_progress after quiz_attempt insert
CREATE OR REPLACE FUNCTION public.update_quiz_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_article_id uuid;
  v_score_pct numeric;
BEGIN
  -- Get the article_id from the quiz
  SELECT article_id INTO v_article_id FROM public.quizzes WHERE id = NEW.quiz_id;

  -- Calculate percentage score
  v_score_pct := CASE WHEN NEW.total_questions > 0
    THEN ROUND((NEW.score::numeric / NEW.total_questions) * 100)
    ELSE 0 END;

  -- Update learning_progress: set quiz_completed = true, update best score if higher
  UPDATE public.learning_progress
  SET
    quiz_completed = true,
    quiz_best_score = GREATEST(COALESCE(quiz_best_score, 0), v_score_pct)
  WHERE user_id = NEW.user_id AND article_id = v_article_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_quiz_attempt_submitted
  AFTER INSERT ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_quiz_progress();
