-- FS-PO4b - standstill rides saved as rides (below_min_ride = true)
-- Plan: EXECUTION_PLAN.md §5 FS-PO4b; verbatim R4 (R4:408-414); DB share in queries/db/fs-po4b-first-ride.sql
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d, >= 3.21: save_trigger 'summary' 13 saves / 12 riders, 'auto_end' 2/2 [V1-q36a 13/11, all 15/13: one rider
--   moved between versions in the per-version sum]. DB (2026-11-13): 40 of 69 sign-ups' first rides are live and
--   sub-floor counting null distance (26 < 50 m + 14 null) -- see queries/db/fs-po4b-first-ride.sql.

SELECT toString(properties.$app_version) AS ver, toString(properties.activation_fix_level) AS lvl,
  toString(properties.save_trigger) AS trig, count() AS junk_saves, uniq(person_id) AS riders
FROM events
WHERE timestamp >= now() - INTERVAL 60 DAY AND event = 'ride_completed' AND {RN}
  AND toString(properties.below_min_ride) = 'true' AND {EXCL}
GROUP BY ver, lvl, trig
ORDER BY ver
