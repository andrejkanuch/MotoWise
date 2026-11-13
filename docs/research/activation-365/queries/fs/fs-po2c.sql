-- FS-PO2c - upfront diagnose paywalls when the quota is used
-- Plan: EXECUTION_PLAN.md §5 FS-PO2c; verbatim R3 (R3:510-517) with toString()
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: 6 upfront paywall requests / 3 riders (3.26.0 4/2, 3.28.0 2/1) [R3 Q1/Q7 6/3; V1-q31].
--   limit_sheet_viewed: not measurable until T21/T24.

SELECT toString(properties.$app_version) AS ver,
  countIf(event = 'paywall_present_requested' AND toString(properties.limit_key) = 'MAX_AI_DIAGNOSTICS_PER_MONTH') AS upfront_paywalls,
  uniqIf(person_id, event = 'paywall_present_requested' AND toString(properties.limit_key) = 'MAX_AI_DIAGNOSTICS_PER_MONTH') AS upfront_riders,
  countIf(event = 'limit_sheet_viewed' AND toString(properties.feature) = 'full_ai_diagnostics') AS limit_sheets   -- after T21/T24
FROM events
WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} AND event IN ('paywall_present_requested','limit_sheet_viewed')
GROUP BY ver
ORDER BY ver
