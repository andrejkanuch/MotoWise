-- FS-PO15 - receipt scan falls back to manual entry (not fixing now; verify if seen again)
-- Plan: EXECUTION_PLAN.md §5A.3 FS-PO15; ledger line in experiments.md
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): no (doc review item 13)
-- run 2026-11-13: 60 d: 11 of 48 scan-starting riders reached receipt_scan_manual_fallback (13 events). Event names confirmed
--   (receipt_scan_started, receipt_scan_manual_fallback); outcome quality (blurred vs unreadable) not measurable.

SELECT toString(properties.$app_version) AS ver,
  uniqIf(person_id, event = 'receipt_scan_started') AS scan_riders,
  uniqIf(person_id, event = 'receipt_scan_manual_fallback') AS fallback_riders,
  countIf(event = 'receipt_scan_manual_fallback') AS fallbacks
FROM events
WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} AND event IN ('receipt_scan_started','receipt_scan_manual_fallback')
GROUP BY ver
ORDER BY ver
