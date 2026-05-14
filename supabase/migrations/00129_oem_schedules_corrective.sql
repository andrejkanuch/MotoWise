-- Corrective migration for oem_maintenance_schedules after 00128
-- Fixes: orphaned FK refs, missing unique constraint, missing year_to, partial make normalization
-- All steps are idempotent where possible.

BEGIN;

-- ============================================================
-- 1. Re-link orphaned maintenance_tasks (Todo #151)
-- ============================================================
-- Migration 00128 NULLed oem_schedule_id on tasks whose schedule rows were
-- deleted and re-inserted with new UUIDs.  We match orphaned OEM tasks back
-- to the correct new schedule row by joining on:
--   task.title  = schedule.task_name
--   motorcycle.make = schedule.make   (UPPER-normalised)
--   motorcycle.model = schedule.model  (model-specific first, brand-generic fallback)
--
-- We prefer a model-specific match; if none exists the task stays NULL
-- (it will pick up the brand-generic row at query time via the 3-level
-- fallback already in the API layer).

UPDATE public.maintenance_tasks AS mt
SET oem_schedule_id = best.schedule_id
FROM (
  SELECT DISTINCT ON (mt2.id)
    mt2.id AS task_id,
    oms.id AS schedule_id
  FROM public.maintenance_tasks mt2
  JOIN public.motorcycles m ON m.id = mt2.motorcycle_id
  JOIN public.oem_maintenance_schedules oms
    ON  oms.task_name = mt2.title
    AND oms.make      = UPPER(m.make)
    AND (
          -- prefer model-specific match
          oms.model = m.model
          -- fall back to brand-generic (model IS NULL)
       OR oms.model IS NULL
        )
  WHERE mt2.source = 'oem'
    AND mt2.oem_schedule_id IS NULL
  ORDER BY mt2.id,
           -- model-specific first (non-null model wins)
           oms.model NULLS LAST
) best
WHERE mt.id = best.task_id;

-- ============================================================
-- 2. Unique constraint on natural key (Todo #160)
-- ============================================================
-- Prevents duplicate schedule rows for the same make+model+year+task.
-- COALESCE handles the nullable columns so the index stays unique even
-- for brand-generic rows (model IS NULL, year_from IS NULL).

CREATE UNIQUE INDEX IF NOT EXISTS idx_oem_schedules_natural_key
  ON public.oem_maintenance_schedules (make, COALESCE(model, ''), COALESCE(year_from, 0), task_name);

-- ============================================================
-- 3. Set year_to on discontinued models (Todo #159)
-- ============================================================
-- These models have been superseded and should not match motorcycles
-- with a year outside the production range.

UPDATE public.oem_maintenance_schedules
SET year_to = 2018
WHERE make = 'BMW' AND model = 'R 1200 GS' AND year_to IS NULL;

UPDATE public.oem_maintenance_schedules
SET year_to = 2018
WHERE make = 'BMW' AND model = 'F 800 GS' AND year_to IS NULL;

UPDATE public.oem_maintenance_schedules
SET year_to = 2019
WHERE make = 'BMW' AND model = 'F 800 R' AND year_to IS NULL;

UPDATE public.oem_maintenance_schedules
SET year_to = 2015
WHERE make = 'BMW' AND model = 'C 600 Sport' AND year_to IS NULL;

UPDATE public.oem_maintenance_schedules
SET year_to = 2023
WHERE make = 'BMW' AND model = 'R NINE T' AND year_to IS NULL;

-- ============================================================
-- 4. Normalize ALL motorcycles.make to UPPER (Todo #161)
-- ============================================================
-- Migration 00128 only normalised 'Ducati' -> 'DUCATI'.
-- This catches every remaining mixed-case make.

UPDATE public.motorcycles
SET make = UPPER(make)
WHERE make != UPPER(make);

COMMIT;
