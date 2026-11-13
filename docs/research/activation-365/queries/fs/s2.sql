-- S2 - onboarding completion (starters cohort)
-- Plan: EXECUTION_PLAN.md §1.2 S2 (Q-P6 shape; V1-q6, V1-q8)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: cohort: first onboarding_started in [now-60 d, now-2 d) (Q-P6 shape)
--   all: starters 435, completed 241 (55.4%), day-2 raw 52, engaged 31; completers: day-2 raw 41, engaged 31, engaged 24-48 h 18
--   3.26.0 (android 124 + ios 28 + android? 4): starters 156, completed 92 (59.0%), day-2 raw 19, engaged 10;
--     completers engaged (calendar) 10, engaged 24-48 h 5   [Q-P6 90/153, 17 d2; V1-q6 91/154, 17]
--   3.26.0 by platform: android 69/124 completed, 15 d2 raw, 7 engaged; ios 23/28 completed, 4 d2 raw, 3 engaged
--   3.19.0 40/105; 3.19.1 64/96; 3.21.0 27/46; 3.27.0 5/7 (n small)
--   q02 first-seen cohort reference (V1-q8/q9, 2026-11-12): S2 367/793; S3 completers engaged 37/367, all 39/793; raw 72/793, 58/367

SELECT ver, plat, count() AS starters, countIf(done) AS completed,
  countIf(d2) AS d2_raw, countIf(d2 AND (d2_scr OR d2_core)) AS d2_engaged,
  countIf(done AND d2) AS completers_d2_raw, countIf(done AND d2 AND (d2_scr OR d2_core)) AS completers_d2_engaged,
  countIf(done AND e2448) AS completers_engaged_24_48h
FROM (
  SELECT pid, ver, plat, done, fs,
    arrayExists(t -> toDate(t) = toDate(fs) + 1, opens) AS d2,
    arrayExists(x -> toDate(tupleElement(x, 1)) = toDate(fs) + 1 AND NOT (tupleElement(x, 2) IN {F14_ALLOW}
                     OR startsWith(tupleElement(x, 2), '/(onboarding)') OR startsWith(tupleElement(x, 2), '/(auth)')), scr) AS d2_scr,
    arrayExists(t -> toDate(t) = toDate(fs) + 1, core_ts) AS d2_core,
    arrayExists(x -> tupleElement(x, 1) >= fs + INTERVAL 24 HOUR AND tupleElement(x, 1) < fs + INTERVAL 48 HOUR
                     AND NOT (tupleElement(x, 2) IN {F14_ALLOW}
                     OR startsWith(tupleElement(x, 2), '/(onboarding)') OR startsWith(tupleElement(x, 2), '/(auth)')), scr)
      OR arrayExists(t -> t >= fs + INTERVAL 24 HOUR AND t < fs + INTERVAL 48 HOUR, core_ts) AS e2448
  FROM (
    SELECT person_id AS pid,
      min(timestamp) AS fs,
      minIf(timestamp, event = 'onboarding_started') AS t_start,
      argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_started') AS ver,
      coalesce(argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL),
             multiIf(toInt(argMin(toString(properties.$app_build), timestamp)) >= 100, 'ios?', 'android?')) AS plat,
      countIf(event = 'onboarding_completed') > 0 AS done,
      groupArrayIf(timestamp, event IN ('Application Opened','Application Became Active','$screen')) AS opens,
      groupArrayIf(tuple(timestamp, toString(properties.$screen_name)), event = '$screen') AS scr,
      groupArrayIf(timestamp, (event = 'ride_completed' AND coalesce(toString(properties.below_min_ride), 'false') != 'true')
                   OR event IN ('expense_added','maintenance_task_created','maintenance_task_completed')) AS core_ts
    FROM events
    WHERE timestamp >= now() - INTERVAL 150 DAY AND {RN} AND {EXCL}
    GROUP BY person_id
    HAVING t_start >= now() - INTERVAL 60 DAY AND t_start < now() - INTERVAL 2 DAY))
GROUP BY ver, plat
ORDER BY ver, plat
-- {F14_ALLOW} = the F14 allow-list (board/06 Appendix B; T05d turns it into config/engaged-routes.ts):
--   ['/','/(tabs)/(home)','/(tabs)','/whats-new','/(modals)/whats-new','/login','/account','/commitment','/goals','/reveal',
--    '/bike-setup','/personalizing','/notifications','/paywall','/heard-about','/experience','/welcome','/consent','/no-bike-value']
