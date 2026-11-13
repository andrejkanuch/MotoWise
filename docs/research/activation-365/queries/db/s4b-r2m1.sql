BEGIN READ ONLY;

-- S4(b) / FS-PO1H (R2-M1): onboarding-created live bikes (motorcycles.created_at = users.onboarding_completed_at) with an
-- OEM task (maintenance_tasks.source = 'oem') created within 5 min of the bike, per week. Consent-independent.
-- Source: deep-dives/R2-bike-limit-and-schedule.md:91-97 (R2-M1 definition) with the q08 exclusions; V1-db4.
-- Target: >= 95% for 2 straight weeks after the T07a deploy (read by deploy date).
--
-- run 2026-11-13 (bikes from 2026-09-28):
--   week   onboarding_bikes  with_oem_5min  blank_model
--   09-28   10                1              0
--   10-05   15                1              0
--   10-12   21                1              8
--   10-19   20                2             10
--   10-26   21                2             10
--   11-02   42                2             15
--   11-09   28                1              8   (partial week)
--   Total 10/157 (6.4%) [R2-M1 10/151 (7%); V1-db4 10/155]: matches.

with u as (
  select u.id, u.onboarding_completed_at
  from public.users u
  where u.onboarding_completed_at is not null
    and coalesce(u.is_synthetic, false) = false
    and u.email not ilike 'e2e-%'
    and u.email not ilike 'delivered+mv-e2e-%'
    and u.email not ilike '%@motovault.app'
    and u.email not ilike '%@cloudtestlabaccounts.com'
    and u.email not ilike '%@priorises.com'
    and u.email not ilike '%@test.com'
    and not (u.deleted_at is not null and u.deleted_at::date = '2026-11-10')
), b as (
  select m.id, m.created_at, m.model
  from public.motorcycles m
  join u on u.id = m.user_id
  where m.deleted_at is null
    and m.created_at = u.onboarding_completed_at
    and m.created_at >= '2026-09-28'
)
select to_char(date_trunc('week', b.created_at), 'YYYY-MM-DD') as wk,
  count(*) as onboarding_bikes,
  count(*) filter (where exists (
    select 1 from public.maintenance_tasks t
    where t.motorcycle_id = b.id and t.deleted_at is null and t.source = 'oem'
      and t.created_at < b.created_at + interval '5 minutes')) as with_oem_5min,
  count(*) filter (where coalesce(trim(b.model), '') = '') as blank_model
from b
group by 1
order by 1;

COMMIT;
