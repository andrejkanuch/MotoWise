-- Migration: 00166_receipt_scans_metering
-- Receipt Scan (U2, part 1 of 2): metering + audit primitives.
--
-- Creates:
--   1. receipt_scans          — audit + status + resume payload, RLS (own-user SELECT)
--   2. reserve_receipt_scan() — SECURITY DEFINER metering RPC (service-role only)
--   3. bucket discriminator   — on expense_photos / maintenance_task_photos (U7a resolver)
--   4. CHECK extensions       — maintenance_tasks.source, content_generation_log.content_type
--
-- Storage bucket, storage RLS, orphan reconciliation and the R10 hard-delete
-- sweep live in the SAME PR's 00167_receipts_bucket_deletion.sql.
--
-- Modeled on:
--   - 00145_reserve_ai_generation.sql  (reservation RPC — STRUCTURE ONLY; see KTD-5 deviation)
--   - 00076_expense_photos.sql         (photo-table + RLS shape)
--
-- KTD-5 deviation from the 00145 template (deliberate): 00145 RAISEs on limit;
-- reserve_receipt_scan ALWAYS inserts the pending row and returns `over_quota`,
-- so the NestJS service decides reject-vs-proceed per ENTITLEMENTS_ENFORCED
-- (shadow mode needs the row to exist even when over quota — payload persistence,
-- resume, count fidelity, bypass telemetry). It also sweeps this user's stale
-- pendings to 'failed' BEFORE counting, so abandoned scans never lock a user out.

BEGIN;

-- =============================================================================
-- 1. receipt_scans — audit + metering + resume state
-- =============================================================================
CREATE TABLE public.receipt_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- pending: reserved, extraction in flight. success: valid structured data.
  -- failed: extraction failed / reaped (credit released). cancelled: client CAS
  -- that lost to the finalizer never happens; a won cancel lands here (free).
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  -- Extracted structured result. VIN/plate is stripped in the service BEFORE
  -- persist (KTD-9); odometerValue/Unit ARE persisted (needed for resume).
  extraction_payload JSONB,
  -- {uid}/{scanId}.webp in the private receipts bucket. Written by the service
  -- AFTER reservation (the RPC returns the id the path is built from).
  storage_path TEXT,
  -- KTD-10: the genuinely-exempt first onboarding scan. Only ever true for the
  -- one exempt row (the RPC stores false for any later onboarding-flagged scan),
  -- so it is both excluded from the monthly count AND farming-proof.
  is_onboarding BOOLEAN NOT NULL DEFAULT false,
  -- saveReceiptScan stamps these (KTD-11): distinguishes success-unreviewed from
  -- success-saved; powers resume, the home priority card, and undo.
  saved_at TIMESTAMPTZ,
  saved_record_refs JSONB,
  -- Month this scan meters against (UTC), stamped at reservation. Reporting +
  -- monthly-count index support.
  consumed_month DATE NOT NULL DEFAULT (date_trunc('month', now() AT TIME ZONE 'utc'))::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backs the RPC's monthly count (user_id + consumed_month).
CREATE INDEX idx_receipt_scans_user_month ON public.receipt_scans (user_id, consumed_month);
-- Backs the reaper sweep (this user's stale pendings).
CREATE INDEX idx_receipt_scans_pending ON public.receipt_scans (user_id)
  WHERE status = 'pending';
-- Backs the 00167 orphan-reconciliation probe (storage_path = object name).
CREATE INDEX idx_receipt_scans_storage_path ON public.receipt_scans (storage_path)
  WHERE storage_path IS NOT NULL;

ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;

-- Own-user SELECT only. INSERT/UPDATE happen exclusively through the service-role
-- client (RLS-bypassing) + the reserve_receipt_scan RPC — there is deliberately
-- NO user INSERT/UPDATE policy, so a direct PostgREST caller cannot forge or
-- mutate a scan row (status/consumption is server-decided, KTD-4).
CREATE POLICY "Users read own receipt scans" ON public.receipt_scans
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.receipt_scans IS
  'Receipt-scan audit + metering + resume state. Status/consumption server-decided (KTD-4). RLS: own-user SELECT; writes are service-role + reserve_receipt_scan only. VIN stripped before extraction_payload persist (KTD-9).';

-- =============================================================================
-- 2. reserve_receipt_scan — metering RPC (service-role only)
-- =============================================================================
-- SECURITY: takes p_user_id instead of auth.uid() (same rationale as 00145 —
-- system metering primitive called only by the API's service_role client where
-- auth.uid() is NULL). Forgeability is closed by grants, not identity.
--
-- p_monthly_limit defaults to 3 to keep the RPC self-consistent, but the service
-- passes FREE_TIER_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH (added in U5) so the number
-- has a single owner in TS. This is the unavoidable SQL/TS duplication (cf. the
-- expense-category CHECK) — keep them in sync.
CREATE OR REPLACE FUNCTION public.reserve_receipt_scan(
  p_user_id uuid,
  p_is_onboarding boolean DEFAULT false,
  p_monthly_limit integer DEFAULT 3
)
RETURNS TABLE (reservation_id uuid, over_quota boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_used integer := 0;
  v_is_first_onboarding boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- Serialize this user's concurrent reservations (released at commit/rollback):
  -- makes the sweep + count + insert atomic against the race in the acceptance test.
  PERFORM pg_advisory_xact_lock(hashtext('receipt_scan:' || p_user_id::text));

  -- KTD-5(a) — reaper BEFORE count: sweep this user's >15-min pendings to failed,
  -- else 3 abandoned/app-killed pendings would lock the user out of the RPC.
  UPDATE public.receipt_scans
    SET status = 'failed'
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND created_at < now() - interval '15 minutes';

  -- KTD-10 — onboarding exemption, capped at one per user: exempt ONLY when the
  -- user has zero prior onboarding rows (flag is client-supplied; the cap closes
  -- the farming hole).
  IF p_is_onboarding THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.receipt_scans
      WHERE user_id = p_user_id AND is_onboarding = true
    ) INTO v_is_first_onboarding;
  END IF;

  IF NOT v_is_first_onboarding THEN
    -- This UTC calendar month's committed + in-flight scans. failed/cancelled
    -- don't count; pending DOES (an in-flight scan already holds a slot).
    -- Onboarding rows are excluded from the count.
    SELECT count(*)
    INTO v_used
    FROM public.receipt_scans
    WHERE user_id = p_user_id
      AND is_onboarding = false
      AND status NOT IN ('failed', 'cancelled')
      AND created_at >= (date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc');
  END IF;

  over_quota := (NOT v_is_first_onboarding) AND (v_used >= p_monthly_limit);

  -- KTD-5(b) — ALWAYS insert pending (deviation from 00145's RAISE). Store
  -- is_onboarding = only-when-genuinely-exempt so a 2nd onboarding-flagged scan
  -- meters normally and stays counted next month too.
  INSERT INTO public.receipt_scans (user_id, status, is_onboarding, consumed_month)
  VALUES (
    p_user_id,
    'pending',
    v_is_first_onboarding,
    (date_trunc('month', now() AT TIME ZONE 'utc'))::date
  )
  RETURNING id INTO reservation_id;

  RETURN NEXT;
END;
$$;

-- Money/quota RPC: service_role only (p_user_id is forgeable by any authenticated
-- PostgREST caller otherwise — see header).
REVOKE ALL ON FUNCTION public.reserve_receipt_scan(uuid, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_receipt_scan(uuid, boolean, integer) TO service_role;

COMMENT ON FUNCTION public.reserve_receipt_scan IS
  'Receipt-scan metering (KTD-5): sweeps this user''s stale pendings, counts the UTC month, ALWAYS inserts a pending row, returns {reservation_id, over_quota}. Service decides reject-vs-proceed per ENTITLEMENTS_ENFORCED. Onboarding first scan exempt + capped (KTD-10). Service-role only.';

-- =============================================================================
-- 3. bucket discriminator on the photo-link tables (R5 / U7a)
-- =============================================================================
-- Both tables store only storage_path with no bucket marker (verified). Legacy
-- rows live in 'maintenance-photos'; receipt-linked rows will be 'receipts'.
-- U7a's signed-URL resolver keys off this to pick public-URL vs signed-URL
-- resolution (KTD-2 / mixed public-private, PRD R5).
ALTER TABLE public.expense_photos
  ADD COLUMN bucket TEXT NOT NULL DEFAULT 'maintenance-photos'
    CHECK (bucket IN ('maintenance-photos', 'receipts'));

ALTER TABLE public.maintenance_task_photos
  ADD COLUMN bucket TEXT NOT NULL DEFAULT 'maintenance-photos'
    CHECK (bucket IN ('maintenance-photos', 'receipts'));

COMMENT ON COLUMN public.expense_photos.bucket IS
  'Storage bucket for storage_path. Legacy/default: maintenance-photos (public). receipts: private bucket, signed-URL only (R5/KTD-2).';
COMMENT ON COLUMN public.maintenance_task_photos.bucket IS
  'Storage bucket for storage_path. Legacy/default: maintenance-photos (public). receipts: private bucket, signed-URL only (R5/KTD-2).';

-- =============================================================================
-- 4. CHECK extensions
-- =============================================================================
-- maintenance_tasks.source (00022:38) + 'receipt_scan' so a scan-created
-- completed task is attributable (U3/U7b).
ALTER TABLE public.maintenance_tasks
  DROP CONSTRAINT IF EXISTS maintenance_tasks_source_check;
ALTER TABLE public.maintenance_tasks
  ADD CONSTRAINT maintenance_tasks_source_check
  CHECK (source IN ('user', 'oem', 'imported', 'receipt_scan'));

-- content_generation_log.content_type — last defined in 00149 §6 with 9 values;
-- DROP/ADD preserving all 9 + 'receipt_scan' (AI-budget integration, R1).
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
      'maintenance_narrative',
      'receipt_scan'
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
