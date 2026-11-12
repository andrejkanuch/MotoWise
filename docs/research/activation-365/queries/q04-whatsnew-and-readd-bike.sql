-- Onboarding completers who saw What's New within 1h, and who re-added a bike within 1 day. Run 2026-11-12.
WITH c AS (SELECT person_id AS pid, min(timestamp) AS fs, minIf(timestamp, event = 'onboarding_completed') AS t_ob,
  minIf(timestamp, event = 'whats_new_viewed') AS t_wn, minIf(timestamp, event = '$screen' AND properties.$screen_name = '/add-bike') AS t_addbike,
  minIf(timestamp, event = 'garage_bike_added') AS t_gb, maxIf(1, event = 'onboarding_step_completed' AND properties.step = 'bike_setup') AS bk,
  groupUniqArrayIf(toDate(timestamp), event IN ('Application Opened','Application Became Active','$screen')) AS adays
  FROM events WHERE timestamp >= '2026-04-01' AND properties.$lib = 'posthog-react-native' AND person_id NOT IN (<excluded test/synthetic person ids: project test-account filter + is_synthetic users; list kept outside the repo>)
  GROUP BY pid HAVING fs >= '2026-08-14' AND fs < '2026-11-05' AND t_ob > toDateTime('2000-01-01'))
SELECT count() AS ob_done,
  countIf(t_wn > toDateTime('2000-01-01') AND t_wn < t_ob + INTERVAL 1 HOUR) AS whatsnew_within_1h,
  countIf(t_wn > toDateTime('2000-01-01') AND t_wn < t_ob + INTERVAL 1 HOUR AND has(adays, toDate(fs) + 1)) AS wn_day2,
  countIf(NOT (t_wn > toDateTime('2000-01-01') AND t_wn < t_ob + INTERVAL 1 HOUR) AND has(adays, toDate(fs) + 1)) AS nowh_day2,
  countIf(bk = 1) AS n_bike_in_ob,
  countIf(bk = 1 AND t_addbike > toDateTime('2000-01-01') AND t_addbike < t_ob + INTERVAL 1 DAY) AS bike_ob_then_addbike_screen,
  countIf(bk = 1 AND t_gb > toDateTime('2000-01-01') AND t_gb < t_ob + INTERVAL 1 DAY) AS bike_ob_then_garage_bike_added
FROM c
