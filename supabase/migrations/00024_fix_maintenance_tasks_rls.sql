-- Fix RLS policy on maintenance_tasks
-- The old FOR ALL policy with `deleted_at IS NULL` in USING blocks soft-delete
-- because PostgreSQL checks USING as WITH CHECK against the NEW row values too.

DROP POLICY IF EXISTS "Users own maintenance tasks" ON public.maintenance_tasks;

-- SELECT: users can only read their own non-deleted tasks
CREATE POLICY "Users read own maintenance tasks" ON public.maintenance_tasks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- INSERT: users can create tasks for themselves
CREATE POLICY "Users insert own maintenance tasks" ON public.maintenance_tasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can update their own tasks (including soft-delete)
-- USING checks OLD row (must be owned + not already deleted)
-- WITH CHECK allows the new row to have any deleted_at value
CREATE POLICY "Users update own maintenance tasks" ON public.maintenance_tasks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can hard-delete their own tasks (if ever needed)
CREATE POLICY "Users delete own maintenance tasks" ON public.maintenance_tasks
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
