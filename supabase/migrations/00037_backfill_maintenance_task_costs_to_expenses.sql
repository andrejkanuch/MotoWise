-- Backfill existing maintenance_tasks with cost/parts_cost/labor_cost into expenses table.
-- Uses LEFT(mt.title, 200) to match app-code format (raw title, no prefix) and
-- respect the 200-char CHECK constraint on expenses.description.
-- The ON CONFLICT clause targets the partial unique index on maintenance_task_id
-- (WHERE maintenance_task_id IS NOT NULL AND deleted_at IS NULL).
INSERT INTO public.expenses (user_id, motorcycle_id, amount, category, date, description, maintenance_task_id)
SELECT
  mt.user_id,
  mt.motorcycle_id,
  COALESCE(mt.cost, 0) + COALESCE(mt.parts_cost, 0) + COALESCE(mt.labor_cost, 0),
  'maintenance',
  COALESCE(mt.completed_at::date, mt.created_at::date),
  LEFT(mt.title, 200),
  mt.id
FROM public.maintenance_tasks mt
WHERE mt.deleted_at IS NULL
  AND (COALESCE(mt.cost, 0) + COALESCE(mt.parts_cost, 0) + COALESCE(mt.labor_cost, 0)) > 0
ON CONFLICT (maintenance_task_id) WHERE maintenance_task_id IS NOT NULL AND deleted_at IS NULL DO NOTHING;
