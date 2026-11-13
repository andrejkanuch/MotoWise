-- FS-PO16 - a planned trip missing in My trips (not fixing now; verify if seen again)
-- Plan: EXECUTION_PLAN.md §5A.3 FS-PO16; ledger line in experiments.md
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): no (doc review item 13)
-- run 2026-11-13: 60 d: trip_created 5 events / 5 riders. 'List rendered empty' is not measurable: trips_list_viewed {count} does not
--   exist (proposed only if PO16 is seen again).

-- (1) works today: trip creators and a My-trips screen within 10 min
SELECT ver, count() AS creators,
  countIf(arrayExists(t -> t >= t_trip AND t < t_trip + INTERVAL 10 MINUTE, trips_screens)) AS opened_my_trips_10min
FROM (
  SELECT person_id, argMinIf(toString(properties.$app_version), timestamp, event = 'trip_created') AS ver,
    minIf(timestamp, event = 'trip_created') AS t_trip,
    groupArrayIf(timestamp, event = '$screen' AND toString(properties.$screen_name) = '/(tabs)/(profile)/trips') AS trips_screens
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} AND event IN ('trip_created','$screen')
  GROUP BY person_id HAVING t_trip > toDateTime('2000-01-01'))
GROUP BY ver
-- (2) if re-seen: add trips_list_viewed {count} and count creators whose next list view within 10 min has count = 0.
