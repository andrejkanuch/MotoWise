-- Migration: 00172_line_items_task_ownership_rls
-- Receipt Scan structure redesign — RLS hardening (defense-in-depth).
--
-- 00170 gated maintenance_task_line_items to the caller's own rows via a
-- user_id-only WITH CHECK, deferring task_id integrity to the API layer (mirror
-- of expense_photos). A user with direct Supabase-client access could still
-- insert/update a row with their own user_id but ANOTHER user's task_id.
--
-- The API write path is already safe (line items are attached to a task the
-- service just created for the caller), so this changes no application behavior.
-- It closes the direct-client hole at the security boundary: the referenced task
-- must belong to the authenticated user.

BEGIN;

DROP POLICY "Users insert own task line items" ON public.maintenance_task_line_items;
CREATE POLICY "Users insert own task line items" ON public.maintenance_task_line_items
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.maintenance_tasks t
      WHERE t.id = task_id AND t.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY "Users update own task line items" ON public.maintenance_task_line_items;
CREATE POLICY "Users update own task line items" ON public.maintenance_task_line_items
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.maintenance_tasks t
      WHERE t.id = task_id AND t.user_id = (SELECT auth.uid())
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
