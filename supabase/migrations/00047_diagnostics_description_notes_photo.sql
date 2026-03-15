-- Add description (AI-generated summary) and additional_notes (user input) to diagnostics
-- Also add photo_url so the submitted photo is accessible on the results page

ALTER TABLE diagnostics
  ADD COLUMN description text,
  ADD COLUMN additional_notes text,
  ADD COLUMN photo_url text;

COMMENT ON COLUMN diagnostics.description IS 'AI-generated one-line summary of the diagnosis';
COMMENT ON COLUMN diagnostics.additional_notes IS 'User-provided additional context notes';
COMMENT ON COLUMN diagnostics.photo_url IS 'Supabase Storage URL of the submitted diagnostic photo';
