CREATE OR REPLACE FUNCTION public.mark_article_read(p_user_id UUID, p_article_id UUID)
RETURNS SETOF public.learning_progress AS $$
  INSERT INTO public.learning_progress (user_id, article_id, article_read, first_read_at, last_read_at)
  VALUES (p_user_id, p_article_id, true, NOW(), NOW())
  ON CONFLICT (user_id, article_id)
  DO UPDATE SET article_read = true, last_read_at = NOW()
  RETURNING *;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';
