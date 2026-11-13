-- FS-OB1e - finished rider routed back into onboarding (relapse) / completes twice
-- Plan: EXECUTION_PLAN.md §5 FS-OB1e (draft, runs as written); DB cross-check queries/db/fs-ob1e-two-bikes.sql
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: relapsed 11/292 (3.8%), completed twice 6/292; 3.26.0 6/121 relapsed, 1 twice; 3.19.1 2/68, 3 twice;
--   3.21.0 1/33, 2 twice [V1-q18: 10/292, 6]. DB cross-check 2 users (queries/db/fs-ob1e-two-bikes.sql).

SELECT ver, count() AS completers, countIf(relapse) AS relapsed, countIf(n_oc >= 2) AS completed_twice
FROM (
  SELECT person_id,
    argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
    minIf(timestamp, event = 'onboarding_completed') AS t0,
    countIf(event = 'onboarding_completed') AS n_oc,
    maxIf(timestamp, event = 'onboarding_step_viewed' AND toString(properties.step) != 'paywall') > t0 + INTERVAL 5 SECOND AS relapse
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} AND event IN ('onboarding_completed','onboarding_step_viewed')
  GROUP BY person_id HAVING n_oc > 0)
GROUP BY ver
ORDER BY ver
