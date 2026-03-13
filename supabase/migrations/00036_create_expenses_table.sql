-- MOT: Create expenses table for expense tracking feature

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0 AND amount <= 99999.99),
  category TEXT NOT NULL CHECK (category IN ('fuel', 'maintenance', 'parts', 'gear')),
  date DATE NOT NULL,
  description TEXT CHECK (char_length(description) <= 200),
  maintenance_task_id UUID REFERENCES public.maintenance_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users read own expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users insert own expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own expenses" ON public.expenses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Admins read all expenses" ON public.expenses
  FOR SELECT USING (public.is_admin());

-- Indexes
CREATE INDEX idx_expenses_user_id ON public.expenses (user_id);
CREATE INDEX idx_expenses_motorcycle_id ON public.expenses (motorcycle_id);
CREATE INDEX idx_expenses_date ON public.expenses (date);
CREATE INDEX idx_expenses_category ON public.expenses (category);

-- Prevent duplicate auto-expenses from task completion race conditions
CREATE UNIQUE INDEX idx_expenses_maintenance_task_id_unique
  ON public.expenses (maintenance_task_id)
  WHERE maintenance_task_id IS NOT NULL AND deleted_at IS NULL;

-- Updated at trigger (uses existing function from earlier migrations)
CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
