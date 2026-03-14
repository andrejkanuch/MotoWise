-- AI Diagnosis Flow v2: Add new fields for guided step-by-step redesign

-- Allow diagnostics without a garage motorcycle (manual bike entry)
ALTER TABLE diagnostics ALTER COLUMN motorcycle_id DROP NOT NULL;

-- New v2 columns
ALTER TABLE diagnostics
  ADD COLUMN urgency text CHECK (urgency IN ('stranded', 'soon', 'preventive')),
  ADD COLUMN free_text_description text,
  ADD COLUMN manual_bike_info jsonb
    CHECK (
      manual_bike_info IS NULL
      OR (
        jsonb_typeof(manual_bike_info) = 'object'
        AND manual_bike_info ? 'type'
        AND jsonb_typeof(manual_bike_info->'type') = 'string'
      )
    );

COMMENT ON COLUMN diagnostics.urgency IS 'User-reported urgency: stranded, soon, or preventive. Null = not specified.';
COMMENT ON COLUMN diagnostics.manual_bike_info IS 'Bike info for non-garage diagnostics: {type, year?, make?, model?}';

-- Split RLS into per-operation policies with motorcycle ownership on INSERT
DROP POLICY IF EXISTS "Users own diagnostics" ON public.diagnostics;

CREATE POLICY "Users read own diagnostics" ON public.diagnostics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own diagnostics" ON public.diagnostics
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      motorcycle_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.motorcycles
        WHERE id = motorcycle_id AND user_id = auth.uid() AND deleted_at IS NULL
      )
    )
  );

CREATE POLICY "Users update own diagnostics" ON public.diagnostics
  FOR UPDATE USING (auth.uid() = user_id);

-- Partial index for metrics queries
CREATE INDEX idx_diagnostics_urgency ON public.diagnostics (urgency) WHERE urgency IS NOT NULL;
