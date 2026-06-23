-- Migration: 00152_document_orphan_reconciliation
-- Bike Document Vault (U13): reconcile storage objects orphaned when an upload
-- succeeds but CreateDocument never lands (the client uploads bytes BEFORE the
-- row exists, so a failed/abandoned create leaves the object with no
-- document_files row).
--
-- Runs as SECURITY DEFINER (service-role equivalent). Deletes objects in the
-- 'documents' bucket that have NO matching document_files row AND are older than
-- a 1-hour grace window (so it never races an in-flight upload). Every deletion
-- is logged. Mirrors the daily pg_cron pattern in
-- 00035_cron_hard_delete_and_exports_bucket.sql.

CREATE OR REPLACE FUNCTION public.reconcile_orphaned_document_objects()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  obj record;
BEGIN
  FOR obj IN
    SELECT o.name
    FROM storage.objects o
    WHERE o.bucket_id = 'documents'
      -- Grace window: never touch objects from an upload that may still be
      -- mid-flight toward its CreateDocument call.
      AND o.created_at < now() - interval '1 hour'
      -- Orphan = no document_files row points at this path.
      AND NOT EXISTS (
        SELECT 1 FROM public.document_files df WHERE df.storage_path = o.name
      )
    -- Bound each run so a large orphan backlog can't hold one long locking
    -- transaction over storage.objects; the remainder is reclaimed next run.
    ORDER BY o.created_at
    LIMIT 1000
  LOOP
    DELETE FROM storage.objects WHERE bucket_id = 'documents' AND name = obj.name;
    RAISE LOG 'reconcile_orphaned_document_objects: deleted orphan %', obj.name;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.reconcile_orphaned_document_objects IS
  'Document vault (00152): deletes documents-bucket objects with no document_files row, older than a 1-hour grace window. Daily cron.';

-- Service-role only (defense-in-depth; the cron runs as postgres).
REVOKE EXECUTE ON FUNCTION public.reconcile_orphaned_document_objects FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_orphaned_document_objects TO service_role;

-- Daily at 03:30 UTC (offset from the 03:00 hard-delete sweep).
SELECT cron.schedule(
  'reconcile-orphaned-document-objects',
  '30 3 * * *',
  $$SELECT public.reconcile_orphaned_document_objects()$$
);
