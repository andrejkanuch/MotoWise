-- Protect email and created_at from user modification
-- Extends the existing role escalation fix from migration 00004
DROP POLICY IF EXISTS "Users update own data" ON public.users;
CREATE POLICY "Users update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND email = (SELECT email FROM public.users WHERE id = auth.uid())
  );
