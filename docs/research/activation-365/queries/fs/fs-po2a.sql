-- FS-PO2a - diagnostics 'Try Again' limit loop (>= 2 limit events in one session)
-- Plan: EXECUTION_PLAN.md §5 FS-PO2a; verbatim R3 (R3:395-402) with toString()
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: 3.26.0 5 limit riders, 3 looping, 9 limit events; no other version has any [R3 Q2/Q9 3/5, 9; V1-q27].

SELECT ver, uniq(person_id) AS limit_riders, uniqIf(person_id, n >= 2) AS looping_riders, sum(n) AS limit_events
FROM (SELECT person_id, toString(properties.$app_version) AS ver, toString(properties.$session_id) AS sid, count() AS n
      FROM events
      WHERE event = 'diagnostic_limit_reached' AND timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
      GROUP BY person_id, ver, sid)
GROUP BY ver
ORDER BY ver
