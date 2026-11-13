-- FS-R2-4 - imperial riders get miles targets from an onboarding import
-- Plan: EXECUTION_PLAN.md §5 FS-R2-4, §5A.4; DB form queries/db/fs-r2-4-imperial.sql
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: PostHog form (service_plan_imported.unit = 'mi' share): not measurable until T07a.
--   DB (2026-11-13): see queries/db/fs-r2-4-imperial.sql (77 onboarding bikes of imperial riders in 60 d, 4 with OEM tasks).

-- draft, after the T07a deploy
SELECT toString(properties.unit) AS unit, count() AS imports, uniq(person_id) AS riders
FROM events
WHERE timestamp >= now() - INTERVAL 28 DAY AND event = 'service_plan_imported' AND {EXCL}   -- server event: no {RN}
GROUP BY unit
