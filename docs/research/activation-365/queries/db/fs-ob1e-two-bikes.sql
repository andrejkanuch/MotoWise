BEGIN READ ONLY;

-- FS-OB1e DB cross-check: accounts with two bikes created <= 2 min apart (a rider who redid onboarding creates a second
-- bike). Source: V1-db6. Target: 0 on the fix level (read by bike creation date).
--
-- run 2026-11-13 (first bike created in the last 60 d): 2 accounts [V1-db6: 2].

with u as (
  select u.id
  from public.users u
  where true
    and coalesce(u.is_synthetic, false) = false
    and u.email not ilike 'e2e-%'
    and u.email not ilike 'delivered+mv-e2e-%'
    and u.email not ilike '%@motovault.app'
    and u.email not ilike '%@cloudtestlabaccounts.com'
    and u.email not ilike '%@priorises.com'
    and u.email not ilike '%@test.com'
    and not (u.deleted_at is not null and u.deleted_at::date = '2026-11-10')
)
select count(distinct m1.user_id) as accounts_two_bikes_2min
from public.motorcycles m1
join public.motorcycles m2
  on m2.user_id = m1.user_id and m2.id <> m1.id
 and m2.created_at > m1.created_at and m2.created_at <= m1.created_at + interval '2 minutes'
join u on u.id = m1.user_id
where m1.created_at >= now() - interval '60 days';

COMMIT;
