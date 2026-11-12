-- RevenueCat server events (#263, live from 2026-10-05) joined to client activity. Run 2026-11-12.
WITH r AS (SELECT person_id AS pid, min(timestamp) AS t_buy, argMin(event, timestamp) AS ev, argMin(toString(properties.is_trial), timestamp) AS trial,
  argMin(properties.store, timestamp) AS store, argMin(properties.presented_offering_id, timestamp) AS offering, argMin(properties.price_usd, timestamp) AS usd,
  maxIf(1, event = 'rc_renewal' AND properties.is_trial_conversion = true) AS trial_conv, maxIf(1, event = 'rc_cancellation') AS cancelled
  FROM events WHERE timestamp >= '2026-08-14' AND event IN ('rc_initial_purchase','rc_non_renewing_purchase','rc_renewal','rc_cancellation')
  AND coalesce(properties.environment, 'PRODUCTION') = 'PRODUCTION' AND distinct_id != 'revenuecat-no-consent'
  GROUP BY pid HAVING ev IN ('rc_initial_purchase','rc_non_renewing_purchase')),
a AS (SELECT person_id AS pid, min(timestamp) AS fs,
  minIf(timestamp, event IN ('expense_added','maintenance_task_created','maintenance_task_completed') OR (event = 'ride_completed' AND coalesce(properties.below_min_ride, false) = false)) AS t_core,
  groupArrayIf((timestamp, coalesce(toString(properties.placement), '?')), event = 'paywall_present_requested') AS pl,
  groupUniqArrayIf(toDate(timestamp), event IN ('Application Opened','Application Became Active','$screen')) AS adays
  FROM events WHERE timestamp >= '2026-04-01' AND person_id IN (SELECT pid FROM r) GROUP BY pid)
SELECT r.t_buy, r.ev, r.trial, r.store, r.offering, r.usd, r.trial_conv, r.cancelled, dateDiff('hour', a.fs, r.t_buy) AS hrs_since_first_seen,
  a.t_core > toDateTime('2000-01-01') AND a.t_core < r.t_buy AS core_before_buy, a.t_core > toDateTime('2000-01-01') AS core_ever,
  arrayLast(x -> x.1 <= r.t_buy + INTERVAL 10 MINUTE, arraySort(x -> x.1, a.pl)).2 AS placement_before_buy,
  length(arrayFilter(d -> d > toDate(r.t_buy), a.adays)) AS active_days_after_buy
FROM r LEFT JOIN a ON a.pid = r.pid ORDER BY r.t_buy
