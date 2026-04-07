-- Migration: Create ride_summaries table + add AI summary / kudos columns to rides
-- Part of Community Layer — Phase 2: Social Foundation

-- ==========================================
-- TABLE: ride_summaries
-- ==========================================
CREATE TABLE public.ride_summaries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id           UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  summary_text      TEXT,
  generation_status TEXT NOT NULL DEFAULT 'pending',
  generated_at      TIMESTAMPTZ,
  model_version     TEXT,
  edited_by_user    BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT chk_ride_summaries_status
    CHECK (generation_status IN ('pending', 'completed', 'failed'))
);

-- 1:1 relationship — one summary per ride
CREATE UNIQUE INDEX idx_ride_summaries_ride_id
  ON public.ride_summaries (ride_id);

ALTER TABLE public.ride_summaries ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ALTER: rides table — add AI summary cache + kudos counter
-- ==========================================
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS kudos_count INT NOT NULL DEFAULT 0;

-- ==========================================
-- RLS: ride_summaries — owner-read + public-read (via rides join)
-- Service role writes only (no INSERT/UPDATE/DELETE for authenticated)
-- ==========================================

-- Owner can read summaries for their own rides
CREATE POLICY "summaries_owner_read" ON public.ride_summaries
  FOR SELECT TO authenticated
  USING (
    ride_id IN (
      SELECT id FROM public.rides WHERE user_id = (select auth.uid())
    )
  );

-- Any authenticated user can read summaries for public rides
CREATE POLICY "summaries_public_read" ON public.ride_summaries
  FOR SELECT TO authenticated
  USING (
    ride_id IN (
      SELECT id FROM public.rides WHERE is_public = true AND deleted_at IS NULL
    )
  );

-- ==========================================
-- RLS: Replace existing rides SELECT policy with owner + public combined
-- PostgreSQL OR-combines multiple SELECT policies — must drop old one first
-- ==========================================
DROP POLICY IF EXISTS "Enable read access for ride owner or admin" ON public.rides;

CREATE POLICY "rides_public_read" ON public.rides
  FOR SELECT TO authenticated
  USING (
    (user_id = (select auth.uid()) AND deleted_at IS NULL)
    OR (is_public = true AND deleted_at IS NULL)
    OR public.is_admin()
  );
