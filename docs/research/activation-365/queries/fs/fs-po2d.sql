-- FS-PO2d - first-hour diagnostic_started among completers (research)
-- Plan: EXECUTION_PLAN.md §5 FS-PO2d; validation/V1-metrics.md §3.5 per-completer query (verbatim, + po14_opened_d0 and po2d_diag_1h); replaces the R6 SCOREBOARD joins
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d, 292 completers (3.26.0 121): 3.26.0 29/121 (24%); 3.19.0 2/39, 3.19.1 6/68, 3.21.0 4/33, 3.28.0 3/8; all 45/292
--   [R6-q3 29/117; V1-q30a 29/116]. `entry` split: not measurable until T05b.

SELECT ver, count() AS completers,
  countIf(arrayExists(x -> tupleElement(x, 1) >= t0 AND tupleElement(x, 1) < t0 + INTERVAL 1 HOUR AND tupleElement(x, 2) = '$rageclick', ev)) AS po6_rage_1h,
  countIf(arrayExists(x -> tupleElement(x, 1) >= t0 AND tupleElement(x, 1) < t0 + INTERVAL 1 HOUR AND tupleElement(x, 2) = '$screen'
          AND tupleElement(x, 3) ILIKE '%whats-new%', ev)) AS po11_whatsnew_1h,
  countIf(arrayExists(x -> tupleElement(x, 1) >= t0 + INTERVAL 5 SECOND AND tupleElement(x, 1) < t0 + INTERVAL 1 HOUR
          AND (tupleElement(x, 2) = 'user_signed_in' OR (tupleElement(x, 2) = '$screen'
               AND (tupleElement(x, 3) ILIKE '%sign-in%' OR tupleElement(x, 3) LIKE '/(auth)%'))), ev)) AS po12_signin_1h,
  countIf(arrayExists(x -> tupleElement(x, 1) > t0 + INTERVAL 10 SECOND AND tupleElement(x, 1) < t0 + INTERVAL 7 DAY
          AND tupleElement(x, 2) = 'onboarding_step_viewed' AND tupleElement(x, 4) != 'paywall', ev)) AS po13_onboarding_after,
  countIf(arrayExists(x -> toDate(tupleElement(x, 1)) = toDate(t0) AND tupleElement(x, 1) >= t0 AND tupleElement(x, 2) = '$screen'
          AND tupleElement(x, 3) ILIKE '%start-ride%', ev)) AS po14_opened_d0,
  countIf(arrayExists(x -> toDate(tupleElement(x, 1)) = toDate(t0) AND tupleElement(x, 1) >= t0 AND tupleElement(x, 2) = '$screen'
          AND tupleElement(x, 3) ILIKE '%start-ride%', ev)
          AND NOT arrayExists(x -> toDate(tupleElement(x, 1)) = toDate(t0) AND tupleElement(x, 2) = 'ride_started', ev)) AS po14_opened_no_ride_d0,
  countIf(arrayExists(x -> tupleElement(x, 1) >= t0 AND tupleElement(x, 1) < t0 + INTERVAL 1 HOUR AND tupleElement(x, 2) = 'diagnostic_started', ev)) AS po2d_diag_1h
FROM (
  SELECT person_id,
    argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
    minIf(timestamp, event = 'onboarding_completed') AS t0,
    groupArray(tuple(timestamp, event, coalesce(toString(properties.$screen_name), ''), coalesce(toString(properties.step), ''))) AS ev
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
    AND event IN ('onboarding_completed','$screen','$rageclick','user_signed_in','onboarding_step_viewed','ride_started','diagnostic_started')
  GROUP BY person_id HAVING countIf(event = 'onboarding_completed') > 0)
GROUP BY ver
ORDER BY ver
