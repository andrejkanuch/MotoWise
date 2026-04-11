-- Migration: 00083_migration_polish
-- P3-120: Cleanup batch from code review findings.
--
-- 1. expense_photos: drop the FOR ALL policy and replace with SELECT/INSERT/
--    DELETE only — receipts should not be mutable once uploaded.
-- 2. fuel_logs: partial unique index to prevent double-submit duplicates that
--    would produce garbage MPG calculations.
-- 3. fuel_logs.currency: CHECK constraint for ISO-4217 shape.
-- 4. expense_photos.mime_type: CHECK constraint limiting allowed types.

-- 1. expense_photos — no UPDATE policy
DROP POLICY IF EXISTS "Users own expense photos" ON public.expense_photos;

CREATE POLICY "expense_photos_select"
  ON public.expense_photos
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "expense_photos_insert"
  ON public.expense_photos
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND expense_id IN (
      SELECT id FROM public.expenses
      WHERE user_id = (SELECT auth.uid())
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "expense_photos_delete"
  ON public.expense_photos
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- No UPDATE policy -> UPDATE is denied by RLS default

-- 2. fuel_logs duplicate prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_logs_dedup
  ON public.fuel_logs(motorcycle_id, odometer_km, filled_at)
  WHERE deleted_at IS NULL;

-- 3. fuel_logs.currency CHECK
ALTER TABLE public.fuel_logs
  DROP CONSTRAINT IF EXISTS chk_fuel_logs_currency;
ALTER TABLE public.fuel_logs
  ADD CONSTRAINT chk_fuel_logs_currency
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');

-- 4. expense_photos.mime_type CHECK
ALTER TABLE public.expense_photos
  DROP CONSTRAINT IF EXISTS chk_expense_photos_mime_type;
ALTER TABLE public.expense_photos
  ADD CONSTRAINT chk_expense_photos_mime_type
  CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/heic'));
