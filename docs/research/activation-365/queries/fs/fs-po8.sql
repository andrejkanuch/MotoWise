-- FS-PO8 - app backgrounded <= 2 s after the first Discover view (Garage control)
-- Plan: EXECUTION_PLAN.md §5 FS-PO8; validation/V1-metrics.md §3.6 (verbatim)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: android Discover 43/44 (median 0 s); ios Discover 0/29; platform-null Discover 52/85. Controls: android Garage
--   1/60, ios Garage 0/37 [V1-q36: android 42/43, ios 0/28, null 54/87, Garage 1/59].

SELECT plat, anchor, count() AS persons, countIf(bg_s BETWEEN 0 AND 2) AS bg_2s, quantile(0.5)(bg_s) AS med_bg_s
FROM (
  SELECT person_id, anchor,
    argMaxIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL) AS plat,
    minIf(timestamp, (anchor = 'discover' AND event = 'discover_tab_viewed')
                  OR (anchor = 'garage' AND event = '$screen' AND toString(properties.$screen_name) = '/(tabs)/(garage)')) AS t_d,
    arrayMin(arrayFilter(x -> x >= t_d, groupArrayIf(timestamp, event = 'Application Backgrounded'))) AS t_bg,
    if(t_bg > toDateTime('2000-01-01') AND t_d > toDateTime('2000-01-01'), dateDiff('second', t_d, t_bg), -1) AS bg_s
  FROM events ARRAY JOIN ['discover','garage'] AS anchor
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
    AND event IN ('discover_tab_viewed','Application Backgrounded','$screen')
  GROUP BY person_id, anchor HAVING t_d > toDateTime('2000-01-01'))
GROUP BY plat, anchor
ORDER BY plat, anchor
