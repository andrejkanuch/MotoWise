-- Allow all AI generation surfaces currently logged by the API.
ALTER TABLE public.content_generation_log
  DROP CONSTRAINT IF EXISTS content_generation_log_content_type_check;

ALTER TABLE public.content_generation_log
  ADD CONSTRAINT content_generation_log_content_type_check
  CHECK (
    content_type IN (
      'article',
      'quiz',
      'diagnostic_response',
      'diagnostic',
      'ride_summary',
      'trip_assistant'
    )
  );

ALTER TABLE public.content_generation_log
  DROP CONSTRAINT IF EXISTS content_generation_log_status_check;

ALTER TABLE public.content_generation_log
  ADD CONSTRAINT content_generation_log_status_check
  CHECK (status IN ('success', 'failed', 'rate_limited', 'rejected'));
