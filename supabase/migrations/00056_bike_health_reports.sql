-- Migration: Create bike_health_reports table for purchasable PDF health reports
-- Part of Community Layer — Phase 1: Monetization

-- ==========================================
-- TABLE: bike_health_reports
-- ==========================================
CREATE TABLE public.bike_health_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bike_id             UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending',
  purchased_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_storage_path    TEXT,
  pdf_signed_url      TEXT,
  download_expires_at TIMESTAMPTZ,
  iap_transaction_id  TEXT,

  CONSTRAINT chk_health_reports_status
    CHECK (status IN ('pending', 'completed', 'failed'))
);

ALTER TABLE public.bike_health_reports ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES
-- ==========================================

-- "My Reports" list: user's reports per bike, newest first
CREATE INDEX idx_health_reports_user_bike
  ON public.bike_health_reports (user_id, bike_id, purchased_at DESC);

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Owner can read their own reports
CREATE POLICY "health_reports_select" ON public.bike_health_reports
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Owner can insert — with IDOR prevention on bike_id ownership
CREATE POLICY "health_reports_insert" ON public.bike_health_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND bike_id IN (
      SELECT id FROM public.motorcycles
      WHERE user_id = (select auth.uid()) AND deleted_at IS NULL
    )
  );

-- Reports are immutable once created — no UPDATE or DELETE for authenticated
CREATE POLICY "health_reports_no_update" ON public.bike_health_reports
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "health_reports_no_delete" ON public.bike_health_reports
  FOR DELETE TO authenticated
  USING (false);
