-- Migration: 00167_receipts_bucket_deletion
-- Receipt Scan (U2, part 2 of 2): private storage + GDPR deletion (R10, same PR).
--
-- Creates:
--   1. Private 'receipts' bucket + folder-prefix Storage RLS with a strict
--      {uid}/{uuid}.webp object-name constraint (KTD-2 belt-and-suspenders).
--   2. reconcile_orphaned_receipt_objects() + daily cron — sweeps objects
--      uploaded before a reservation that never got a receipt_scans row.
--   3. CREATE OR REPLACE hard_delete_expired_accounts() adding 'receipts' to the
--      swept bucket list (R10 — the most PII-dense images in the app).
--
-- Modeled on:
--   - 00150_document_vault.sql              (private bucket + folder-prefix RLS)
--   - 00152_document_orphan_reconciliation  (orphan sweep + cron)
--   - 00151_document_vault_deletion         (hard-delete CREATE OR REPLACE)
--
-- Storage RLS is real belt-and-suspenders here: the shipped signed-URL resolver
-- mints via the admin client (which BYPASSES storage RLS) and asserts
-- foldername[1]=auth.uid() in app code (KTD-2). These policies additionally
-- constrain uploads to the user's own {uid}/{uuid}.webp — no nested folders,
-- no arbitrary object names.

-- =============================================================================
-- 1. Private 'receipts' bucket + folder-prefix RLS
-- =============================================================================
-- Receipt-profile WebP only (compressReceiptImage, KTD-8). 10 MB ceiling is
-- generous for a ≥1920px mild WebP (~0.3 MB observed); per-type validation is
-- the server magic-byte check.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,                       -- PRIVATE — signed URLs only, never public
  10485760,                    -- 10 MB
  ARRAY['image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- INSERT: object must be exactly {auth.uid()}/{uuid}.webp — one path segment
-- (the uid folder) and a strict-UUID basename. Closes the KTD-2 path-forgery
-- class at the storage layer (client uploads BEFORE the scanReceipt call, so the
-- object exists before any row validates it).
CREATE POLICY "Users upload own receipts" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND array_length(storage.foldername(name), 1) = 1
    AND storage.filename(name) ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.webp$'
  );

-- SELECT: own-prefix. Defense-in-depth for the per-request user client; the
-- server path mints via admin + app-layer ownership assertion (KTD-2).
CREATE POLICY "Users read own receipts" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users delete own receipts" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Service role: system sweeps (orphan reconciliation, hard-delete) + undo's
-- guarded photo-object delete (KTD-11).
CREATE POLICY "Service role manages receipts bucket" ON storage.objects
  FOR ALL USING (
    bucket_id = 'receipts'
    AND auth.role() = 'service_role'
  );

-- =============================================================================
-- 2. Orphan reconciliation — objects uploaded but never reserved
-- =============================================================================
-- The client uploads {uid}/{scanId}.webp BEFORE calling scanReceipt, so a
-- rejected/abandoned scan leaves an object with no receipt_scans.storage_path.
-- Clone of 00152: batched DELETE of orphans older than a 1-hour grace window.
CREATE OR REPLACE FUNCTION public.reconcile_orphaned_receipt_objects()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  WITH orphans AS (
    SELECT o.name
    FROM storage.objects o
    WHERE o.bucket_id = 'receipts'
      -- Grace window: never touch an upload that may still be mid-flight toward
      -- its scanReceipt call.
      AND o.created_at < now() - interval '1 hour'
      -- Orphan = no receipt_scans row points at this path.
      AND NOT EXISTS (
        SELECT 1 FROM public.receipt_scans rs WHERE rs.storage_path = o.name
      )
    ORDER BY o.created_at
    LIMIT 1000
  ),
  deleted AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'receipts'
      AND name IN (SELECT name FROM orphans)
    RETURNING name
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  IF deleted_count > 0 THEN
    RAISE LOG 'reconcile_orphaned_receipt_objects: deleted % orphan(s)', deleted_count;
  END IF;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.reconcile_orphaned_receipt_objects IS
  'Receipt scan (00167): deletes receipts-bucket objects with no receipt_scans row, older than a 1-hour grace window. Daily cron.';

REVOKE EXECUTE ON FUNCTION public.reconcile_orphaned_receipt_objects FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_orphaned_receipt_objects TO service_role;

-- Daily at 03:45 UTC (offset from 03:00 hard-delete + 03:30 document sweep).
SELECT cron.schedule(
  'reconcile-orphaned-receipt-objects',
  '45 3 * * *',
  $$SELECT public.reconcile_orphaned_receipt_objects()$$
);

-- =============================================================================
-- 3. R10 — add 'receipts' to the account hard-delete sweep (SAME PR)
-- =============================================================================
-- CREATE OR REPLACE of the LIVE body (00151), adding 'receipts' to the bucket
-- list. Every existing bucket is preserved. receipt_scans rows cascade via the
-- user_id → auth.users FK; storage objects are deleted BEFORE that cascade, so
-- nothing orphans. Signature unchanged → existing service-role grant preserved.
--
-- NOTE (unchanged, tracked separately): 'maintenance-photos' is STILL not swept
-- here — a pre-existing GDPR gap, out of scope for this epic (plan Scope Boundaries).
CREATE OR REPLACE FUNCTION public.hard_delete_expired_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  user_record record;
BEGIN
  FOR user_record IN
    SELECT id FROM public.users
    WHERE deletion_scheduled_at IS NOT NULL
      AND deletion_scheduled_at <= now()
      AND deleted_at IS NOT NULL
  LOOP
    -- Isolate per-user failures: one account's storage/cascade error must not
    -- abort the entire nightly sweep and strand every remaining account.
    BEGIN
      -- Delete storage files for this user BEFORE the auth.users cascade fires.
      -- (bike photos, diagnostic photos, export files, vault documents, receipts)
      DELETE FROM storage.objects
      WHERE bucket_id IN ('bike-photos', 'diagnostic-photos', 'user-exports', 'documents', 'receipts')
        AND (storage.foldername(name))[1] = user_record.id::text;

      -- Delete the auth user (cascades to public.users and all FK-dependent tables,
      -- including documents, document_files, and receipt_scans)
      DELETE FROM auth.users WHERE id = user_record.id;

      deleted_count := deleted_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'hard_delete_expired_accounts: failed to delete user %: %',
          user_record.id, SQLERRM;
    END;
  END LOOP;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.hard_delete_expired_accounts IS
  'MOT-121 + document vault (00151) + receipt scan (00167): permanently deletes accounts past grace period (cron). Sweeps bike-photos, diagnostic-photos, user-exports, documents, receipts storage objects before the auth.users cascade.';

-- Harden a PRE-EXISTING gap surfaced by the security advisor when this function
-- was touched: its ACL still granted EXECUTE to PUBLIC/anon/authenticated (00033
-- never revoked it, despite 00151's header claiming service-role-only), so any
-- signed-in user could trigger the account-deletion sweep via /rest/v1/rpc.
-- CREATE OR REPLACE preserves ACLs, so this must be an explicit REVOKE. The cron
-- runs as postgres (owner) and the API calls it via service_role — both retained.
REVOKE ALL ON FUNCTION public.hard_delete_expired_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_expired_accounts() TO service_role;
