# T06 (#410) research queries

The SQL behind `research/t06-findings.md`. All reads are read-only. Re-run on 2026-11-13 for the PR review: every query below
reproduced the numbers in the findings doc (the PostHog ones with the project filter only, see `{EXCL}`).

Placeholders:
- `{EXCL}` = `person_id NOT IN (<excluded test/synthetic person ids>)`. Build the list with the recipe in
  [`q00-excluded-persons.md`](q00-excluded-persons.md), re-derived on the day you run the query. The ids stay outside the repo.
  Without the list (project filter only, `coalesce(toString(person.properties.internal), '') != 'true'`), each version row can be
  1 to 2 persons higher: on 2026-11-13, q1a gave 296 completers / 12 / 5 instead of 292 / 11 / 4 (one test person on 3.22.3, one on 3.26.0).
- `{RN}` = `properties.$lib = 'posthog-react-native'`.
- `{SCANNED}` = the 107 `session_id`s of Replay Vision scanner A (`01a1cfa6-4f63-7b8b-bd0c-9dbd6bace7a1`), listed with
  `vision-scanners-observations-list {"scanner_id": "01a1cfa6-4f63-7b8b-bd0c-9dbd6bace7a1", "limit": 200}` and pasted as a quoted,
  comma-separated list. Session ids are not personal data; they are left out here only for length.

PostHog: project 155556 (EU), `execute-sql`. Supabase: production, `SELECT` only (Supabase MCP `execute_sql` or the Management API).

## q1a — FS-PO12 per completer, with and without the cold-start `/(auth)` flash (item 1)

The V1 §3.5 predicate, plus a second count that drops a `/(auth)` `$screen` followed by a `/(tabs)` `$screen` within 3 s.

```sql
SELECT ver, count() AS completers,
  countIf(arrayExists(x -> tupleElement(x, 1) >= t0 + INTERVAL 5 SECOND AND tupleElement(x, 1) < t0 + INTERVAL 1 HOUR
    AND (tupleElement(x, 2) = 'user_signed_in' OR (tupleElement(x, 2) = '$screen'
      AND (tupleElement(x, 3) ILIKE '%sign-in%' OR tupleElement(x, 3) LIKE '/(auth)%'))), ev)) AS po12_v1,
  countIf(arrayExists(x -> tupleElement(x, 1) >= t0 + INTERVAL 5 SECOND AND tupleElement(x, 1) < t0 + INTERVAL 1 HOUR
    AND (tupleElement(x, 2) = 'user_signed_in' OR (tupleElement(x, 2) = '$screen'
      AND (tupleElement(x, 3) ILIKE '%sign-in%' OR tupleElement(x, 3) LIKE '/(auth)%')))
    -- the cold-start flash: /(auth) then /(tabs) within 3 s
    AND NOT (tupleElement(x, 3) LIKE '/(auth)%' AND arrayExists(y -> tupleElement(y, 2) = '$screen'
      AND tupleElement(y, 3) LIKE '/(tabs)%' AND tupleElement(y, 1) > tupleElement(x, 1)
      AND tupleElement(y, 1) <= tupleElement(x, 1) + INTERVAL 3 SECOND, ev)), ev)) AS po12_no_flash
FROM (
  SELECT person_id,
    argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
    minIf(timestamp, event = 'onboarding_completed') AS t0,
    arraySort(x -> tupleElement(x, 1),
      groupArray(tuple(timestamp, event, coalesce(toString(properties.$screen_name), '')))) AS ev
  FROM events
  WHERE timestamp >= toDateTime('2026-09-14') AND timestamp < toDateTime('2026-11-14')   -- 60 days
    AND {RN} AND {EXCL}
    AND event IN ('onboarding_completed', '$screen', 'user_signed_in')
  GROUP BY person_id
  HAVING countIf(event = 'onboarding_completed') > 0)
GROUP BY ver ORDER BY ver
-- result with {EXCL}: all 292 / 11 / 4; 3.26.0 121 / 5 / 1; 3.21.0 33 / 2 / 1; 3.20.0 11 / 2 / 2; 3.27.0 6 / 2 / 0
```

q1b (sessions of the first PO12/PO13 event, then their timelines) is a lookup per person built on the same subquery: take
`arrayFirst(...)` of the predicate above together with `properties.$session_id`, then list `event, $screen_name, timestamp` for those sessions.
It returns person-level rows, so it is not reproduced here.

## q2a — first-hour diagnosis and the screen before it (item 2)

```sql
SELECT ver, count() AS completers,
  countIf(t_diag > toDateTime('2000-01-01')) AS diag_1h,
  countIf(t_diag > toDateTime('2000-01-01') AND entry = '/(tabs)/(home)') AS via_home,
  countIf(t_diag > toDateTime('2000-01-01') AND entry = '/(tabs)') AS via_tabs_root,
  countIf(t_diag > toDateTime('2000-01-01') AND entry NOT IN ('/(tabs)/(home)', '/(tabs)')) AS via_other
FROM (
  SELECT person_id, ver, t0, t_diag,
    -- last $screen before the first diagnosis that is not a diagnose screen
    arrayLast(x -> tupleElement(x, 1) < t_diag AND tupleElement(x, 2) NOT ILIKE '%diagnos%', scr).2 AS entry
  FROM (
    SELECT person_id,
      argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
      minIf(timestamp, event = 'onboarding_completed') AS t0,
      arrayMin(arrayFilter(t -> t >= t0 AND t < t0 + INTERVAL 1 HOUR,
        groupArrayIf(timestamp, event = 'diagnostic_started'))) AS t_diag_raw,
      if(t_diag_raw > toDateTime('2000-01-01'), t_diag_raw, toDateTime('1970-01-01')) AS t_diag,
      arraySort(x -> tupleElement(x, 1),
        groupArrayIf(tuple(timestamp, coalesce(toString(properties.$screen_name), '')), event = '$screen')) AS scr
    FROM events
    WHERE timestamp >= toDateTime('2026-08-15') AND timestamp < toDateTime('2026-11-14')   -- 90 days
      AND {RN} AND {EXCL}
      AND event IN ('onboarding_completed', 'diagnostic_started', '$screen')
    GROUP BY person_id
    HAVING countIf(event = 'onboarding_completed') > 0))
GROUP BY ver ORDER BY ver
-- result: 3.26.0 120 / 29 / 26 / 3 / 0 (121 completers with the project filter only); 3.21.0 33 / 4 / 4; 3.28.0 8 / 3 / 3;
-- caveat (2026-11-13 re-run): via_home / via_tabs_root depend on sort order at the '/(tabs)' + '/(tabs)/(home)' timestamp tie
-- (26, 27 or 28 on 3.26.0); the tie-aware tile form is po2d_diag_1h_via_home in fs/fs-po2d.sql (29 of 29 via Home);
-- 3.19.0 / 3.19.1 7 each, all via the old /new route
```

q2c is q2a with `argMaxIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL)` added to the inner
`SELECT` (and the V1 §3.1 build heuristic when it is null) and grouped by `ver, platform`.

## Item 4 — per-user daily generations and daily spend (Supabase)

```sql
with g as (
  select user_id, (created_at at time zone 'UTC')::date as d, count(*) as n
  from content_generation_log
  where created_at > now() - interval '120 days' and status = 'success'
  group by 1, 2
), s as (
  select (created_at at time zone 'UTC')::date as d, sum(cost_cents) as cents
  from content_generation_log
  where created_at > now() - interval '120 days'
  group by 1
)
select (select max(n) from g) as max_per_user_day,
       (select count(*) from g where n >= 50) as user_days_ge_50,      -- FREE_DAILY_GENERATIONS
       (select max(cents) from s) as max_daily_cents,
       (select count(*) from s where cents >= 5000) as days_ge_5000    -- GLOBAL_DAILY_SPEND_CAP_CENTS
-- result: 6 / 0 / 14 / 0
```

## Item 5 — duplicate bikes (Supabase)

```sql
-- 5a: users with more than one live bike of the same make/model/year (synthetic and deleted users excluded)
with real_users as (
  select id from users where coalesce(is_synthetic, false) = false and deleted_at is null
)
select count(distinct m.user_id) as users, min(m.created_at)::date as first_created
from motorcycles m join real_users u on u.id = m.user_id
where m.deleted_at is null
  and (m.user_id, m.make, m.model, m.year) in (
    select user_id, make, model, year from motorcycles
    where deleted_at is null group by 1, 2, 3, 4 having count(*) > 1)
-- result: 1 user, created 2026-05-15 (before 00191)

-- 5b: pairs of live bikes of one user created at most 10 minutes apart
with real_users as (
  select id from users where coalesce(is_synthetic, false) = false and deleted_at is null
)
select count(distinct a.user_id) as users_with_close_pairs,
  count(*) filter (where a.make = b.make and a.model is not distinct from b.model
    and a.year is not distinct from b.year) as same_bike_pairs,
  count(*) filter (where b.created_at >= '2026-10-15' and a.make = b.make
    and a.model is not distinct from b.model and a.year is not distinct from b.year) as same_bike_pairs_since_00191
from motorcycles a
join motorcycles b on a.user_id = b.user_id and a.id < b.id
join real_users u on u.id = a.user_id
where a.deleted_at is null and b.deleted_at is null
  and abs(extract(epoch from b.created_at - a.created_at)) <= 600
-- result: 4 users / 1 same-bike pair (the 2026-05-15 one) / 0 since 00191
```

## Item 9 — push tokens (Supabase and PostHog)

```sql
-- Supabase
select platform,
  count(*) filter (where created_at > now() - interval '7 days') as last_7d,
  count(*) as total,
  max(created_at)::date as latest
from device_push_tokens
group by 1
-- result: android 3 / 3 / 2026-11-12; ios 7 / 106 / 2026-11-12
-- the Android rows joined to users (is_synthetic and the q00 test accounts) give 3 of 3 test/synthetic; counts only
```

```sql
-- PostHog, project filter only, 30 days
SELECT event, toString(properties.platform) AS platform, toString(properties.$app_version) AS ver,
  toString(properties.$app_build) AS build, count() AS events, uniq(person_id) AS persons
FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY
  AND (event ILIKE '%push%' OR event ILIKE '%notification_perm%')
GROUP BY event, platform, ver, build
ORDER BY event, ver, build
-- result 2026-11-13: no push_token_registered rows; push_token_registration_failed 3 events / 1 person on Android 3.28.0 vc99
```

## Item 10 — F14 engaged return on the scanned riders (PostHog)

Day-2 and week-1 are counted from the UTC calendar day of the first `onboarding_completed` (`ob_day`), F14 allow-list from
`board/06-experimentation-analyst.md` Appendix B. No `{EXCL}`: the population is fixed by the scanned sessions.

```sql
WITH p AS (
  SELECT person_id AS pid,
    toDate(minIf(timestamp, event = 'onboarding_completed')) AS ob_day,
    groupUniqArrayIf(toDate(timestamp), event IN ('Application Opened', 'Application Became Active', '$screen')) AS open_days,
    groupUniqArrayIf(toDate(timestamp), event = '$screen'
      AND toString(properties.$screen_name) NOT IN ('/', '/(tabs)/(home)', '/(tabs)', '/whats-new', '/(modals)/whats-new',
        '/login', '/account', '/commitment', '/goals', '/reveal', '/bike-setup', '/personalizing', '/notifications', '/paywall',
        '/heard-about', '/experience', '/welcome', '/consent', '/no-bike-value')
      AND NOT startsWith(toString(properties.$screen_name), '/(onboarding)')
      AND NOT startsWith(toString(properties.$screen_name), '/(auth)')) AS scr_days,
    groupUniqArrayIf(toDate(timestamp), (event = 'ride_completed' AND coalesce(properties.below_min_ride, false) = false)
      OR event IN ('expense_added', 'maintenance_task_created', 'maintenance_task_completed')) AS core_days
  FROM events
  WHERE timestamp >= '2026-10-01' AND timestamp < '2026-11-14'
    AND person_id IN (
      SELECT DISTINCT person_id FROM events
      WHERE timestamp >= '2026-10-01' AND timestamp < '2026-11-14' AND properties.$session_id IN ({SCANNED}))
  GROUP BY pid
  HAVING countIf(event = 'onboarding_completed') > 0
),
f AS (
  SELECT *,
    has(open_days, ob_day + 1) AS d2_raw,
    has(open_days, ob_day + 1) AND (has(scr_days, ob_day + 1) OR has(core_days, ob_day + 1)) AS d2_engaged,
    arrayExists(d -> d >= ob_day + 1 AND d <= ob_day + 6 AND (has(scr_days, d) OR has(core_days, d)), open_days) AS w1_engaged,
    arrayExists(d -> d >= ob_day AND d <= ob_day + 6, core_days) AS w1_core
  FROM p
)
SELECT pop, count() AS n, sum(d2_raw) AS d2_raw, sum(d2_engaged) AS d2_engaged,
  sum(w1_engaged) AS w1_engaged, sum(w1_core) AS w1_core
FROM f
ARRAY JOIN [
  if(ob_day <= toDate('2026-11-10'), 'a_le_1110', ''),            -- R6 eligible
  if(ob_day <= toDate('2026-11-11'), 'b_le_1111', ''),            -- eligible on 2026-11-13
  if(ob_day <= toDate('2026-11-05'), 'c_full_week_le_1105', '')   -- full week observable
] AS pop
WHERE pop != ''
GROUP BY pop ORDER BY pop
-- result: a 100 / 16 / 13 / 16 / 17; b 105 / 17 / 14 / 17 / 20; c 72 / 7 / 5 / 7 / 9
```
