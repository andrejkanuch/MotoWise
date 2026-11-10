-- Flag generated demo accounts as synthetic (users.is_synthetic).
--
-- Synthetic accounts still get their own insights. The flag excludes them from
-- other riders' baselines, metrics and backfill progress, and the stats sweep
-- processes them last. Owner-run; see docs/runbooks/rider-insights-data.md.
--
-- STEP 1 (read only): review the candidates. A generated ride has all of:
--   * rides.region set (no code in the repo writes it; an out-of-band generator does),
--   * a start time on a whole second (the recorder writes sub-second timestamps),
--   * no waypoints.
-- On 2026-11-09 this matched 14 accounts, every one of whose rides had the
-- traits and none of which had an ordinary ride. Confirm each account (email,
-- age, ride counts) before flagging it. An account with ordinary rides as well
-- (normal_rides > 0) is a real rider and must not be flagged.
--
-- STEP 2: paste the confirmed ids into the ARRAY[...] below and run that block.
-- With the list empty, as committed, it updates nothing.

-- ---------------------------------------------------------------------------
-- STEP 1: candidates
-- ---------------------------------------------------------------------------
WITH ride_traits AS (
  SELECT
    r.user_id,
    r.region IS NOT NULL AS has_region,
    extract(microseconds FROM r.started_at)::bigint % 1000000 = 0 AS whole_second_start,
    EXISTS (SELECT 1 FROM public.ride_waypoints w WHERE w.ride_id = r.id) AS has_waypoints,
    r.distance_m
  FROM public.rides r
  WHERE r.status = 'completed' AND r.deleted_at IS NULL
),
per_user AS (
  SELECT
    t.user_id,
    count(*) FILTER (WHERE t.has_region AND t.whole_second_start AND NOT t.has_waypoints) AS generated_rides,
    count(*) FILTER (WHERE NOT (t.has_region AND t.whole_second_start AND NOT t.has_waypoints)) AS normal_rides,
    round(avg(t.distance_m) / 1000.0, 1) AS avg_km
  FROM ride_traits t
  GROUP BY t.user_id
)
SELECT
  u.id,
  u.email,
  u.created_at::date AS signed_up,
  u.is_synthetic AS already_flagged,
  p.generated_rides,
  p.normal_rides,
  p.avg_km
FROM per_user p
JOIN public.users u ON u.id = p.user_id
WHERE p.generated_rides > 0
ORDER BY p.normal_rides, p.generated_rides DESC;

-- ---------------------------------------------------------------------------
-- STEP 2: flag the confirmed accounts, and only those
-- ---------------------------------------------------------------------------
-- Paste ids as quoted uuids, comma-separated, e.g.
--   ARRAY['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']::uuid[]
-- RETURNING lists every account this run flagged.
BEGIN;

UPDATE public.users u
SET is_synthetic = true
WHERE u.id = ANY (ARRAY[
  -- confirmed ids go here
]::uuid[])
  AND NOT u.is_synthetic
RETURNING u.id, u.email;

COMMIT;

-- Afterwards: every flagged account.
-- SELECT id, email FROM public.users WHERE is_synthetic ORDER BY email;
