-- FS-OB2a - Google sign-in outcome / account-step loss
-- Plan: EXECUTION_PLAN.md §5 FS-OB2a; proxy = R5 M-OB2-proxy (R5:213-221) without {RN} on signup_completed + person-level platform
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: proxy, account viewers 2026-10-15..11-13 without signup_completed: android 24/129 (18.6%), ios 6/42 (14.3%),
--   android? 4/5 [V1-q19 10-15..11-12: android 23/111, ios 6/34, platform-null 5/28]. Person-level platform from any event
--   resolves most of V1's platform-null riders into android/ios, so the denominators grow; the android share is within noise.
--   OAuth event form (M-OB2): not measurable until T04a (3.29.0).

-- (1) proxy (works today); {start} = window start, e.g. now() - INTERVAL 28 DAY
WITH su AS (SELECT DISTINCT person_id FROM events
            WHERE timestamp >= {start} - INTERVAL 1 DAY AND event = 'signup_completed')   -- server event: no {RN}
SELECT plat, count() AS viewed_account, countIf(person_id IN (SELECT person_id FROM su)) AS signed_up
FROM (
  SELECT person_id,
    coalesce(argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL),
             multiIf(toInt(argMin(toString(properties.$app_build), timestamp)) >= 100, 'ios?', 'android?')) AS plat,
    countIf(event = 'onboarding_step_viewed' AND toString(properties.step) = 'account') AS acct
  FROM events
  WHERE timestamp >= {start} AND timestamp < {end} AND {RN} AND {EXCL}
  GROUP BY person_id HAVING acct > 0)
GROUP BY plat
ORDER BY plat;

-- (2) M-OB2 after T04a (R5:197-209 with activation_fix_level):
-- SELECT toString(properties.activation_fix_level) AS lvl, toString(properties.$app_version) AS ver,
--   uniqIf(person_id, event = 'auth_oauth_started' AND toString(properties.provider) = 'google') AS started,
--   uniqIf(person_id, event = 'auth_oauth_result' AND toString(properties.provider) = 'google' AND toString(properties.outcome) = 'success') AS succeeded,
--   uniqIf(person_id, event = 'auth_oauth_result' AND toString(properties.provider) = 'google' AND toString(properties.outcome) = 'cancelled') AS cancelled,
--   uniqIf(person_id, event = 'auth_oauth_result' AND toString(properties.provider) = 'google' AND toString(properties.outcome) = 'error') AS errored
-- FROM events WHERE timestamp >= now() - INTERVAL 28 DAY AND {RN} AND {EXCL}
--   AND event IN ('auth_oauth_started','auth_oauth_result') GROUP BY lvl, ver
-- "started, no result" = started - (succeeded + cancelled + errored)
