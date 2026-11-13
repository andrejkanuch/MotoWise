BEGIN READ ONLY;

-- S4(a) / FS-PO1H board metric: first live bike created within 1 day of sign-up with a maintenance task created
-- within 1 day of the bike, per week, in two columns: any task source, and source = 'oem' only. T07 is judged on the
-- oem column (rider-created `user` tasks alone can lift the any-source column, V1 item 11).
-- Source: board/99-synthesis.md Appendix A (q99-day0-schedule-weekly) + the oem column of validation/V1-metrics.md §3.8.
-- Target: oem column >= 55% for 4 straight weeks.
--
-- run 2026-11-13 (sign-ups from 2026-08-10; weeks by bike creation, Monday start):
--   week   bikes  tasks_d0_any  tasks_d0_oem  blank_model
--   08-10   24    16            15             0
--   08-17   24    13            13             0
--   08-24   12    11            10             0
--   08-31   30    19            19             0
--   09-07   26    14            14             0
--   09-14   28    21            20             0
--   09-21   27    17            16             0
--   09-28   15     8             7             0
--   10-05   32    18            17             0
--   10-12   25     6             3             9
--   10-19   23     7             5             9
--   10-26   22     5             4            10
--   11-02   41     7             3            15
--   11-09   31    14             5             8   (partial week, to 2026-11-13)
--   Weeks 10-12..11-02: any 25/111 (22.5%) = the V1-db2 / board/99 baseline exactly; oem 15/111 (13.5%).
--   Pre-drop 08-10..10-05: any 137/218 (62.8%), oem 131/218 (60.1%) (board/99 127/204 starts at 08-14).
--   Partial week 11-09: any 14/31, oem 5/31 (rider-created tasks lift the any column, as V1-db3 found).

with u as (
  select u.id, u.created_at
  from public.users u
  where u.created_at >= '2026-08-10'
    and coalesce(u.is_synthetic, false) = false
    and u.email not ilike 'e2e-%'
    and u.email not ilike 'delivered+mv-e2e-%'
    and u.email not ilike '%@motovault.app'
    and u.email not ilike '%@cloudtestlabaccounts.com'
    and u.email not ilike '%@priorises.com'
    and u.email not ilike '%@test.com'
    and not (u.deleted_at is not null and u.deleted_at::date = '2026-11-10')
), b as (  -- first live bike created within 1 day of sign-up
  select distinct on (m.user_id) m.id, m.user_id, m.created_at, m.model
  from public.motorcycles m
  join u on u.id = m.user_id
  where m.deleted_at is null
    and m.created_at < u.created_at + interval '1 day'
  order by m.user_id, m.created_at
)
select to_char(date_trunc('week', b.created_at), 'YYYY-MM-DD') as wk,
  count(*) as bikes,
  count(*) filter (where exists (
    select 1 from public.maintenance_tasks t
    where t.motorcycle_id = b.id and t.deleted_at is null
      and t.created_at < b.created_at + interval '1 day')) as with_tasks_d0_any,
  count(*) filter (where exists (
    select 1 from public.maintenance_tasks t
    where t.motorcycle_id = b.id and t.deleted_at is null and t.source = 'oem'
      and t.created_at < b.created_at + interval '1 day')) as with_oem_tasks_d0,
  count(*) filter (where coalesce(trim(b.model), '') = '') as blank_model
from b
group by 1
order by 1;

COMMIT;
