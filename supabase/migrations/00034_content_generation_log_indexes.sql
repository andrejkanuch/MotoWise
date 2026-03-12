-- Composite partial indexes for AI budget queries
CREATE INDEX IF NOT EXISTS idx_content_gen_log_user_daily
  ON public.content_generation_log (user_id, created_at DESC)
  WHERE status = 'success';

CREATE INDEX IF NOT EXISTS idx_content_gen_log_global_daily
  ON public.content_generation_log (created_at DESC)
  WHERE status = 'success';
