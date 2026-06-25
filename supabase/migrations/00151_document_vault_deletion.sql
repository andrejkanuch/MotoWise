-- Migration: 00151_document_vault_deletion
-- Bike Document Vault (U2): purge document storage objects at account hard-delete.
--
-- CREATE OR REPLACE of hard_delete_expired_accounts() based on the LIVE body
-- (00033_account_deletion.sql — neither 00035 nor 00142 redefined it; 00142 only
-- re-granted other RPCs). Changes vs the live body: (1) add 'documents' to the
-- storage bucket list; (2) wrap the per-user delete in a BEGIN/EXCEPTION block so
-- one account's failure no longer aborts the whole nightly sweep. Every existing
-- bucket (bike-photos, diagnostic-photos, user-exports) is preserved.
--
-- Ordering is already correct in the live body: storage objects are deleted
-- INSIDE the per-user loop BEFORE `delete from auth.users`, so the documents /
-- document_files FK cascade from auth.users never orphans storage objects.
-- Document paths are user-rooted ({userId}/{motorcycleId}/{documentId}/file), so
-- the existing (storage.foldername(name))[1] = user prefix match covers them.
--
-- Signature is unchanged, so CREATE OR REPLACE preserves existing grants
-- (service-role-only, from 00033) — no re-grant needed.
--
-- NOTE: the pre-existing 'maintenance-photos' bucket is still NOT swept here.
-- That is a separate, pre-existing GDPR gap tracked as standalone follow-up work
-- (see plan Scope Boundaries) and is intentionally out of scope for this change.

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
      -- (bike photos, diagnostic photos, export files, vault documents)
      DELETE FROM storage.objects
      WHERE bucket_id IN ('bike-photos', 'diagnostic-photos', 'user-exports', 'documents')
        AND (storage.foldername(name))[1] = user_record.id::text;

      -- Delete the auth user (cascades to public.users and all FK-dependent tables,
      -- including documents + document_files)
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
  'MOT-121 + document vault (00151): permanently deletes accounts past grace period (cron). Sweeps bike-photos, diagnostic-photos, user-exports, documents storage objects before the auth.users cascade.';
