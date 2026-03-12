-- Migration: 00030_create_expenses_table
-- Purpose: Create expenses table for motorcycle expense tracking

-- ==========================================
-- 1. CREATE EXPENSES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0 AND amount <= 99999.99),
  category TEXT NOT NULL CHECK (category IN ('fuel', 'maintenance', 'parts', 'gear')),
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ==========================================
-- 2. INDEXES
-- ==========================================
CREATE INDEX idx_expenses_user_motorcycle_date
  ON public.expenses (user_id, motorcycle_id, date DESC);

CREATE INDEX idx_expenses_user_deleted
  ON public.expenses (user_id, deleted_at);

-- ==========================================
-- 3. AUTO-UPDATE updated_at TRIGGER
-- ==========================================
CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- 4. ROW-LEVEL SECURITY
-- ==========================================
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin read all expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ==========================================
-- 5. SOFT DELETE RPC
-- ==========================================
CREATE OR REPLACE FUNCTION public.soft_delete_expense(expense_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INT;
BEGIN
  UPDATE public.expenses
  SET deleted_at = now()
  WHERE id = expense_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;
