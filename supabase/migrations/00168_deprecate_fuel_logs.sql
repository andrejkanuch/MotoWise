-- Migration: 00168_deprecate_fuel_logs
-- Receipt-scan epic R9: deprecate the fuel_logs feature end-to-end.
--
-- fuel_logs (00080) + the expenses.fuel_log_id link and auto-expense trigger
-- (00081) are being removed. The feature has zero real-user data; fuel spend is
-- now captured through the ordinary `fuel` expense category and receipt scan.
--
-- ORDER RATIONALE — FK MUST BE DROPPED FIRST (hard requirement):
--   expenses.fuel_log_id carries `ON DELETE CASCADE` (00081). If we dropped the
--   fuel_logs table while that FK still existed and any delete cascaded, linked
--   `fuel` expenses would be destroyed. Dropping the column first removes the FK
--   constraint before the table goes, so existing `fuel` expenses survive
--   untouched. We therefore:
--     1. drop expenses.fuel_log_id (removes the ON DELETE CASCADE FK)
--     2. drop the auto-expense trigger on fuel_logs
--     3. drop the fuel_logs table
--     4. drop the standalone trigger function
--
--   Note: DROP TABLE ... CASCADE would remove the trigger but NOT the standalone
--   create_expense_for_fuel_log() function — it must be dropped explicitly (4).

-- 1. Drop the link column FIRST — this removes the ON DELETE CASCADE FK before
--    the table is dropped, so no `fuel` expense rows can be cascade-deleted.
--    (The unique index idx_expenses_fuel_log_id is dropped with the column.)
ALTER TABLE public.expenses DROP COLUMN IF EXISTS fuel_log_id;

-- 2. Drop the auto-expense trigger on fuel_logs.
DROP TRIGGER IF EXISTS trg_fuel_log_auto_expense ON public.fuel_logs;

-- 3. Drop the fuel_logs table (FK already gone; no expenses are affected).
DROP TABLE IF EXISTS public.fuel_logs;

-- 4. Drop the standalone trigger function (a DROP TABLE CASCADE would not).
DROP FUNCTION IF EXISTS public.create_expense_for_fuel_log();

-- Drop the fuel_logs table/column/function from the API-exposed schema — force
-- PostgREST to reload so it stops advertising the removed relation (matches 00166).
NOTIFY pgrst, 'reload schema';
