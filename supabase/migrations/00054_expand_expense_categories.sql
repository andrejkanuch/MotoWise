-- Expand expense categories from 4 to 11
ALTER TABLE public.expenses DROP CONSTRAINT expenses_category_check;
ALTER TABLE public.expenses ADD CONSTRAINT chk_expenses_category
  CHECK (category IN (
    'fuel', 'maintenance', 'parts', 'gear',
    'tires', 'insurance', 'registration', 'tolls',
    'parking', 'modifications', 'training'
  ));
