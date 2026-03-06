-- Remove user-facing SELECT policy on content_generation_log
-- Users should not see cost_cents, model, or error_message directly
-- Generation log data will be served via curated NestJS endpoints if needed
DROP POLICY IF EXISTS "Users read own generation logs" ON public.content_generation_log;

-- Admins-only access remains unchanged
