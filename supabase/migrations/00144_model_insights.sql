-- ==========================================
-- model_insights — precomputed AI personalization cache, keyed by
-- Year/Make/Model (onboarding A/B 2026, Variant B "known issues" +
-- copy). Populated asynchronously by the API on first sighting of a
-- Y/M/M; served instantly from cache thereafter.
--
-- Access model: SERVICE-ROLE ONLY. The table holds no user data; it is
-- read through the @Public() onboardingReveal resolver via SUPABASE_ADMIN
-- (onboarding users are anonymous — no JWT). RLS is enabled with no
-- policies, so authenticated/anon roles are denied everything.
-- ==========================================

-- ==========================================
-- 1. Table
-- ==========================================
CREATE TABLE public.model_insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year          INT NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  make          TEXT NOT NULL,
  model         TEXT NOT NULL,
  -- Case-insensitive cache key (make|model|year), maintained by the DB so the
  -- API never has to keep its normalization in sync. UNIQUE → upsert target.
  normalized_key TEXT GENERATED ALWAYS AS (
    lower(make) || '|' || lower(model) || '|' || year::text
  ) STORED,
  -- 'pending' = generation enqueued, 'ready' = payload valid & servable,
  -- 'failed' = all providers failed (retried by the periodic regenerator)
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  -- Zod-validated ModelInsightsPayload (known_issues bullets + copy),
  -- written only after schema validation in the API layer
  payload       JSONB,
  -- Which provider produced the payload ('claude', 'openai', 'static')
  source_model  TEXT,
  generated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.model_insights IS
  'Cache of AI-generated per-model onboarding personalization (known issues, copy). Service-role only; facts (recalls/specs/intervals) never live here.';

-- ==========================================
-- 2. Indexes
-- ==========================================
-- One row per Y/M/M (case-insensitive via the generated key) — upsert target
CREATE UNIQUE INDEX uq_model_insights_normalized_key
  ON public.model_insights (normalized_key);

-- Periodic regeneration scans by staleness
CREATE INDEX idx_model_insights_generated_at
  ON public.model_insights (generated_at)
  WHERE status = 'ready';

-- ==========================================
-- 3. updated_at trigger
-- ==========================================
CREATE OR REPLACE FUNCTION public.model_insights_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_model_insights_updated_at ON public.model_insights;
CREATE TRIGGER trg_model_insights_updated_at
  BEFORE UPDATE ON public.model_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.model_insights_set_updated_at();

-- ==========================================
-- 4. RLS — enabled, NO policies: deny-all for anon/authenticated.
--    Only the service role (RLS-exempt) touches this table.
-- ==========================================
ALTER TABLE public.model_insights ENABLE ROW LEVEL SECURITY;
