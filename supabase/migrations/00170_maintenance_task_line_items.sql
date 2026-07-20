-- Migration: 00170_maintenance_task_line_items
-- Receipt Scan structure redesign (P2, part 2 of 2):
--   docs/plans/receipt-scan-structure-redesign-2026-07-20.md
--
-- Structured per-operation line items for a maintenance task (Option B). A
-- scanned service invoice becomes ONE completed task (the visit) with N typed
-- line items, so per-service-type history/reminders join on `service_type`
-- rather than fuzzy strings.
--
-- Brand-new table, inert until the P3 write/read path ships — cannot affect any
-- existing behavior. RLS: own-user CRUD. `service_type` CHECK mirrors the
-- canonical MaintenanceServiceType taxonomy in
-- packages/types/src/constants/enums.ts (the unavoidable SQL/TS duplication —
-- keep in sync, same as the source/content_type CHECKs).
--
-- Modeled on 00076_expense_photos.sql (own-user photo-table + RLS shape) and
-- 00166_receipt_scans_metering.sql (conventions).

BEGIN;

CREATE TABLE public.maintenance_task_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Canonical service classification (packages/types MaintenanceServiceType).
  service_type TEXT NOT NULL
    CHECK (service_type IN (
      'oil_change', 'oil_filter', 'brake_fluid', 'transmission_oil', 'final_drive',
      'coolant', 'valve_clearance', 'air_filter', 'spark_plug', 'fork_oil',
      'chain', 'tire', 'brake_pads', 'belt', 'battery', 'general_service', 'other'
    )),
  -- Printed line text (e.g. "FILTRO DE ACEITE MOTOR Y CAMBIO DCT").
  label TEXT NOT NULL,
  -- Optional itemization detail (part number, quantity, per-unit + line totals).
  part_ref TEXT,
  quantity NUMERIC,
  unit_price NUMERIC,
  line_total NUMERIC,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backs the per-task resolve (DataLoader batches by task_id).
CREATE INDEX idx_mtli_task ON public.maintenance_task_line_items (task_id);
-- Backs own-user reads + future per-type history queries.
CREATE INDEX idx_mtli_user_type ON public.maintenance_task_line_items (user_id, service_type);

ALTER TABLE public.maintenance_task_line_items ENABLE ROW LEVEL SECURITY;

-- Own-user CRUD. Writes are API-mediated (user client under RLS, or the
-- service-role client which bypasses RLS); these policies gate the user-client
-- path to the caller's own rows. task_id integrity (the referenced task is the
-- caller's) is enforced by the API, mirroring expense_photos.
CREATE POLICY "Users read own task line items" ON public.maintenance_task_line_items
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users insert own task line items" ON public.maintenance_task_line_items
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users update own task line items" ON public.maintenance_task_line_items
  FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users delete own task line items" ON public.maintenance_task_line_items
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.maintenance_task_line_items IS
  'Structured per-operation line items for a maintenance task (receipt-scan structure redesign). service_type mirrors the canonical MaintenanceServiceType taxonomy. RLS: own-user CRUD.';

COMMIT;

NOTIFY pgrst, 'reload schema';
