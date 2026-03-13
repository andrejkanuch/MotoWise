-- Fix IDOR: Verify motorcycle ownership on expense INSERT and UPDATE RLS policies.
-- Previously, a user could insert/update an expense referencing another user's motorcycle_id.

-- Fix INSERT policy: ensure motorcycle_id belongs to the authenticated user
DROP POLICY "Users insert own expenses" ON public.expenses;

CREATE POLICY "Users insert own expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND motorcycle_id IN (
      SELECT id FROM public.motorcycles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Fix UPDATE policy: ensure motorcycle_id belongs to the authenticated user
DROP POLICY "Users update own expenses" ON public.expenses;

CREATE POLICY "Users update own expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (
    auth.uid() = user_id
    AND motorcycle_id IN (
      SELECT id FROM public.motorcycles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );
