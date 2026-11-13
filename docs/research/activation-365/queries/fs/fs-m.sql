-- FS-M - release marker on opens
-- Plan: EXECUTION_PLAN.md §5 FS-M, §5A.2 (Q-P4 shape)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 7 d: 0 of 341 Application Opened carry activation_fix_level or ota_update_id (3.26.0 0/201, 3.27.0 0/71, 3.28.0 0/66,
--   3.21.0 0/3); platform null on 97/341 (28%) [Q-P4 0%; V1-q2 0/332, null 97]. Not measurable as a share until T01 (3.29.0).

SELECT toString(properties.$app_version) AS ver, toString(properties.$app_build) AS build,
  toString(properties.activation_fix_level) AS lvl,
  count() AS opens,
  countIf(properties.activation_fix_level IS NOT NULL) AS with_lvl,
  countIf(properties.ota_update_id IS NOT NULL) AS with_ota,
  countIf(properties.platform IS NULL) AS null_platform
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY AND event = 'Application Opened' AND {RN}
GROUP BY ver, build, lvl
ORDER BY ver, build
