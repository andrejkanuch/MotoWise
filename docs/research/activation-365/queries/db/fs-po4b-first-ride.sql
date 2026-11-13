BEGIN READ ONLY;

-- FS-PO4b DB share: sign-ups whose FIRST ride is live and below the floor. Null distance counts as sub-floor
-- (coalesce(distance_m, 0) < 50, V1 §3.8), and is also reported separately. Source: R4 S-R4-01 re-run (V1-db9).
-- Target: < 5% of sign-ups-with-a-ride for sign-ups after the T09 release (read by sign-up date).
--
-- run 2026-11-13 (sign-ups in the last 60 d):
--   signups 361, riders_with_a_ride 69, first ride live sub-floor incl. null 40 (26 with distance < 50 m + 14 null),
--   live real (>= 50 m) 16, first ride deleted 13, live not completed 0.
--   [V1-db9: 360 sign-ups, 71 with a ride, 26 live < 50 m, 15 live null, 13 deleted.] Share live sub-floor 40/69 (58%).

with u as (
  select u.id, u.created_at
  from public.users u
  where u.created_at >= now() - interval '60 days'
    and coalesce(u.is_synthetic, false) = false
    and u.email not ilike 'e2e-%'
    and u.email not ilike 'delivered+mv-e2e-%'
    and u.email not ilike '%@motovault.app'
    and u.email not ilike '%@cloudtestlabaccounts.com'
    and u.email not ilike '%@priorises.com'
    and u.email not ilike '%@test.com'
    and not (u.deleted_at is not null and u.deleted_at::date = '2026-11-10')
), f as (  -- each rider's first ride, deleted or not
  select distinct on (r.user_id) r.user_id, r.status, r.distance_m, r.deleted_at
  from public.rides r
  join u on u.id = r.user_id
  order by r.user_id, r.started_at
)
select (select count(*) from u) as signups,
  count(*) as riders_with_a_ride,
  count(*) filter (where f.deleted_at is null and f.status = 'completed' and coalesce(f.distance_m, 0) < 50) as first_ride_live_subfloor_incl_null,
  count(*) filter (where f.deleted_at is null and f.status = 'completed' and f.distance_m is null) as first_ride_live_null_distance,
  count(*) filter (where f.deleted_at is null and f.status = 'completed' and f.distance_m >= 50) as first_ride_live_real,
  count(*) filter (where f.deleted_at is not null) as first_ride_deleted,
  count(*) filter (where f.deleted_at is null and f.status <> 'completed') as first_ride_live_not_completed
from f;

COMMIT;
