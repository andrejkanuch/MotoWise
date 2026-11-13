-- FS-OB1f - session lost during onboarding
-- Plan: EXECUTION_PLAN.md §5 FS-OB1f (conditional T38)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: not measurable until T04b (auth_session_lost ships in Release A 3.29.0). Decision rule: fix only if >= 2 riders/month.

-- draft, run after 3.29.0 go-live
SELECT toStartOfMonth(timestamp) AS month, toString(properties.$app_version) AS ver, toString(properties.activation_fix_level) AS lvl,
  uniqIf(person_id, event = 'auth_session_lost' AND toString(properties.during_onboarding) = 'true') AS riders
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY AND {RN} AND {EXCL} AND event = 'auth_session_lost'
GROUP BY month, ver, lvl
ORDER BY month, ver
