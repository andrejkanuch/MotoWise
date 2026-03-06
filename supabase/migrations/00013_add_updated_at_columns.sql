-- Add updated_at columns to mutable tables that were missing them
-- Matches the pattern used by users and articles tables

ALTER TABLE public.motorcycles
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.content_flags
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Auto-update triggers (reuse existing update_updated_at function from migration 00003)
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.motorcycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.content_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
