-- FS-OB1d - Welcome shown again in a live JS runtime
-- Plan: EXECUTION_PLAN.md §5 FS-OB1d; pre-event proxy reconstructed from R1 Q4 'live_runtime' class (R1 M-D)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: proxy, 60 d: 9 riders (3.26.0 6/167; 3.19.0 1; 3.19.1 1; 3.25.0 1) [V1-q37: 12 riders, 6 on 3.26.0; R1 Q4/Q10 11/7].
--   V1's proxy SQL was not written down; this reconstruction (welcome view after onboarding_started whose last lifecycle
--   event is Became Active/Backgrounded, not Application Opened) matches 3.26.0 exactly and finds 3 fewer on older versions.
--   Event form (onboarding_welcome_mounted): not measurable until T04b (3.29.0).

-- (1) pre-event proxy (works today)
SELECT ver, count() AS starters,
  countIf(arrayExists(w -> tupleElement(w, 1) > t_start AND tupleElement(w, 2) = 'welcome'
          AND tupleElement(arrayLast(l -> tupleElement(l, 1) < tupleElement(w, 1)
                AND tupleElement(l, 2) IN ('Application Opened','Application Became Active','Application Backgrounded'), ev), 2)
              IN ('Application Became Active','Application Backgrounded'), ev)) AS welcome_live_runtime
FROM (
  SELECT person_id, argMin(toString(properties.$app_version), timestamp) AS ver,
    minIf(timestamp, event = 'onboarding_started') AS t_start,
    arraySort(x -> tupleElement(x, 1), groupArray(tuple(timestamp, if(event = 'onboarding_step_viewed', toString(properties.step), event)))) AS ev
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
    AND event IN ('onboarding_started','onboarding_step_viewed','Application Opened','Application Became Active','Application Backgrounded')
  GROUP BY person_id HAVING t_start > toDateTime('2000-01-01'))
GROUP BY ver
ORDER BY ver;

-- (2) event form after T04b:
-- SELECT toString(properties.$app_version) AS ver, toString(properties.activation_fix_level) AS lvl,
--   uniqIf(person_id, event = 'onboarding_welcome_mounted' AND toString(properties.had_progress) = 'true'
--          AND toString(properties.reason) != 'back') AS unexplained_welcome
-- FROM events WHERE timestamp >= now() - INTERVAL 28 DAY AND {RN} AND {EXCL} GROUP BY ver, lvl
