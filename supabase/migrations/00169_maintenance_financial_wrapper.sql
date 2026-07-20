-- Migration: 00169_maintenance_financial_wrapper
-- Receipt Scan structure redesign (P2, part 1 of 2):
--   docs/plans/receipt-scan-structure-redesign-2026-07-20.md
--
-- Makes the maintenance task the authoritative financial container for a
-- service visit. Adds an explicit paid TOTAL (gross) plus an explicit optional
-- tax breakdown, so tax is no longer silently hidden in the misc `cost` bucket
-- (the pre-redesign save computed cost = total - parts - labor, which stored the
-- VAT as a "misc cost"). parts_cost / labor_cost remain NET as printed.
--
-- ADDITIVE ONLY — all columns nullable with no default (metadata-only, no table
-- rewrite, no meaningful lock). No backfill: reads fall back to
-- (cost + parts_cost + labor_cost) when total_amount IS NULL, so existing rows
-- and the live API/app are unaffected until the P3 read/write code ships.

BEGIN;

ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC;

COMMENT ON COLUMN public.maintenance_tasks.total_amount IS
  'Authoritative gross amount paid for the service visit (source of truth for the linked auto-expense). NULL for legacy rows — read-time fallback = cost + parts_cost + labor_cost.';
COMMENT ON COLUMN public.maintenance_tasks.tax_amount IS
  'Explicit tax/VAT/IVA on the visit when the receipt prints one; NULL when absent. parts_cost/labor_cost are NET, so parts + labor + tax ~= total_amount when it reconciles.';
COMMENT ON COLUMN public.maintenance_tasks.tax_rate IS
  'Optional printed tax rate as a percentage (e.g. 21 for 21% IVA); NULL when not legible/applicable.';

COMMIT;

NOTIFY pgrst, 'reload schema';
