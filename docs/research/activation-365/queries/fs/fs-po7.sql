-- FS-PO7 - Discover time to content
-- Plan: EXECUTION_PLAN.md §5 FS-PO7
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: not measurable until T05d/T29 (screen_load_timed ships in 3.29.0).

-- draft, after 3.29.0
SELECT toString(properties.$app_version) AS ver, toString(properties.activation_fix_level) AS lvl,
  quantile(0.9)(toFloat(properties.ms_to_content)) AS p90_ms,
  countIf(toString(properties.outcome) != 'content') / count() AS non_content_share, count() AS loads
FROM events
WHERE timestamp >= now() - INTERVAL 28 DAY AND event = 'screen_load_timed' AND toString(properties.screen) = 'discover' AND {RN} AND {EXCL}
GROUP BY ver, lvl
