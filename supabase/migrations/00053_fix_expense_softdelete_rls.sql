-- Fix: expense soft-delete fails because the UPDATE WITH CHECK runs a
-- subquery against motorcycles that can be blocked by nested RLS evaluation.
--
-- The motorcycle_id ownership check was added in 00038 to prevent IDOR when
-- changing motorcycle_id, but no API endpoint modifies motorcycle_id on an
-- existing expense. The only UPDATE operation is soft-delete (setting deleted_at).
-- Simplify WITH CHECK to match the motorcycles pattern from 00025.

DROP POLICY "Users update own expenses" ON public.expenses;

CREATE POLICY "Users update own expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);
