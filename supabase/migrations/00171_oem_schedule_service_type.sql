-- 00171 — Normalize the OEM maintenance catalog onto the canonical
-- MaintenanceServiceType taxonomy (receipt-scan structure redesign, P7).
--
-- Adds `oem_maintenance_schedules.service_type` so per-type history and
-- reminders can join on a stable type instead of the free-text `task_name`
-- (45 distinct names, heavy synonymy). The backfill below is the DETERMINISTIC
-- OUTPUT of `classifyServiceType` (packages/types) applied to the 45 distinct
-- names — the classifier is the single source of truth; these UPDATEs are its
-- generated projection (regenerate them if the classifier changes). Names that
-- classify to OTHER (and any future/unmapped names) fall through to the
-- catch-all → 'other'. Verified 40/42 distinct names (≈99.8% of the 1,028 rows)
-- map to a non-OTHER type.

alter table oem_maintenance_schedules add column if not exists service_type text;

-- Classifier-generated backfill (classifyServiceType projection).
update oem_maintenance_schedules set service_type = 'brake_fluid' where lower(task_name) = any (array['brake fluid', 'brake fluid replacement']);
update oem_maintenance_schedules set service_type = 'tire' where lower(task_name) = any (array['tire pressure check']);
update oem_maintenance_schedules set service_type = 'fork_oil' where lower(task_name) = any (array['fork oil']);
update oem_maintenance_schedules set service_type = 'brake_pads' where lower(task_name) = any (array['brake pads inspection']);
update oem_maintenance_schedules set service_type = 'oil_change' where lower(task_name) = any (array['oil & filter change', 'engine oil change', 'oil change', 'engine oil']);
update oem_maintenance_schedules set service_type = 'air_filter' where lower(task_name) = any (array['air filter', 'air cleaner', 'air filter replacement', 'air cleaner element']);
update oem_maintenance_schedules set service_type = 'valve_clearance' where lower(task_name) = any (array['valve clearance', 'valve clearance (desmo)', 'valve clearance inspection', 'cam chain tensioner inspection']);
update oem_maintenance_schedules set service_type = 'spark_plug' where lower(task_name) = any (array['spark plugs', 'spark plug', 'spark plug replacement']);
update oem_maintenance_schedules set service_type = 'coolant' where lower(task_name) = any (array['coolant', 'radiator coolant', 'coolant change']);
update oem_maintenance_schedules set service_type = 'chain' where lower(task_name) = any (array['chain clean & lube', 'drive chain clean, lube & slack check', 'drive chain']);
update oem_maintenance_schedules set service_type = 'final_drive' where lower(task_name) = any (array['final drive oil']);
update oem_maintenance_schedules set service_type = 'belt' where lower(task_name) = any (array['drive belt inspection', 'cvt belt inspection', 'belt inspection', 'timing belt', 'cvt belt']);
update oem_maintenance_schedules set service_type = 'transmission_oil' where lower(task_name) = any (array['primary chaincase lubricant', 'transmission lubricant', 'primary oil', 'primary & transmission fluid']);
update oem_maintenance_schedules set service_type = 'oil_filter' where lower(task_name) = any (array['oil filter replacement', 'clutch oil filter', 'engine oil filter']);
update oem_maintenance_schedules set service_type = 'battery' where lower(task_name) = any (array['battery health check']);

-- Everything not classified above (OTHER-mapped + future names) → 'other'.
update oem_maintenance_schedules set service_type = 'other' where service_type is null;

alter table oem_maintenance_schedules alter column service_type set not null;

-- Constrain to the canonical MaintenanceServiceType set (mirrors the
-- maintenance_task_line_items.service_type CHECK in 00170).
alter table oem_maintenance_schedules
  add constraint oem_maintenance_schedules_service_type_check
  check (service_type in (
    'oil_change', 'oil_filter', 'brake_fluid', 'transmission_oil', 'final_drive',
    'coolant', 'valve_clearance', 'air_filter', 'spark_plug', 'fork_oil', 'chain',
    'tire', 'brake_pads', 'belt', 'battery', 'general_service', 'other'
  ));

create index if not exists idx_oem_maintenance_schedules_service_type
  on oem_maintenance_schedules (service_type);
