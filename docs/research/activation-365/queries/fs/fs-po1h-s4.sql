-- FS-PO1H / S4 - onboarding bike gets a service schedule (PostHog per-version form)
-- Plan: EXECUTION_PLAN.md §5 FS-PO1H, §1.2 S4, §5A.4; DB forms: queries/db/s4a-day0-schedule.sql, queries/db/s4b-r2m1.sql
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: PostHog form: not measurable until T07a (server service_plan_imported) / T07b (service_plan_task_count).
--   DB baselines (run 2026-11-13): S4(a) weeks 10-12..11-02 any 25/111, oem 15/111; S4(b) R2-M1 10/157 (6.4%).

-- draft, run after the T07a API deploy (read by deploy date, all versions at once)
SELECT toString(c.ver) AS ver, count() AS completers_with_bike,
  countIf(arrayExists(t -> t >= c.t0 AND t < c.t0 + INTERVAL 5 MINUTE, c.imports)) AS with_plan_5min
FROM (
  SELECT person_id,
    argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
    minIf(timestamp, event = 'onboarding_completed') AS t0,
    groupArrayIf(timestamp, event = 'service_plan_imported') AS imports   -- server event (T07a): no {RN}
  FROM events
  WHERE timestamp >= now() - INTERVAL 28 DAY AND ({RN} OR event = 'service_plan_imported') AND {EXCL}
    AND event IN ('onboarding_completed','service_plan_imported')
  GROUP BY person_id HAVING t0 > toDateTime('2000-01-01')) AS c
GROUP BY ver
