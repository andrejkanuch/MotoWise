-- FS-EXP1 - Experiment 1 exposure by arm; S1 by arm (pre-registered)
-- Plan: EXECUTION_PLAN.md §5 FS-EXP1; R4 (R4:455-461) + S1 (s1.sql) by activation_arm
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes, after T30
-- run 2026-11-13: not measurable until T30 (activation_exposure, activation_arm; Release B 3.30.0 + API window).
--   Baseline for the primary = s1.sql: completion-anchored 39/272 (14.3%), 3.26.0 10/89; strata track_rides 34/145 vs other 5/127.

-- (1) exposure by arm (draft)
SELECT toString(properties.arm) AS arm, toString(properties.onboarding_variant) AS ob, toString(properties.$app_version) AS ver,
  toString(properties.primary_goal) AS goal, toString(properties.returning_account) AS returning_account,
  lower(toString(properties.platform)) AS plat, uniq(person_id) AS enrolled
FROM events
WHERE timestamp >= now() - INTERVAL 120 DAY AND event = 'activation_exposure'
  AND toString(properties.experiment) = 'activation_365_first_session' AND {RN} AND {EXCL}
GROUP BY arm, ob, ver, goal, returning_account, plat;

-- (2) primary: S1 by arm (s1.sql with `argMinIf(toString(properties.activation_arm), timestamp, event = 'onboarding_completed') AS arm`,
--     cohort = first onboarding_completed after the window start, returning_account excluded, strata goal x platform;
--     Mantel-Haenszel risk difference computed offline from the stratum counts).
