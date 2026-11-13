-- FS-OB1c - completion after onboarding_resumed, by resume target (ordered)
-- Plan: EXECUTION_PLAN.md §5 FS-OB1c; validation/V1-metrics.md §3.3 (verbatim)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: bike-setup 8/31 (26%), account 5/13 (38%), personalizing 6/12, goals 3/11, notifications 6/6, others n <= 2
--   [V1-q17: 8/31, 5/13, 3/11 -- identical]. restored_draft share: not measurable until T04b/T13.

SELECT ver, target, count() AS resumed, countIf(t_done > t_res) AS completed_after
FROM (
  SELECT person_id,
    argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_resumed') AS ver,
    argMinIf(toString(properties.resume_target), timestamp, event = 'onboarding_resumed') AS target,
    minIf(timestamp, event = 'onboarding_resumed') AS t_res,
    maxIf(timestamp, event = 'onboarding_completed') AS t_done
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} AND event IN ('onboarding_resumed','onboarding_completed')
  GROUP BY person_id HAVING countIf(event = 'onboarding_resumed') > 0)
GROUP BY ver, target
ORDER BY resumed DESC
