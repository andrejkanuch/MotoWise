-- First 5 screens/core events in the 6h after onboarding_completed, with day-2 return. Run 2026-11-12.
WITH c AS (SELECT person_id AS pid, min(timestamp) AS fs, minIf(timestamp, event = 'onboarding_completed') AS t_ob,
  groupUniqArrayIf(toDate(timestamp), event IN ('Application Opened','Application Became Active','$screen')) AS adays
  FROM events WHERE timestamp >= '2026-04-01' AND properties.$lib = 'posthog-react-native' AND person_id NOT IN (<excluded test/synthetic person ids: project test-account filter + is_synthetic users; list kept outside the repo>)
  GROUP BY pid HAVING fs >= '2026-08-14' AND fs < '2026-11-05' AND t_ob > toDateTime('2000-01-01')),
e AS (SELECT e.person_id AS pid, e.timestamp AS ts, coalesce(e.properties.$screen_name, e.event) AS nm FROM events AS e
  WHERE e.timestamp >= '2026-08-14' AND (e.event = '$screen' OR e.event IN ('ride_started','ride_completed','expense_added','maintenance_task_created','garage_bike_added','paywall_viewed'))
  AND e.person_id IN (SELECT pid FROM c)),
j AS (SELECT c.pid AS pid, has(c.adays, toDate(c.fs) + 1) AS back,
  arraySlice(arrayMap(x -> x.2, arraySort(x -> x.1, groupArrayIf((e.ts, e.nm), e.ts >= c.t_ob AND e.ts < c.t_ob + INTERVAL 6 HOUR))), 1, 5) AS seq
  FROM c LEFT JOIN e ON e.pid = c.pid GROUP BY c.pid, c.adays, c.fs)
SELECT arrayStringConcat(seq, ' > ') AS path, count() AS n, countIf(back) AS day2_back FROM j GROUP BY path ORDER BY n DESC LIMIT 30
