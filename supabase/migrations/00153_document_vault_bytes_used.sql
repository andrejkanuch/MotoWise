-- Migration: 00153_document_vault_bytes_used
-- Bike Document Vault (U3, perf): server-side SUM of a rider's stored bytes so the
-- quota check transfers a single integer instead of every document_files row.
--
-- SECURITY INVOKER (default): runs as the calling role with RLS enforced, so the
-- sum only ever covers the caller's own rows. The explicit user_id = auth.uid()
-- filter is belt-and-suspenders alongside the "Users own document files" policy.

CREATE OR REPLACE FUNCTION public.document_vault_bytes_used()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(file_size_bytes), 0)::bigint
  FROM public.document_files
  WHERE user_id = (SELECT auth.uid());
$$;

COMMENT ON FUNCTION public.document_vault_bytes_used IS
  'Document vault (00153): sums the caller''s stored bytes (RLS-scoped) for the per-user quota check. Returns 0 for an empty vault.';

GRANT EXECUTE ON FUNCTION public.document_vault_bytes_used TO authenticated;
