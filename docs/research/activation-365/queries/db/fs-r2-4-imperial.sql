BEGIN READ ONLY;

-- FS-R2-4: imperial riders get miles targets from an onboarding OEM import (latent until T07a).
-- Denominator = riders whose users.measurement_system = 'imperial' (NOT motorcycles.mileage_unit, which defaults to 'mi':
-- 7 of 98 metric riders' onboarding bikes are 'mi'). users.measurement_system defaults to 'metric', so 'imperial' is a
-- rider/region choice. After T07a the event form (service_plan_imported.unit) replaces this check (queries/fs/fs-r2-4.sql).
-- A task is "in miles" when target_mileage - the bike's current_mileage = round(interval_km / 1.609) +-1; current_mileage is
-- today's value, so a rider who updated the odometer after onboarding falls in neither column (approximation).
-- Target: 100% of imperial riders' OEM onboarding tasks in miles.
--
-- run 2026-11-13 (onboarding completed in the last 60 d):
--   measurement_system  onboarding_bikes  bikes_unit_mi  bikes_with_oem_interval_tasks  oem_tasks  in_miles  in_km
--   imperial            77                77             4                              36         6         9
--   metric              98                 7             10                             91         0        72
--   Baseline n/a (the onboarding import is not running, FS-PO1H); today 6 of 36 imperial OEM tasks look like miles and 9 like
--   unconverted km, from the manual import path. [V1-db7/db8 used mileage_unit: mi 86 / km 90.]

with u as (
  select u.id, u.onboarding_completed_at, u.measurement_system
  from public.users u
  where u.onboarding_completed_at >= now() - interval '60 days'
    and coalesce(u.is_synthetic, false) = false
    and u.email not ilike 'e2e-%'
    and u.email not ilike 'delivered+mv-e2e-%'
    and u.email not ilike '%@motovault.app'
    and u.email not ilike '%@cloudtestlabaccounts.com'
    and u.email not ilike '%@priorises.com'
    and u.email not ilike '%@test.com'
    and not (u.deleted_at is not null and u.deleted_at::date = '2026-11-10')
), b as (
  select m.id, m.current_mileage, m.mileage_unit, u.measurement_system
  from public.motorcycles m
  join u on u.id = m.user_id
  where m.deleted_at is null
    and m.created_at = u.onboarding_completed_at
), t as (
  select b.id as bike_id, b.measurement_system, k.target_mileage, k.interval_km, b.current_mileage
  from b
  join public.maintenance_tasks k on k.motorcycle_id = b.id
  where k.deleted_at is null and k.source = 'oem' and k.interval_km is not null and k.target_mileage is not null
)
select b.measurement_system,
  count(distinct b.id) as onboarding_bikes,
  count(distinct b.id) filter (where b.mileage_unit = 'mi') as bikes_unit_mi,
  (select count(distinct t.bike_id) from t where t.measurement_system = b.measurement_system) as bikes_with_oem_interval_tasks,
  (select count(*) from t where t.measurement_system = b.measurement_system) as oem_tasks,
  (select count(*) filter (where abs((t.target_mileage - t.current_mileage) - round(t.interval_km / 1.609)) <= 1)
     from t where t.measurement_system = b.measurement_system) as tasks_in_miles,
  (select count(*) filter (where abs((t.target_mileage - t.current_mileage) - t.interval_km) <= 1)
     from t where t.measurement_system = b.measurement_system) as tasks_in_km
from b
group by b.measurement_system;

COMMIT;
