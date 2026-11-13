-- FS-PO17 - several sheets over Home on landing
-- Plan: EXECUTION_PLAN.md §5 FS-PO17
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: not measurable until T05d/T16b (post_onboarding_landed, landing_sheet_shown ship in 3.29.0).

-- draft, after 3.29.0
SELECT ver, count() AS landed, countIf(arrayCount(t -> t >= t_land AND t < t_land + INTERVAL 60 SECOND, sheets) >= 2) AS ge2_sheets_60s
FROM (
  SELECT person_id,
    argMinIf(toString(properties.$app_version), timestamp, event = 'post_onboarding_landed') AS ver,
    minIf(timestamp, event = 'post_onboarding_landed') AS t_land,
    groupArrayIf(timestamp, event = 'landing_sheet_shown') AS sheets
  FROM events
  WHERE timestamp >= now() - INTERVAL 28 DAY AND {RN} AND {EXCL} AND event IN ('post_onboarding_landed','landing_sheet_shown')
  GROUP BY person_id HAVING t_land > toDateTime('2000-01-01'))
GROUP BY ver
