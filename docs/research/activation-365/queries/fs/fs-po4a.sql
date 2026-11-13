-- FS-PO4a - standstill-first riders who save a real ride within 7 d (complete-window guard)
-- Plan: EXECUTION_PLAN.md §5 FS-PO4a; R4 (R4:376-389) + the complete-7-day-window guard
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 90 d: >= 3.21: 1/14 eligible standstill-first riders saved a real ride within 7 d [V1-q35 1/14; board 1/13; R4 3/20 had no
--   window guard]. `variant` (Exp 1 arm): not measurable until T31.

WITH t AS (
  SELECT person_id AS pid,
    minIf(timestamp, event = 'ride_too_short_shown' AND toString(properties.action) = 'shown' AND toFloat(properties.distance_m) < 10) AS t_ss,
    argMinIf(toString(properties.$app_version), timestamp,
             event = 'ride_too_short_shown' AND toString(properties.action) = 'shown' AND toFloat(properties.distance_m) < 10) AS ver,
    minIf(timestamp, event = 'ride_completed' AND coalesce(toString(properties.below_min_ride), 'false') != 'true') AS t_real
  FROM events
  WHERE timestamp >= now() - INTERVAL 90 DAY AND {RN} AND {EXCL} AND event IN ('ride_too_short_shown','ride_completed')
  GROUP BY pid)
SELECT if(toInt(splitByChar('.', ver)[1]) * 100 + toInt(splitByChar('.', ver)[2]) >= 321, 'ge_3.21', 'lt_3.21') AS build,
  countIf((t_real < toDateTime('2000-01-01') OR t_real > t_ss) AND t_ss < now() - INTERVAL 7 DAY) AS eligible,
  countIf((t_real < toDateTime('2000-01-01') OR t_real > t_ss) AND t_ss < now() - INTERVAL 7 DAY
          AND t_real > t_ss AND t_real < t_ss + INTERVAL 7 DAY) AS real_ride_7d
FROM t
WHERE t_ss > toDateTime('2000-01-01')
GROUP BY build
-- After T31 add argMinIf(toString(properties.variant), ...) AS variant to the CTE and group by it.
