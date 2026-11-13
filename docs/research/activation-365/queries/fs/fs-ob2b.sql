-- FS-OB2b - seconds from server sign-up to the first later onboarding step (OAuth)
-- Plan: EXECUTION_PLAN.md §5 FS-OB2b; validation/V1-metrics.md §3.5 FS-OB2b (verbatim)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: {start} = 2026-10-15: 127 OAuth sign-ups, 6 > 10 s (5 in the foreground <= 10 min): google-android 3/81 (max 66 s),
--   apple-ios 2/17 (one 98,915 s overnight gap = backgrounded), google-ios 1/10 (141 s); platform-null 0/19
--   [V1-q22: 6/124]. auth_post_signin_wait.wait_ms: not measurable until T04a.

WITH s AS (SELECT person_id, min(timestamp) AS su_at, any(toString(properties.auth_method)) AS method
           FROM events WHERE timestamp >= {start} - INTERVAL 1 DAY AND event = 'signup_completed' GROUP BY person_id),   -- no {RN}: server event
     c AS (SELECT person_id, argMaxIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL) AS plat,
                  groupArray(timestamp) AS views
           FROM events WHERE timestamp >= {start} AND event = 'onboarding_step_viewed'
             AND toString(properties.step) IN ('heard_about','paywall','notifications','commitment','personalizing') AND {RN} AND {EXCL}
           GROUP BY person_id)
SELECT method, plat, count() AS n, countIf(gap > 10) AS over_10s, countIf(gap > 10 AND gap <= 600) AS over_10s_foreground, max(gap) AS max_s
FROM (SELECT s.method AS method, c.plat AS plat,
             dateDiff('second', s.su_at, arrayMin(arrayFilter(t -> t > s.su_at, c.views))) AS gap
      FROM s INNER JOIN c ON c.person_id = s.person_id WHERE arrayExists(t -> t > s.su_at, c.views))
WHERE method IN ('google','apple')
GROUP BY method, plat
