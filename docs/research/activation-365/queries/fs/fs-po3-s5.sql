-- FS-PO3 / S5 - repeated automatic same-feature paywalls in one session; first-hour >= 2 paywall requests
-- Plan: EXECUTION_PLAN.md §5 FS-PO3 (R3:473-485 + V1 §3.7 surface filter), §1.2 S5 (Q-P8 shape)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: FS-PO3, 60 d, explicit upgrade surfaces excluded: 3.26.0 14 automatic-gate sessions, 9 with a same-feature repeat (64%);
--   3.19.1 5/22; 3.19.0 4/5; 3.21.0 1/5; 3.20.0 1/3; 3.28.0 1/1 [V1-q33 9/14].
--   S5, completers 60 d: 3.26.0 >= 2 any 13/121 (10.7%), >= 2 post-onboarding 8/121 (6.6%), post-onboarding excl. explicit
--   upgrade surfaces 8/121 (android 6/92, ios 2/28); all: any 35/292, post 25/292 [Q-P8 13/121, 8/121; V1-q11 13/120, 8/120].
--   `trigger` / paywall_suppressed: not measurable until T05a/T21 (3.29.0).

-- (1) FS-PO3: sessions with >= 2 automatic same-feature paywall_viewed
SELECT ver, count() AS gate_sessions, countIf(max_same >= 2) AS sessions_repeat_same_feature
FROM (SELECT sid, any(v) AS ver, max(cnt) AS max_same
      FROM (SELECT toString(properties.$session_id) AS sid, any(toString(properties.$app_version)) AS v,
                   toString(properties.feature) AS feat, count() AS cnt
            FROM events
            WHERE event = 'paywall_viewed' AND timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
              AND NOT startsWith(coalesce(toString(properties.surface), ''), 'onboarding')
              AND coalesce(toString(properties.surface), '') NOT IN ('profile_subscriptions_row','profile_pro_banner')  -- until T05a/T21 add `trigger`
              -- after T05a: AND coalesce(toString(properties.trigger), 'auto') = 'auto'
            GROUP BY sid, feat)
      GROUP BY sid)
GROUP BY ver
ORDER BY ver;

-- (2) S5: completers with >= 2 paywall requests in the first hour
SELECT ver, plat, count() AS completers,
  countIf(arrayCount(x -> tupleElement(x, 1) >= t0 - INTERVAL 10 MINUTE AND tupleElement(x, 1) < t0 + INTERVAL 60 MINUTE, pw) >= 2) AS ge2_any,
  countIf(arrayCount(x -> tupleElement(x, 1) >= t0 AND tupleElement(x, 1) < t0 + INTERVAL 60 MINUTE
          AND NOT startsWith(tupleElement(x, 2), 'onboarding'), pw) >= 2) AS ge2_post_onboarding,
  countIf(arrayCount(x -> tupleElement(x, 1) >= t0 AND tupleElement(x, 1) < t0 + INTERVAL 60 MINUTE
          AND NOT startsWith(tupleElement(x, 2), 'onboarding')
          AND tupleElement(x, 2) NOT IN ('profile_subscriptions_row','profile_pro_banner'), pw) >= 2) AS ge2_post_onboarding_auto
FROM (
  SELECT person_id,
    argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
    coalesce(argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL),
             multiIf(toInt(argMin(toString(properties.$app_build), timestamp)) >= 100, 'ios?', 'android?')) AS plat,
    minIf(timestamp, event = 'onboarding_completed') AS t0,
    groupArrayIf(tuple(timestamp, coalesce(toString(properties.surface), '')), event = 'paywall_present_requested') AS pw
  FROM events
  WHERE timestamp >= now() - INTERVAL 61 DAY AND {RN} AND {EXCL}
    AND event IN ('onboarding_completed','paywall_present_requested','Application Opened')
  GROUP BY person_id HAVING t0 >= now() - INTERVAL 60 DAY)
GROUP BY ver, plat
ORDER BY ver, plat
