-- FS-PO1 - completers with an unlimited_bikes paywall request within 1 day
-- Plan: EXECUTION_PLAN.md §5 FS-PO1; R2 (R2:277-287) rewritten per completer (arrays, no join)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: 3.26.0 7/121 (5.8%), all 7 within 1 h; 3.19.1 9/68; 3.21.0 5/33; 3.19.0 3/39; 3.20.0 3/11; 3.25.0 1/3;
--   3.27.0 0/6; 3.28.0 0/8 [R2-PH4 7/118; V1-q26 7/120]. bike_limit_choice split: not measurable until T22.

SELECT ver, count() AS completers,
  countIf(arrayExists(t -> t >= ob_at AND t < ob_at + INTERVAL 1 DAY, pw)) AS bike_paywall_d0,
  countIf(arrayExists(t -> t >= ob_at AND t < ob_at + INTERVAL 1 HOUR, pw)) AS bike_paywall_1h
FROM (
  SELECT person_id,
    minIf(timestamp, event = 'onboarding_completed') AS ob_at,
    argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
    groupArrayIf(timestamp, event = 'paywall_present_requested' AND toString(properties.feature) = 'unlimited_bikes') AS pw
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} AND event IN ('onboarding_completed','paywall_present_requested')
  GROUP BY person_id HAVING ob_at > toDateTime('2000-01-01'))
GROUP BY ver
ORDER BY ver
