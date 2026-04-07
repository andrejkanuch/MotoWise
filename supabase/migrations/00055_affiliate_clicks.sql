-- Migration: Create affiliate_clicks table for tracking partner link engagement
-- Part of Community Layer — Phase 1: Monetization

-- ==========================================
-- TABLE: affiliate_clicks
-- ==========================================
CREATE TABLE public.affiliate_clicks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  diagnosis_type  TEXT,
  partner         TEXT NOT NULL,
  product_url     TEXT NOT NULL,
  clicked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_affiliate_clicks_partner
    CHECK (partner IN ('revzilla', 'amazon', 'rocky_mountain'))
);

-- Dedup: one click per user per URL per calendar day
-- Use date_trunc with 'day' at UTC for immutability
CREATE OR REPLACE FUNCTION public.utc_date(ts TIMESTAMPTZ)
RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT (ts AT TIME ZONE 'UTC')::date;
$$;

CREATE UNIQUE INDEX idx_affiliate_clicks_user_url_day
  ON public.affiliate_clicks (user_id, product_url, public.utc_date(clicked_at));

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES
-- ==========================================

-- Admin dashboard analytics: clicks by partner over time
CREATE INDEX idx_affiliate_clicks_partner_date
  ON public.affiliate_clicks (partner, clicked_at DESC);

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Authenticated users can record their own clicks
CREATE POLICY "clicks_insert" ON public.affiliate_clicks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- No SELECT for authenticated — analytics via service role only
-- Explicit deny UPDATE and DELETE
CREATE POLICY "clicks_no_select" ON public.affiliate_clicks
  FOR SELECT TO authenticated
  USING (false);

CREATE POLICY "clicks_no_update" ON public.affiliate_clicks
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "clicks_no_delete" ON public.affiliate_clicks
  FOR DELETE TO authenticated
  USING (false);
