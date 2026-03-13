-- Optimize expenses indexes: add composite index matching primary query pattern,
-- drop redundant single-column indexes

-- Add composite partial index matching findByMotorcycle query
CREATE INDEX idx_expenses_user_motorcycle_date
  ON public.expenses (user_id, motorcycle_id, date DESC)
  WHERE deleted_at IS NULL;

-- Drop redundant single-column indexes (covered by composite index)
DROP INDEX idx_expenses_user_id;
DROP INDEX idx_expenses_motorcycle_id;

-- Drop low-selectivity index (only 4 possible values)
DROP INDEX idx_expenses_category;
