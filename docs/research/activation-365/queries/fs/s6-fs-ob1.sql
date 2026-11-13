-- S6 / FS-OB1 - starter views an early step after a later one (post-auth regression)
-- Plan: EXECUTION_PLAN.md §1.2 S6, §5A.3; verbatim deep-dives/R6-replays-returners.md:276-284 + {REL}
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: all 42/462 (9.1%) [R6-q8 44/472; V1-q12 44/470]; 3.26.0 16/167 (9.6%) = android 12/135, ios 2/28, android? 2/4
--   [R6-q8 16/166]; 3.28.0 1/15; 3.27.0 1/8; 3.21.0 7/46; 3.19.x 12/202.

SELECT ver, plat, count() AS starters, countIf(regress) AS regressed
FROM (
  SELECT person_id, argMin(toString(properties.$app_version), timestamp) AS ver,
    coalesce(argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL),
             multiIf(toInt(argMin(toString(properties.$app_build), timestamp)) >= 100, 'ios?', 'android?')) AS plat,
    maxIf(timestamp, event = 'onboarding_step_viewed' AND toString(properties.step) IN ('experience','bike_setup','welcome'))
      > minIf(timestamp, event = 'onboarding_step_viewed' AND toString(properties.step) IN ('goals','account','heard_about','notifications'))
      AND countIf(event = 'onboarding_step_viewed' AND toString(properties.step) IN ('goals','account','heard_about','notifications')) > 0 AS regress
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
    AND event IN ('onboarding_started','onboarding_step_viewed')
  GROUP BY person_id
  HAVING countIf(event = 'onboarding_started') > 0)
GROUP BY ver, plat
ORDER BY ver, plat
