-- FS-OB4 - bike-setup dwell and model share (fixed window: trailing 28 d by first onboarding_started)
-- Plan: EXECUTION_PLAN.md §5 FS-OB4; R5 M-OB4 (R5:269-283) with the window fixed as the plan asks
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 28 d: android p50 45 s / p90 208 s, ios p50 45 s / p90 119 s; model 62/143 bikes (43%: android 43/106, ios 19/35);
--   > 60 s 61/159 ended (38%) [V1-q24 since 10-15: p50 45/43, p90 229/120, model 45.6%, > 60 s 38%; R5 p50 44/37, p90 146/109].
--   The Android p90 is the noisy part (n = 119 ended); the target p90 <= 75 s is judged on this 28-day window.

SELECT plat, count() AS viewed,
  quantileIf(0.5)(dateDiff('second', v_at, end_at), end_at > v_at) AS p50_s,
  quantileIf(0.9)(dateDiff('second', v_at, end_at), end_at > v_at) AS p90_s,
  countIf(end_at > v_at AND dateDiff('second', v_at, end_at) > 60) AS over_60s, countIf(end_at > v_at) AS ended,
  countIf(cap = 'model') AS with_model, countIf(cap = 'make') AS make_only, countIf(cap != '') AS with_bike
FROM (
  SELECT person_id,
    coalesce(argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL),
             multiIf(toInt(argMin(toString(properties.$app_build), timestamp)) >= 100, 'ios?', 'android?')) AS plat,
    minIf(timestamp, event = 'onboarding_started') AS t_start,
    minIf(timestamp, event = 'onboarding_step_viewed' AND toString(properties.step) = 'bike_setup') AS v_at,
    minIf(timestamp, event IN ('onboarding_step_completed','onboarding_step_skipped') AND toString(properties.step) = 'bike_setup') AS end_at,
    coalesce(argMinIf(toString(properties.capture_level), timestamp, event = 'bike_added'), '') AS cap
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
    AND event IN ('onboarding_started','onboarding_step_viewed','onboarding_step_completed','onboarding_step_skipped','bike_added','Application Opened')
  GROUP BY person_id
  HAVING t_start >= now() - INTERVAL 28 DAY AND v_at > toDateTime('2000-01-01'))
GROUP BY plat
ORDER BY plat
