-- Add status column to diagnostics for tracking AI processing state
ALTER TABLE public.diagnostics
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

CREATE INDEX idx_diagnostics_status ON public.diagnostics (status) WHERE status = 'pending';
