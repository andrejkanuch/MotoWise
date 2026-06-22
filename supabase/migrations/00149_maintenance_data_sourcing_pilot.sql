-- Maintenance data-sourcing pilot (Africa Twin DCT) — U1
-- Adds: variant + provenance + verification to oem_maintenance_schedules,
--       motorcycles.variant, maintenance_data_sources + motorcycle_specs (service-role only),
--       content_generation_log content_type extension.
-- Plan: docs/plans/2026-06-19-001-feat-africa-twin-dct-data-pilot-plan.md (U1)
-- Patterns: 00022 (oem table), 00126 (ALL-CAPS make), 00129 (COALESCE natural-key index),
--           00144 (service-role-only RLS, deny-all), 00145 (content_type CHECK DROP/ADD),
--           00003/00013 (shared public.update_updated_at trigger fn).
-- NOTE: highest existing prefix at authoring time was 00148; re-verify before pushing.

BEGIN;

-- ============================================================
-- 1. Provenance table — one row per source document
--    Service-role only (deny-all RLS), mirrors 00144 model_insights.
-- ============================================================
CREATE TABLE public.maintenance_data_sources (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type          TEXT NOT NULL CHECK (source_type IN ('owner_manual', 'service_manual', 'community')),
  title                TEXT NOT NULL,
  edition_language     TEXT,
  market_applicability TEXT,            -- edition/market the values apply to (e.g. 'EU', 'US')
  reference            TEXT,            -- edition / part no. (e.g. '35MLN610')
  source_url           TEXT,            -- nullable: link or Supabase Storage path to the doc
  retrieved_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.maintenance_data_sources IS
  'Provenance for sourced maintenance data (owner/service manuals, community). Service-role only.';

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.maintenance_data_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.maintenance_data_sources ENABLE ROW LEVEL SECURITY;
-- No policies → deny-all for anon/authenticated; only the RLS-exempt service role reads/writes.

-- ============================================================
-- 2. Extend oem_maintenance_schedules: variant + provenance + verification
-- ============================================================
ALTER TABLE public.oem_maintenance_schedules
  ADD COLUMN variant            TEXT,                                    -- 'DCT'|'MT'|NULL (NULL = all variants)
  ADD COLUMN source_id          UUID REFERENCES public.maintenance_data_sources(id) ON DELETE RESTRICT,
  ADD COLUMN source_page        TEXT,
  ADD COLUMN source_context     TEXT,                                    -- snippet the value was read from
  ADD COLUMN is_safety_critical BOOLEAN NOT NULL DEFAULT false,          -- server-set from allowlist (never LLM)
  ADD COLUMN is_verified        BOOLEAN NOT NULL DEFAULT false,          -- THE gate (see U3 applyRowGate)
  ADD COLUMN verified_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN verified_at        TIMESTAMPTZ;

-- Backfill: every pre-existing row is today's trusted production data. The lookup gate is
-- `is_verified = true`; without this backfill the gate would silently drop all existing reminders.
UPDATE public.oem_maintenance_schedules SET is_verified = true WHERE is_verified = false;

-- ============================================================
-- 3. motorcycles.variant — lets a user's bike carry its variant (e.g. 'DCT')
--    Capture UI in U7; nullable so existing bikes are unaffected.
-- ============================================================
ALTER TABLE public.motorcycles ADD COLUMN variant TEXT;

-- ============================================================
-- 4. Natural-key unique index: extend to include variant + year_to.
--    Pre-check for duplicates under the NEW key first; abort the whole migration if any exist.
--    (00129's index was (make, COALESCE(model,''), COALESCE(year_from,0), task_name).)
-- ============================================================
DO $$
DECLARE
  dup_count INT;
  dup_keys  TEXT;
BEGIN
  SELECT count(*), string_agg(key_text, '; ')
    INTO dup_count, dup_keys
  FROM (
    SELECT make || '/' || COALESCE(model, '') || '/' || COALESCE(variant, '') || '/' ||
           COALESCE(year_from, 0)::text || '/' || COALESCE(year_to, 0)::text || '/' || task_name AS key_text
    FROM public.oem_maintenance_schedules
    GROUP BY make, COALESCE(model, ''), COALESCE(variant, ''), COALESCE(year_from, 0), COALESCE(year_to, 0), task_name
    HAVING count(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Duplicate natural keys block index recreation (% group(s)): %', dup_count, dup_keys;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_oem_schedules_natural_key;
CREATE UNIQUE INDEX idx_oem_schedules_natural_key
  ON public.oem_maintenance_schedules
  (make, COALESCE(model, ''), COALESCE(variant, ''), COALESCE(year_from, 0), COALESCE(year_to, 0), task_name);

-- Lookup index extended to cover the variant tier (U3 waterfall)
CREATE INDEX idx_oem_schedules_variant_lookup
  ON public.oem_maintenance_schedules (make, model, variant);

-- ============================================================
-- 5. motorcycle_specs — point-values not on an interval cadence
--    (torque, valve clearance, capacities, pressures, plug gap). Service-role only.
--    value_numeric is canonical metric, parsed/validated ONCE at extraction;
--    imperial is derived at render and never stored (see plan KTD 7/8).
-- ============================================================
CREATE TABLE public.motorcycle_specs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make               TEXT NOT NULL,
  model              TEXT,
  variant            TEXT,
  year_from          INT,
  year_to            INT,
  spec_type          TEXT NOT NULL CHECK (spec_type IN ('torque', 'valve_clearance', 'capacity', 'pressure', 'plug_gap')),
  spec_name          TEXT NOT NULL,
  value_numeric      NUMERIC NOT NULL CHECK (value_numeric > 0),  -- metric canonical (dot-decimal)
  value_display      TEXT,                                        -- verbatim manual string e.g. '0,20 mm'
  unit               TEXT NOT NULL,                               -- metric unit
  source_id          UUID REFERENCES public.maintenance_data_sources(id) ON DELETE RESTRICT,
  source_page        TEXT,
  source_context     TEXT,
  is_safety_critical BOOLEAN NOT NULL DEFAULT false,
  is_verified        BOOLEAN NOT NULL DEFAULT false,
  verified_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.motorcycle_specs IS
  'Per-model/variant point-value specs (torque, clearance, capacity, pressure). Metric canonical; service-role only.';

-- Idempotent extraction target: one row per natural key (enables ON CONFLICT upsert)
CREATE UNIQUE INDEX uq_motorcycle_specs_natural_key
  ON public.motorcycle_specs
  (make, COALESCE(model, ''), COALESCE(variant, ''), COALESCE(year_from, 0), spec_type, spec_name);

CREATE INDEX idx_motorcycle_specs_lookup
  ON public.motorcycle_specs (make, model, variant);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.motorcycle_specs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.motorcycle_specs ENABLE ROW LEVEL SECURITY;
-- No policies → deny-all for anon/authenticated; service-role only.

-- ============================================================
-- 6. Extend content_generation_log.content_type CHECK (DROP/ADD, per 00145).
--    Preserve the existing 7 values; add the two pilot types.
--    Must precede U2/U5 log inserts or they throw a check violation.
-- ============================================================
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
      'trip_assistant',
      'onboarding_insights',
      'maintenance_extraction',
      'maintenance_narrative'
    )
  );

COMMIT;
