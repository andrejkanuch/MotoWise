-- FS-PO9 - completers who leave within 60 s with <= 1 screen (behaviour; Exp 1 outcome)
-- Plan: EXECUTION_PLAN.md §5A.3 FS-PO9 (Q-P9, verbatim)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): no (doc review item 13; SQL on demand, read by Exp 1 arm)
-- run 2026-11-13: 60 d: 3.26.0 11/121 (9.1%); 3.19.0 2/39; 3.20.0 1/11; every other version 0 [Q-P9 11/121; V1-q38 11/120].

SELECT ver, count() AS completers, countIf(left_fast) AS left_under_60s
FROM (SELECT ver, t0,
        arrayFilter(x -> tupleElement(x, 1) >= t0 AND toDate(tupleElement(x, 1)) = toDate(t0), ev) AS day0,
        arrayMax(arrayMap(x -> tupleElement(x, 1), day0)) < t0 + INTERVAL 60 SECOND
          AND length(arrayFilter(x -> tupleElement(x, 2) = '$screen', day0)) <= 1 AS left_fast
      FROM (SELECT person_id,
              argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
              minIf(timestamp, event = 'onboarding_completed') AS t0,
              groupArray(tuple(timestamp, event)) AS ev
            FROM events
            WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
              AND event NOT IN ('Application Backgrounded','$exception','$feature_flag_called','$set','$identify')
            GROUP BY person_id HAVING countIf(event = 'onboarding_completed') > 0))
GROUP BY ver
ORDER BY ver
