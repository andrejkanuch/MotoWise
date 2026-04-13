-- Migration: 00098_sponsorships
--
-- Sponsored slot scaffolding for route monetization.
-- Sponsors can attach promoted content to routes; all auth users see active
-- sponsorships, sponsors manage their own, admins manage all.
-- Feature-flagged behind FEATURE_SPONSORSHIPS env var on the API side.

BEGIN;

-- ==========================================
-- 1. sponsorship_status enum
-- ==========================================
CREATE TYPE public.sponsorship_status AS ENUM (
  'active',
  'paused',
  'deactivated',
  'expired'
);

-- ==========================================
-- 2. sponsorships table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sponsorships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  sponsor_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  route_id            UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,

  -- Placement
  placement_type      TEXT NOT NULL
    CONSTRAINT sponsorships_placement_type_chk
      CHECK (placement_type IN ('banner', 'card', 'pin')),

  -- Content
  title               TEXT NOT NULL,
  description         TEXT,
  image_url           TEXT,
  cta_text            TEXT,
  cta_url             TEXT,

  -- Metrics
  impressions_count   INTEGER NOT NULL DEFAULT 0,
  clicks_count        INTEGER NOT NULL DEFAULT 0,

  -- Status & billing
  status              public.sponsorship_status NOT NULL DEFAULT 'active',
  cost_per_impression NUMERIC(10, 6) NOT NULL DEFAULT 0,
  monthly_budget      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  spent_this_month    NUMERIC(10, 2) NOT NULL DEFAULT 0,

  -- Schedule
  starts_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at             TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 3. Indexes
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_sponsorships_route_id
  ON public.sponsorships (route_id);

CREATE INDEX IF NOT EXISTS idx_sponsorships_sponsor_id
  ON public.sponsorships (sponsor_id);

CREATE INDEX IF NOT EXISTS idx_sponsorships_status
  ON public.sponsorships (status);

-- Composite: fast lookup of active sponsorships for a route
CREATE INDEX IF NOT EXISTS idx_sponsorships_route_active
  ON public.sponsorships (route_id)
  WHERE status = 'active';

-- ==========================================
-- 4. updated_at trigger
-- ==========================================
CREATE OR REPLACE FUNCTION public.sponsorships_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sponsorships_updated_at ON public.sponsorships;
CREATE TRIGGER trg_sponsorships_updated_at
  BEFORE UPDATE ON public.sponsorships
  FOR EACH ROW
  EXECUTE FUNCTION public.sponsorships_set_updated_at();

-- ==========================================
-- 5. Row Level Security
-- ==========================================
ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active sponsorships
CREATE POLICY sponsorships_select_active
  ON public.sponsorships
  FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Sponsors can manage (insert/update/delete) their own sponsorships
CREATE POLICY sponsorships_insert_own
  ON public.sponsorships
  FOR INSERT
  TO authenticated
  WITH CHECK (sponsor_id = auth.uid());

CREATE POLICY sponsorships_update_own
  ON public.sponsorships
  FOR UPDATE
  TO authenticated
  USING (sponsor_id = auth.uid())
  WITH CHECK (sponsor_id = auth.uid());

CREATE POLICY sponsorships_delete_own
  ON public.sponsorships
  FOR DELETE
  TO authenticated
  USING (sponsor_id = auth.uid());

-- Admins can see and manage all sponsorships
CREATE POLICY sponsorships_admin_all
  ON public.sponsorships
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

COMMIT;
