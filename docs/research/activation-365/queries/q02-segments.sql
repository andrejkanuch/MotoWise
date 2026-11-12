WITH base AS (
  SELECT
    person_id AS pid,
    min(timestamp) AS fs,
    argMaxIf(properties.platform, timestamp, properties.platform IS NOT NULL) AS plat_prop,
    argMin(concat(toString(properties.$app_version), '/', toString(properties.$app_build)), timestamp) AS first_build,
    argMin(properties.$geoip_country_code, timestamp) AS cc,
    groupUniqArrayIf(toDate(timestamp), event IN ('Application Opened', 'Application Became Active', '$screen')) AS adays,
    maxIf(1, event = 'onboarding_started') AS ob_start,
    maxIf(1, event = 'onboarding_step_viewed' AND properties.step = 'welcome') AS s_welcome,
    maxIf(1, event = 'onboarding_step_viewed' AND properties.step = 'experience') AS s_exp,
    maxIf(1, event = 'onboarding_step_viewed' AND properties.step = 'bike_setup') AS s_bike,
    maxIf(1, event = 'onboarding_step_completed' AND properties.step = 'bike_setup') AS c_bike,
    maxIf(1, event = 'onboarding_step_viewed' AND properties.step = 'goals') AS s_goals,
    maxIf(1, event = 'onboarding_step_viewed' AND properties.step = 'account') AS s_account,
    maxIf(1, event = 'onboarding_step_viewed' AND properties.step = 'notifications') AS s_notif,
    maxIf(1, event = 'onboarding_step_viewed' AND properties.step = 'personalizing') AS s_pers,
    maxIf(1, event = 'paywall_viewed') AS pw_seen,
    maxIf(1, event = 'onboarding_completed') AS ob_done,
    minIf(timestamp, event = 'onboarding_completed') AS t_obdone,
    minIf(timestamp, event = 'ride_completed' AND coalesce(properties.below_min_ride, false) = false) AS t_ride,
    minIf(timestamp, event = 'ride_started') AS t_ridestart,
    minIf(timestamp, event = 'expense_added') AS t_exp,
    minIf(timestamp, event IN ('maintenance_task_created', 'maintenance_task_completed')) AS t_mnt,
    minIf(timestamp, event = 'garage_bike_added') AS t_gbike,
    maxIf(1, event = 'notification_permission_requested') AS push_asked,
    argMaxIf(toString(properties.permission_granted), timestamp, event = 'notification_permission_result') AS push,
    argMaxIf(properties.primary_goal, timestamp, event = 'onboarding_step_completed' AND properties.step = 'goals') AS goal,
    maxIf(1, event = 'purchase_completed') AS did_buy
  FROM events
  WHERE timestamp >= '2026-04-01'
    AND properties.$lib = 'posthog-react-native'
    AND person_id NOT IN (<excluded test/synthetic person ids: project test-account filter + is_synthetic users; list kept outside the repo>)
  GROUP BY pid
  HAVING fs >= '2026-08-14' AND fs < '2026-11-05'
),
p AS (
  SELECT *,
    toDate(fs) AS d0,
    multiIf(plat_prop IS NOT NULL AND plat_prop != '', plat_prop,
      first_build IN ('3.18.0/82','3.19.1/90','3.20.0/93','3.21.0/96','3.22.0/97','3.25.0/105','3.26.0/106','3.27.0/108'), 'ios',
      first_build IN ('3.19.0/81','3.19.1/84','3.19.0/87','3.21.0/91','3.26.0/93','3.20.0/87'), 'android', 'unknown') AS platform,
    has(adays, toDate(fs) + 1) AS d1_back,
    arrayExists(x -> x > toDate(fs), adays) AS ever_back,
    arrayExists(x -> x >= toDate(fs) + 7 AND x <= toDate(fs) + 13, adays) AS d7_back,
    fs < toDateTime('2026-10-29') AS d7_eligible,
    t_ride > toDateTime('2000-01-01') AND t_ride < fs + INTERVAL 7 DAY AS w_ride,
    t_exp > toDateTime('2000-01-01') AND t_exp < fs + INTERVAL 7 DAY AS w_exp,
    t_mnt > toDateTime('2000-01-01') AND t_mnt < fs + INTERVAL 7 DAY AS w_mnt,
    t_gbike > toDateTime('2000-01-01') AND t_gbike < fs + INTERVAL 7 DAY AS w_gbike,
    t_ride > toDateTime('2000-01-01') AND toDate(t_ride) = toDate(fs) AS d0_ride,
    t_exp > toDateTime('2000-01-01') AND toDate(t_exp) = toDate(fs) AS d0_exp,
    t_mnt > toDateTime('2000-01-01') AND toDate(t_mnt) = toDate(fs) AS d0_mnt,
    t_ridestart > toDateTime('2000-01-01') AND toDate(t_ridestart) = toDate(fs) AS d0_ridestart
  FROM base
)
-- base CTE above trimmed of step flags in the executed version; segment SELECT:
, q AS (
  SELECT *,
    arrayMin(arrayFilter(x -> x > toDateTime('2000-01-01'), [t_ride, t_exp, t_mnt, toDateTime('2100-01-01')])) AS t_core,
    dateDiff('minute', fs, t_core) AS ttfc_min,
    multiIf(t_core = t_ride, 'ride', t_core = t_exp, 'expense', t_core = t_mnt, 'maint', 'none') AS first_core
  FROM p
)
SELECT seg, count() AS n, countIf(d1_back) AS day2_ret, countIf(ever_back) AS ever_ret,
  countIf(d7_eligible) AS d7_elig, countIf(d7_eligible AND d7_back) AS d7_ret,
  countIf(w_ride OR w_exp OR w_mnt) AS core_w1, sum(bought) AS did_buy
FROM q
ARRAY JOIN [
  'all',
  if(d0_ride, 'd0:ride', ''), if(d0_exp, 'd0:expense', ''), if(d0_mnt, 'd0:maint', ''),
  if(NOT (d0_ride OR d0_exp OR d0_mnt), 'd0:no_core', ''),
  if(d0_ridestart AND NOT d0_ride, 'd0:ride_started_not_saved', ''),
  if(w_ride, 'w1:ride', ''), if(w_exp, 'w1:expense', ''), if(w_mnt, 'w1:maint', ''), if(w_gbike, 'w1:garage_bike', ''),
  if(NOT (w_ride OR w_exp OR w_mnt), 'w1:no_core', ''),
  if(ttfc_min < 10080, concat('first_core:', first_core), ''),
  if(ttfc_min < 10080, concat('ttfc:', multiIf(ttfc_min < 60, 'a_<1h', ttfc_min < 1440, 'b_1-24h', ttfc_min < 4320, 'c_1-3d', 'd_3-7d')), ''),
  concat('push:', platform, ':', if(push = '', 'no_result', push)),
  concat('push_asked:', toString(push_asked)),
  concat('goal:', coalesce(goal, 'none')),
  concat('goal_ride_w1:', coalesce(goal, 'none'), ':', toString(w_ride)),
  concat('goal_exp_w1:', coalesce(goal, 'none'), ':', toString(w_exp)),
  concat('ob_done:', toString(ob_done)),
  concat('paywall_seen:', toString(pw_seen)),
  concat('bought:', toString(did_buy)),
  concat('week:', toString(toStartOfWeek(fs, 1))),
  concat('cc:', multiIf(cc IN ('US','CA','MX','BR','AR','CL','CO'), 'americas', cc IN ('DE','AT','CH','FR','IT','ES','PT','PL','NL','BE','GB','IE','SE','NO','DK','FI','CZ','SK','HU','RO','GR','SI','HR','BG','LT','LV','EE','LU'), 'europe', cc = 'IN', 'india', 'other'))
] AS seg
WHERE seg != ''
GROUP BY seg
ORDER BY seg
LIMIT 300
