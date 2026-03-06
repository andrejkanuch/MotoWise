-- Restrict quiz access to authenticated users only
-- Previously USING (true) allowed unauthenticated PostgREST access to questions_json
-- which contains correctIndex values (quiz answers)
DROP POLICY IF EXISTS "Anyone reads quizzes" ON public.quizzes;
CREATE POLICY "Authenticated users read quizzes" ON public.quizzes
  FOR SELECT USING (auth.uid() IS NOT NULL);
