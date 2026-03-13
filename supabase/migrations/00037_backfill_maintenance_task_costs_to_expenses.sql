-- Backfill existing maintenance_tasks with cost/parts_cost/labor_cost into expenses table
INSERT INTO public.expenses (user_id, motorcycle_id, amount, category, date, description, maintenance_task_id)
SELECT
  mt.user_id,
  mt.motorcycle_id,
  COALESCE(mt.cost, 0) + COALESCE(mt.parts_cost, 0) + COALESCE(mt.labor_cost, 0),
  'maintenance',
  COALESCE(mt.completed_at::date, mt.created_at::date),
  'From: ' || mt.title,
  mt.id
FROM public.maintenance_tasks mt
WHERE mt.deleted_at IS NULL
  AND (COALESCE(mt.cost, 0) + COALESCE(mt.parts_cost, 0) + COALESCE(mt.labor_cost, 0)) > 0
ON CONFLICT DO NOTHING;
