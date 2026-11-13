-- FS-OB1a - auth on the onboarding sign-in screen, no screen in the next 10 s
-- Plan: EXECUTION_PLAN.md §5 FS-OB1a (Q-P7, verbatim) + secondary (>= 2 auths within 2 min, R1 Q11)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: 3.26.0 10 authed on sign-in, 6 stuck; 3.21.0 2/2; every other version 0/0 [Q-P7 6/10, 2/2; V1-q14 same].
--   Secondary: 16 of 77 authed riders had >= 2 auth events within 2 min (3.26.0 6/32) [V1-q14 16/74; R1 Q11 15/72].

WITH p AS (
  SELECT person_id, argMin(toString(properties.$app_version), timestamp) AS ver,
    arraySort(x -> tupleElement(x, 1), groupArrayIf(tuple(timestamp, toString(properties.$screen_name)), event = '$screen')) AS scr,
    arraySort(groupArrayIf(timestamp, event IN ('user_signed_up','user_signed_in'))) AS auths
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
    AND event IN ('$screen','user_signed_up','user_signed_in')
  GROUP BY person_id HAVING length(auths) > 0)
SELECT ver, count() AS authed_riders,
  countIf(arrayExists(a -> tupleElement(arrayLast(s -> tupleElement(s, 1) <= a, scr), 2) = '/(onboarding)/sign-in', auths)) AS riders_auth_on_signin,
  countIf(arrayExists(a -> tupleElement(arrayLast(s -> tupleElement(s, 1) <= a, scr), 2) = '/(onboarding)/sign-in'
    AND NOT arrayExists(s -> tupleElement(s, 1) > a AND tupleElement(s, 1) <= a + INTERVAL 10 SECOND, scr), auths)) AS riders_stuck,
  countIf(arrayExists(i -> i > 1 AND dateDiff('second', auths[i-1], auths[i]) <= 120, arrayEnumerate(auths))) AS ge2_auths_2min
FROM p
GROUP BY ver
ORDER BY ver
-- After T01: add argMin(toString(properties.activation_fix_level), timestamp) AS lvl.
