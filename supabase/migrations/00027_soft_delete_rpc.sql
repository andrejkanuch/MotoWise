-- Soft-delete motorcycle via RPC (bypasses PostgREST UPDATE + RLS interaction)
-- SECURITY DEFINER runs as table owner, but still checks auth.uid() for ownership
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

-- Same for maintenance tasks (has the same RLS pattern)
CREATE OR REPLACE FUNCTION public.soft_delete_maintenance_task(task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.maintenance_tasks
  SET deleted_at = NOW()
  WHERE id = task_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_maintenance_task(uuid) TO authenticated;
