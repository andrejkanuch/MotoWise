-- FS-PO5 - ride HUD opened without any ride start (regression guard, alert)
-- Plan: EXECUTION_PLAN.md §5 FS-PO5; verbatim R4 (R4:342-352)
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: 60 d: 0 HUD views without any start, every version [R4 Q-R4-05 0]. Stale > 3 h: 9 views (3.21.0 5, 3.26.0 2, 3.27.0 2).

SELECT ver,
  countIf(last_rs < toDateTime('2000-01-01 00:00:00')) AS hud_without_any_start,
  countIf(last_rs >= toDateTime('2000-01-01 00:00:00') AND dateDiff('second', last_rs, timestamp) > 3 * 3600) AS hud_stale_gt3h
FROM (SELECT timestamp, event, toString(properties.$app_version) AS ver, toString(properties.$screen_name) AS sn,
        max(if(event = 'ride_started', timestamp, toDateTime('1970-01-01 00:00:00')))
          OVER (PARTITION BY person_id ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS last_rs
      FROM events
      WHERE timestamp >= now() - INTERVAL 60 DAY AND event IN ('ride_started','$screen') AND {RN} AND {EXCL})
WHERE event = '$screen' AND sn = '/(modals)/ride-hud'
GROUP BY ver
ORDER BY ver
