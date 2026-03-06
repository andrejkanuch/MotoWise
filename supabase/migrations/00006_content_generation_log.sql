-- Migration: Content generation log for AI API usage tracking
-- Tracks all AI content generation (articles, quizzes, diagnostic responses)

CREATE TABLE public.content_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('article', 'quiz', 'diagnostic_response')),
  content_id UUID,                  -- polymorphic FK to generated content
  input_tokens INTEGER,
  output_tokens INTEGER,
  model TEXT,                       -- e.g., 'claude-sonnet-4-5-20250514'
  cost_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'rate_limited')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_content_gen_log_user_id ON public.content_generation_log (user_id);
CREATE INDEX idx_content_gen_log_content_type ON public.content_generation_log (content_type);
CREATE INDEX idx_content_gen_log_created_at ON public.content_generation_log (created_at DESC);

-- RLS
ALTER TABLE public.content_generation_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own generation logs
CREATE POLICY "Users read own generation logs" ON public.content_generation_log
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can read all generation logs
CREATE POLICY "Admins read all generation logs" ON public.content_generation_log
  FOR SELECT USING (public.is_admin());

-- No INSERT policy — inserts happen via service role (SUPABASE_ADMIN) bypassing RLS
