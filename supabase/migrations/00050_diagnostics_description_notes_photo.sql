-- Add additional_notes (user input) and photo_url to diagnostics
-- description already exists from migration 00043

ALTER TABLE diagnostics
  ADD COLUMN IF NOT EXISTS additional_notes text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN diagnostics.description IS 'AI-generated one-line summary of the diagnosis';
COMMENT ON COLUMN diagnostics.additional_notes IS 'User-provided additional context notes';
COMMENT ON COLUMN diagnostics.photo_url IS 'Supabase Storage URL of the submitted diagnostic photo';
