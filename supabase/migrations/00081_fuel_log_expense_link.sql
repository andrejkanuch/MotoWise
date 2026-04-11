-- Migration: 00081_fuel_log_expense_link
-- P1-105: Atomic fuel_log → expense creation via trigger + FK for cascade.
--
-- Problem: FuelLogsService previously inserted into fuel_logs, then separately
-- into expenses, with no transaction. Failure of the second insert produced
-- orphan fuel logs. Currency was hardcoded to 'USD', breaking non-USD users.
-- Deleting a fuel log did not delete its expense.
--
-- Fix: single trigger runs in the same transaction as the fuel_logs insert.
-- expenses.fuel_log_id FK cascades on delete. User currency is looked up
-- correctly from the users table.

-- 1. Link column + unique index (mirrors maintenance_task_id pattern)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS fuel_log_id UUID REFERENCES public.fuel_logs(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_fuel_log_id
  ON public.expenses(fuel_log_id)
  WHERE fuel_log_id IS NOT NULL AND deleted_at IS NULL;

-- 2. Trigger function
CREATE OR REPLACE FUNCTION public.create_expense_for_fuel_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_currency TEXT;
  expense_description TEXT;
BEGIN
  -- Skip if no cost to record
  IF NEW.total_cost IS NULL OR NEW.total_cost <= 0 THEN
    RETURN NEW;
  END IF;

  -- Look up the user's preferred currency; fall back to the fuel_log currency
  -- or USD as a last resort.
  SELECT currency INTO user_currency FROM public.users WHERE id = NEW.user_id;
  user_currency := COALESCE(user_currency, NEW.currency, 'USD');

  expense_description := COALESCE(
    NEW.notes,
    NEW.fuel_litres::text || 'L ' || COALESCE(NEW.fuel_type, 'regular') || ' fill-up'
  );

  INSERT INTO public.expenses (
    user_id,
    motorcycle_id,
    amount,
    category,
    date,
    description,
    currency,
    fuel_log_id
  ) VALUES (
    NEW.user_id,
    NEW.motorcycle_id,
    NEW.total_cost,
    'fuel',
    (NEW.filled_at)::date,
    expense_description,
    user_currency,
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_fuel_log_auto_expense ON public.fuel_logs;
CREATE TRIGGER trg_fuel_log_auto_expense
  AFTER INSERT ON public.fuel_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_expense_for_fuel_log();

COMMENT ON FUNCTION public.create_expense_for_fuel_log() IS
  'MOT-137 / P1-105: Atomically creates a fuel-category expense for each new fuel_log row, using the owner users.currency.';
