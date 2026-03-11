-- Fix RLS policy on motorcycles (same issue as maintenance_tasks in 00024)
-- FOR ALL with `deleted_at IS NULL` in USING blocks soft-delete
-- because PostgreSQL checks USING as WITH CHECK against the NEW row values.

DROP POLICY IF EXISTS "Users own motorcycles" ON public.motorcycles;

-- SELECT: users can only read their own non-deleted motorcycles
CREATE POLICY "Users read own motorcycles" ON public.motorcycles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- INSERT: users can create motorcycles for themselves
CREATE POLICY "Users insert own motorcycles" ON public.motorcycles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can update their own motorcycles (including soft-delete)
CREATE POLICY "Users update own motorcycles" ON public.motorcycles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can hard-delete their own motorcycles (if ever needed)
CREATE POLICY "Users delete own motorcycles" ON public.motorcycles
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
