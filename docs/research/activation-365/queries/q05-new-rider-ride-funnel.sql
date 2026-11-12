-- Ride lifecycle events for the install cohort (first seen 2026-08-14..11-04). Run 2026-11-12.
WITH c AS (SELECT person_id AS pid, min(timestamp) AS fs FROM events WHERE timestamp >= '2026-04-01' AND properties.$lib = 'posthog-react-native'
  GROUP BY pid HAVING fs >= '2026-08-14' AND fs < '2026-11-05')
SELECT event, if(event = 'ride_completed', toString(properties.below_min_ride), '') AS below_min, count() AS n, uniq(person_id) AS riders
FROM events WHERE timestamp >= '2026-08-14'
  AND event IN ('ride_started','ride_ended','ride_completed','ride_too_short_shown','ride_discarded','ride_abandoned','ride_zero_distance_shown','ride_location_permission_result')
  AND person_id IN (SELECT pid FROM c) AND person_id NOT IN (<excluded test/synthetic person ids: project test-account filter + is_synthetic users; list kept outside the repo>)
  AND timestamp < (SELECT max(fs) FROM c) + INTERVAL 8 DAY
GROUP BY event, below_min ORDER BY riders DESC
