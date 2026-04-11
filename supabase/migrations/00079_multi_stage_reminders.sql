-- Migration: 00079_multi_stage_reminders
-- MOT-139: Multi-Stage Maintenance Reminders (30d / 7d / 1d).
--
-- Defaults preserve the existing single-stage (1-day) behaviour so users
-- who never touch reminder settings see no change.

ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS remind_30d BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS remind_7d  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS remind_1d  BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.maintenance_tasks.remind_30d IS 'MOT-139: fire a reminder 30 days before due_date (for part ordering lead time).';
COMMENT ON COLUMN public.maintenance_tasks.remind_7d  IS 'MOT-139: fire a reminder 7 days before due_date (for shop appointment booking).';
COMMENT ON COLUMN public.maintenance_tasks.remind_1d  IS 'MOT-139: fire a reminder 1 day before due_date (legacy behaviour, on by default).';
