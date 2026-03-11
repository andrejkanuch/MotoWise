-- Temporary debug function to check auth.uid() from client
CREATE OR REPLACE FUNCTION public.auth_uid_check()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.auth_uid_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_uid_check() TO anon;

-- Soft-delete motorcycle via RPC (bypasses PostgREST UPDATE + RLS interaction issue)
-- Still enforces ownership check via auth.uid()
CREATE OR REPLACE FUNCTION public.soft_delete_motorcycle(motorcycle_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.motorcycles
  SET deleted_at = NOW()
  WHERE id = motorcycle_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_motorcycle(uuid) TO authenticated;
