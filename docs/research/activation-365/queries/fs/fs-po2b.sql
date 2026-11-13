-- FS-PO2b - diagnosis failures: submit -> fail latency, failures per rider, offline after send
-- Plan: EXECUTION_PLAN.md §5 FS-PO2b; R3 (R3:545-550) needs reason/elapsed_s (T17), so the baseline uses the Q8 pairing
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d, pairing (fail - last submit before it): 14 failures; 3.26.0 10 failures / 3 riders, 7 offline=true,
--   p90 71 s, max 141 s; 3.22.0 3/1 and 3.21.0 1/1 at 1 s [R3 Q8/Q9: p90 47 s over all 14, max 141; 10/3; 7/14].
--   The 3.26.0-only p90 is higher than the all-version 47 s because the 4 instant failures are on older versions.
--   reason / elapsed_s: not measurable until T17.

-- (1) pairing baseline (works today)
SELECT ver, count() AS failures, uniq(pid) AS failing_riders, countIf(offline) AS offline_failures,
  quantile(0.9)(gap) AS p90_submit_to_fail_s, max(gap) AS max_s
FROM (
  SELECT f.person_id AS pid, toString(f.properties.$app_version) AS ver, toString(f.properties.offline) = 'true' AS offline,
    dateDiff('second', arrayMax(arrayFilter(t -> t <= f.timestamp, s.subs)), f.timestamp) AS gap
  FROM events AS f
  LEFT JOIN (SELECT person_id AS sp, groupArray(timestamp) AS subs FROM events
             WHERE event = 'diagnostic_submitted' AND timestamp >= now() - INTERVAL 61 DAY GROUP BY person_id) AS s ON s.sp = f.person_id
  WHERE f.event = 'diagnostic_failed' AND f.timestamp >= now() - INTERVAL 60 DAY
    AND f.properties.$lib = 'posthog-react-native'   -- {RN}, qualified for the join
    AND {EXCL})                                      -- write the predicate on f.person_id
GROUP BY ver
ORDER BY ver;

-- (2) after T17 (R3:545-550):
-- SELECT toString(properties.$app_version) AS ver, toString(properties.reason) AS reason, count() AS n, uniq(person_id) AS riders,
--   quantile(0.9)(toFloat(properties.elapsed_s)) AS p90_elapsed
-- FROM events WHERE event = 'diagnostic_failed' AND timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} GROUP BY ver, reason
