-- Migration: Fix RLS privilege escalation on public.users
-- Prevents users from changing their own role via UPDATE.
-- The WITH CHECK clause ensures the role column remains unchanged
-- by comparing it against the current value in the database.

DROP POLICY IF EXISTS "Users update own data" ON public.users;
CREATE POLICY "Users update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (role = (SELECT role FROM public.users WHERE id = auth.uid()));
