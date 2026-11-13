-- FS-OB6 - (a) completed twice; (b) landing latency after 'Open my garage'
-- Plan: EXECUTION_PLAN.md §5 FS-OB6; (a) uses FS-OB1e's per-completer SQL (not the R6 SCOREBOARD join)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: (a) 60 d: 6/292 completed twice (2.1%); 3.26.0 1/121 [V1-q18 6/292; R6-q3 6/282].
--   (b) p90 post_onboarding_landed.ms_since_cta: not measurable until T05d (3.29.0).

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
ORDER BY ver;

-- (b) after T05d:
-- SELECT toString(properties.$app_version) AS ver, toString(properties.activation_fix_level) AS lvl,
--   quantile(0.9)(toFloat(properties.ms_since_cta)) AS p90_ms, count() AS landings
-- FROM events WHERE timestamp >= now() - INTERVAL 28 DAY AND {RN} AND {EXCL} AND event = 'post_onboarding_landed' GROUP BY ver, lvl
