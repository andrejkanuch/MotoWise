-- FS-PO3b - diagnostics limit hit on the install launch (embedded JS)
-- Plan: EXECUTION_PLAN.md §5 FS-PO3b; verbatim R3 (R3:425-435) with toString(); is_embedded_launch after T01
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: 3.26.0 4 of 5 limit riders hit it on their install launch [R3 Q13 4/5; V1-q34].

WITH lr AS (SELECT person_id, min(timestamp) AS t, argMin(toString(properties.$app_version), timestamp) AS ver
            FROM events WHERE event = 'diagnostic_limit_reached' AND timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
            GROUP BY person_id)
SELECT lr.ver AS ver, count() AS limit_riders,
  countIf(arrayCount(x -> x <= lr.t, o.opens) <= 1) AS first_launch_limit_riders
FROM lr
LEFT JOIN (SELECT person_id, groupArray(timestamp) AS opens FROM events
           WHERE event = 'Application Opened' AND timestamp >= now() - INTERVAL 61 DAY GROUP BY person_id) AS o
  ON lr.person_id = o.person_id
GROUP BY ver
ORDER BY ver
-- After T01: countIf(toString(properties.is_embedded_launch) = 'true') on diagnostic_limit_reached.
