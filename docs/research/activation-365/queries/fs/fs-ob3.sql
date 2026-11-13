-- FS-OB3 - email code sent -> verified; code step restored after relaunch
-- Plan: EXECUTION_PLAN.md §5 FS-OB3; R5 M-OB3 (R5:251-260) with activation_fix_level
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: 20 riders sent a sign-up code, 17 verified (85%); 3.26.0 18/16, 3.28.0 1/1, 3.25.0 1/0 [V1-q23 19/16].
--   relaunched_with_code / restored: not measurable until T04b/T13a (pending_code_step, email_code_step_restored).

SELECT toString(properties.$app_version) AS ver, toString(properties.activation_fix_level) AS lvl,
  uniqIf(person_id, event = 'email_code_sent' AND toString(properties.source) = 'signup') AS sent,
  uniqIf(person_id, event = 'email_code_verified') AS verified,
  uniqIf(person_id, event = 'onboarding_resumed' AND toString(properties.pending_code_step) IN ('1','true')) AS relaunched_with_code,  -- after T04b
  uniqIf(person_id, event = 'email_code_step_restored') AS restored                                                                  -- after T13a
FROM events
WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
  AND event IN ('email_code_sent','email_code_verified','onboarding_resumed','email_code_step_restored')
GROUP BY ver, lvl
ORDER BY ver
