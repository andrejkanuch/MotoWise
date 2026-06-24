-- Expense categories v2: add `accessories`, `taxes_fees`, `other`; add optional `item_name`.
--
-- No backfill needed: no existing category keys are renamed or removed, so no
-- existing row can violate the new CHECK. The added keys map to real-world gaps —
-- accessories (top case / panniers / mounts), taxes_fees (ownership transfer /
-- title / sales tax), and a generic `other` escape hatch.
--
-- Source of truth for these keys: packages/types/src/constants/expense-categories.ts
-- (EXPENSE_CATEGORY_META). Keep this list in sync with that file.

BEGIN;

ALTER TABLE public.expenses DROP CONSTRAINT chk_expenses_category;
ALTER TABLE public.expenses ADD CONSTRAINT chk_expenses_category
  CHECK (category IN (
    'fuel', 'maintenance', 'parts', 'tires', 'gear', 'accessories',
    'modifications', 'insurance', 'registration', 'taxes_fees',
    'tolls', 'parking', 'training', 'other'
  ));

-- Structured product name — the *noun* (what was bought), distinct from the
-- free-text `description` (context/notes). Optional everywhere.
ALTER TABLE public.expenses
  ADD COLUMN item_name text
  CONSTRAINT chk_expenses_item_name_len
  CHECK (item_name IS NULL OR char_length(item_name) <= 120);

COMMIT;

-- Reload PostgREST schema cache so the new column is visible immediately.
NOTIFY pgrst, 'reload schema';
