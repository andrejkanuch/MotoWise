-- FS-PO10 - 'first ride' checklist tick without a prior real ride (ordered)
-- Plan: EXECUTION_PLAN.md §5 FS-PO10; R4 (R4:430-436) reordered: the real ride must come BEFORE the tick
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d, by the rider's first first_ride tick: tap 16 riders, 0 with a real ride before the tick (16 without);
--   data 20 riders, 10 with a real ride before, 10 without; null trigger (old builds) 10, 9 without
--   [R4/V1-q39 counted a real ride any time in 60 d: tap 16 (3), data 20 (12)]. Baselines of the '= 0' targets:
--   tap 16, data-ticked without a prior real ride 10.

SELECT trig, count() AS riders,
  countIf(t_real > toDateTime('2000-01-01') AND t_real < t_tick) AS real_ride_before_tick,
  countIf(NOT (t_real > toDateTime('2000-01-01') AND t_real < t_tick)) AS ticked_without_prior_real_ride,
  countIf(t_real > toDateTime('2000-01-01')) AS real_ride_any_time
FROM (
  SELECT person_id,
    coalesce(argMinIf(toString(properties.trigger), timestamp, event = 'checklist_item_completed' AND toString(properties.item) = 'first_ride'), 'null') AS trig,
    minIf(timestamp, event = 'checklist_item_completed' AND toString(properties.item) = 'first_ride') AS t_tick,
    minIf(timestamp, event = 'ride_completed' AND coalesce(toString(properties.below_min_ride), 'false') != 'true') AS t_real
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} AND event IN ('checklist_item_completed','ride_completed')
  GROUP BY person_id HAVING t_tick > toDateTime('2000-01-01'))
GROUP BY trig
ORDER BY trig
