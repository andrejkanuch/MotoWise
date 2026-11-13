-- FS-OB1b - fast backward onboarding moves (back-walk)
-- Plan: EXECUTION_PLAN.md §5 FS-OB1b; validation/V1-metrics.md §3.2 ($screen method, verbatim) + event form after T04b
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: $screen method, 60 d, by plat: android 28/208 (13.5%), 4 completed; ios 14/74 (18.9%), 2 completed;
--   unknown 7/36 [V1-q15: android 28/201, ios 14/72, unknown 7/36]. Event form: not measurable until T04b (onboarding_back).

-- (1) $screen method (works today)
SELECT plat, ver, count() AS riders, countIf(fast_backs >= 3) AS backwalkers,
       countIf(fast_backs >= 3 AND done) AS backwalkers_completed, countIf(done) AS completed
FROM (
  SELECT person_id,
    argMin(toString(properties.$app_version), timestamp) AS ver,
    coalesce(argMaxIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL), 'unknown') AS plat,
    countIf(event = 'onboarding_completed') > 0 AS done,
    arraySort(x -> tupleElement(x, 1), groupArrayIf(
      tuple(timestamp, indexOf(['/(onboarding)','/(onboarding)/experience','/(onboarding)/bike-setup','/(onboarding)/reveal',
                                '/(onboarding)/goals','/(onboarding)/account','/(onboarding)/commitment','/(onboarding)/heard-about',
                                '/(onboarding)/notifications','/(onboarding)/personalizing','/(onboarding)/paywall'],
                               toString(properties.$screen_name))),
      event = '$screen' AND startsWith(toString(properties.$screen_name), '/(onboarding)')
        AND toString(properties.$screen_name) NOT IN ('/(onboarding)/sign-in','/(onboarding)/no-bike-value'))) AS s,
    arrayCount(i -> i > 1 AND tupleElement(s[i], 2) > 0 AND tupleElement(s[i], 2) < tupleElement(s[i-1], 2)
               AND dateDiff('second', tupleElement(s[i-1], 1), tupleElement(s[i], 1)) <= 5, arrayEnumerate(s)) AS fast_backs
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} AND event IN ('$screen','onboarding_completed')
  GROUP BY person_id HAVING length(s) > 0)
GROUP BY plat, ver
ORDER BY plat, ver;

-- (2) event form, after T04b (onboarding_back) -- draft, not runnable before 3.29.0
-- SELECT ver, plat, count() AS starters, countIf(fast_backs >= 3) AS backwalkers, countIf(fast_backs >= 3 AND done) AS backwalkers_completed
-- FROM (SELECT person_id, argMin(toString(properties.$app_version), timestamp) AS ver,
--         coalesce(argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL), 'unknown') AS plat,
--         countIf(event = 'onboarding_completed') > 0 AS done,
--         countIf(event = 'onboarding_back' AND toInt(properties.ms_on_screen) <= 5000
--                 AND toString(properties.trigger) IN ('hardware','gesture')) AS fast_backs
--       FROM events WHERE timestamp >= now() - INTERVAL 28 DAY AND {RN} AND {EXCL}
--         AND event IN ('onboarding_started','onboarding_back','onboarding_completed')
--       GROUP BY person_id HAVING countIf(event = 'onboarding_started') > 0)
-- GROUP BY ver, plat
