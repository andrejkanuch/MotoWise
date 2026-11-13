-- S1 - week-1 core action among completers (completion-anchored, canonical)
-- Plan: EXECUTION_PLAN.md §1.2 S1 (Q-P5 shape; V1-q7); Exp 1 primary (FS-EXP1)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: cohort: first onboarding_completed in [now-67 d, now-7 d); core action in [t0, t0+7 d)
--   all 39/272 (14.3%) [V1-q7 2026-11-12: 37/275]; 3.26.0 10/89 (11.2%) = android 8/68 + ios 2/20 + android? 0/1
--   [Q-P5: 8/84]. The window moved one day: completions of 11-05/11-06 joined; within binomial noise (8/84 vs 10/89, p≈0.7).
--   other versions: 3.19.0 7/57; 3.19.1 14/79; 3.20.0 0/9; 3.21.0 7/32; 3.22.0 0/3; 3.25.0 1/3.
--   strata (same window, goal from onboarding_step_completed step=goals): track_rides 34/145 (23.4%), other 5/127 (3.9%)
--   [V2-q5 first-seen cohort 08-14..11-04: 47/197 vs 14/170; the completion-anchored window is later and colder].

SELECT ver, plat, count() AS completers,
  countIf(arrayExists(t -> t >= t0 AND t < t0 + INTERVAL 7 DAY, core_ts)) AS core_w1
FROM (
  SELECT person_id,
    argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
    coalesce(argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL),
             multiIf(toInt(argMin(toString(properties.$app_build), timestamp)) >= 100, 'ios?', 'android?')) AS plat,
    minIf(timestamp, event = 'onboarding_completed') AS t0,
    argMaxIf(toString(properties.primary_goal), timestamp,
             event = 'onboarding_step_completed' AND toString(properties.step) = 'goals') AS goal,   -- stratum: track_rides vs other
    groupArrayIf(timestamp, (event = 'ride_completed' AND coalesce(toString(properties.below_min_ride), 'false') != 'true')
                 OR event IN ('expense_added','maintenance_task_created','maintenance_task_completed')) AS core_ts
  FROM events
  WHERE timestamp >= now() - INTERVAL 150 DAY AND {RN} AND {EXCL}
  GROUP BY person_id
  HAVING t0 >= now() - INTERVAL 67 DAY AND t0 < now() - INTERVAL 7 DAY)
GROUP BY ver, plat
ORDER BY ver, plat
-- Strata: replace `GROUP BY ver, plat` with `GROUP BY if(goal = 'track_rides', 'track_rides', 'other')`.
-- After T01: add argMinIf(toString(properties.activation_fix_level), timestamp, event = 'onboarding_completed') AS lvl.
