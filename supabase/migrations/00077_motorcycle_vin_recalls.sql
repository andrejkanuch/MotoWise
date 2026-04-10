-- Migration: 00077_motorcycle_vin_recalls
-- MOT-142: VIN Safety Recall Lookup
-- Adds optional VIN field to motorcycles + cache columns for NHTSA recall checks.

ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS vin TEXT;

-- VIN format: 17 chars, A-H J-N P-R-Z 0-9 (excludes I, O, Q)
-- Per ISO 3779 / SAE J853
ALTER TABLE public.motorcycles
  DROP CONSTRAINT IF EXISTS motorcycles_vin_format;

ALTER TABLE public.motorcycles
  ADD CONSTRAINT motorcycles_vin_format
  CHECK (vin IS NULL OR (length(vin) = 17 AND vin ~ '^[A-HJ-NPR-Z0-9]{17}$'));

ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS recall_last_checked_at TIMESTAMPTZ;

ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS recall_count INT DEFAULT 0;

COMMENT ON COLUMN public.motorcycles.vin IS 'Optional 17-char VIN (ISO 3779). Used for NHTSA recall lookup (MOT-142).';
COMMENT ON COLUMN public.motorcycles.recall_last_checked_at IS 'Timestamp of the last NHTSA recall lookup performed for this motorcycle.';
COMMENT ON COLUMN public.motorcycles.recall_count IS 'Count of open recalls from the most recent NHTSA check. Drives the garage-card warning badge.';
