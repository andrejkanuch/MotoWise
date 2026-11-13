BEGIN READ ONLY;

-- FS-R2-5: live onboarding bikes whose make has fewer than 3 letters (no known-make table exists; T37 closed).
-- Source: validation/V1-metrics.md §3.8. After T05e the event form onboarding_bike_created.make_valid replaces it.
-- Target: 0 new after T25b.
--
-- run 2026-11-13: last 60 d 6/175 live onboarding bikes; all time 10/366 [V1-db6: 6/176, 10/373].

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
)
select
  count(*) filter (where m.created_at >= now() - interval '60 days') as onboarding_bikes_60d,
  count(*) filter (where m.created_at >= now() - interval '60 days'
                   and length(regexp_replace(coalesce(m.make, ''), '[^A-Za-z]', '', 'g')) < 3) as short_make_60d,
  count(*) as onboarding_bikes_all_time,
  count(*) filter (where length(regexp_replace(coalesce(m.make, ''), '[^A-Za-z]', '', 'g')) < 3) as short_make_all_time
from public.motorcycles m
join u on u.id = m.user_id
where m.created_at = u.onboarding_completed_at
  and m.deleted_at is null;

COMMIT;
