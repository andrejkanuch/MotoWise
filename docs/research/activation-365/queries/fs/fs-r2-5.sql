-- FS-R2-5 - junk makes saved in onboarding
-- Plan: EXECUTION_PLAN.md §5 FS-R2-5, §5A.4; DB form queries/db/fs-r2-5-short-make.sql
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: DB (2026-11-13): 6/175 live onboarding bikes in 60 d with a make under 3 letters; all-time 10/366 [V1-db6 6/176, 10/373].
--   PostHog form (onboarding_bike_created.make_valid = false): not measurable until T05e.

-- after T05e (server event onboarding_bike_created) -- draft
SELECT toStartOfWeek(timestamp, 1) AS wk, count() AS onboarding_bikes,
  countIf(toString(properties.make_valid) = 'false') AS invalid_make
FROM events
WHERE timestamp >= now() - INTERVAL 28 DAY AND event = 'onboarding_bike_created' AND {EXCL}   -- server event: no {RN}
GROUP BY wk ORDER BY wk
