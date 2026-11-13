-- FS-OB2c - cancelling Google shows an error alert
-- Plan: EXECUTION_PLAN.md §5 FS-OB2c
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: not measurable until T04a (auth_oauth_result, auth_error_alert_shown ship in 3.29.0). Code baseline: every cancel alerts.

-- draft, run after 3.29.0 go-live
SELECT toString(properties.$app_version) AS ver, toString(properties.activation_fix_level) AS lvl,
  countIf(event = 'auth_error_alert_shown' AND toString(properties.outcome) = 'cancelled') AS cancel_alerts,
  countIf(event = 'auth_oauth_result' AND toString(properties.outcome) = 'cancelled') AS cancels
FROM events
WHERE timestamp >= now() - INTERVAL 28 DAY AND {RN} AND {EXCL} AND event IN ('auth_error_alert_shown','auth_oauth_result')
GROUP BY ver, lvl
