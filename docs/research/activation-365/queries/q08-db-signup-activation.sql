with u as (
  select id, created_at from public.users
  where created_at >= '2026-08-14' and created_at < '2026-11-05'
    and coalesce(is_synthetic,false) = false
    and email not in ('<redacted-email>','<redacted-email>','<redacted-email>','<redacted-email>','<redacted-email>','<redacted-email>','<redacted-email>')
    and email not ilike '%@priorises.com' and email not ilike '%@motovault.app' and email not ilike '%cloudtestlabaccounts.com'
),
a as (
  select u.id, u.created_at,
    (select min(r.created_at) from rides r where r.user_id=u.id and r.deleted_at is null and coalesce(r.distance_m,0) >= 500) as t_ride,
    (select min(e.created_at) from expenses e where e.user_id=u.id and e.deleted_at is null) as t_exp,
    (select min(m.completed_at) from maintenance_tasks m where m.user_id=u.id and m.deleted_at is null and m.completed_at is not null) as t_mnt_done,
    (select min(m.created_at) from maintenance_tasks m where m.user_id=u.id and m.deleted_at is null) as t_mnt_created,
    (select count(*) from motorcycles b where b.user_id=u.id and b.deleted_at is null) as bikes,
    exists(select 1 from device_push_tokens d where d.user_id=u.id) as has_push_token,
    (select count(distinct x.d) from (
        select created_at::date d from rides where user_id=u.id and deleted_at is null and coalesce(distance_m,0)>=500
        union select created_at::date from expenses where user_id=u.id and deleted_at is null
        union select completed_at::date from maintenance_tasks where user_id=u.id and completed_at is not null) x
      where x.d > u.created_at::date) as later_action_days
  from u)
select count(*) as signups,
  count(*) filter (where bikes>0) as with_bike,
  count(*) filter (where t_ride < created_at + interval '7 days') as ride_w1,
  count(*) filter (where t_exp < created_at + interval '7 days') as exp_w1,
  count(*) filter (where t_mnt_done < created_at + interval '7 days') as mnt_done_w1,
  count(*) filter (where t_mnt_created < created_at + interval '1 day') as mnt_task_created_d0,
  count(*) filter (where t_ride < created_at + interval '7 days' or t_exp < created_at + interval '7 days' or t_mnt_done < created_at + interval '7 days') as any_core_w1,
  count(*) filter (where t_ride is not null or t_exp is not null or t_mnt_done is not null) as any_core_ever,
  count(*) filter (where later_action_days > 0) as core_on_a_later_day,
  count(*) filter (where has_push_token) as with_push_token
from a
