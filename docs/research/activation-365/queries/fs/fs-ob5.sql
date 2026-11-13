-- FS-OB5 - riders who stop at the account step without trying (proxy)
-- Plan: EXECUTION_PLAN.md §5 FS-OB5; validation/V1-metrics.md §3.4 (verbatim); split after T04a
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: stopped at account, never authed: all 45/462 (9.7%), 3.26.0 18/167, 3.28.0 4/15, 3.19.0 13/105
--   [V1-q25 46/470, 3.26.0 18/166; R6-q8 63/472 used another definition]. Tried-vs-not split (auth_oauth_started,
--   auth_email_submitted): not measurable until T04a.

SELECT ver, count() AS starters,
  countIf(saw_acct AND NOT later AND NOT authed) AS stopped_at_account,
  countIf(NOT done AND last_step = 'paywall') AS left_after_paywall, countIf(NOT done) AS non_completers
FROM (
  SELECT person_id, argMin(toString(properties.$app_version), timestamp) AS ver,
    countIf(event = 'onboarding_completed') > 0 AS done,
    countIf(event = 'onboarding_step_viewed' AND toString(properties.step) = 'account') > 0 AS saw_acct,
    maxIf(timestamp, event = 'onboarding_step_viewed' AND toString(properties.step) IN ('heard_about','notifications','personalizing','paywall','commitment'))
      > minIf(timestamp, event = 'onboarding_step_viewed' AND toString(properties.step) = 'account') AS later,
    countIf(event IN ('user_signed_up','user_signed_in','signup_completed')) > 0 AS authed,
    argMaxIf(toString(properties.step), timestamp, event = 'onboarding_step_viewed') AS last_step
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND ({RN} OR event = 'signup_completed') AND {EXCL}
    AND event IN ('onboarding_started','onboarding_step_viewed','onboarding_completed','user_signed_up','user_signed_in','signup_completed')
  GROUP BY person_id HAVING countIf(event = 'onboarding_started') > 0)
GROUP BY ver
ORDER BY ver
