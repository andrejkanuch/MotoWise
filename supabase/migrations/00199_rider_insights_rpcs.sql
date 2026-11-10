-- Migration: 00199_rider_insights_rpcs
-- Rider insights: the read RPCs behind every insight and the legacy ride totals.
--
-- WHAT IT ADDS (all read-only, all over rides + ride_stats + ride_tracks; none
-- reads ride_rollups or ride_records)
--   * ride_is_qualifying(rides): whether a ride counts toward milestones,
--     records and insights. The SQL twin of isQualifyingRide() in
--     packages/types/src/ride-metrics/qualifying.ts; the two must change together
--     (supabase/checks/rider-insights-rpcs.sql runs that file's test cases).
--   * ride_duration_s(rides): ended minus started minus manual and auto pauses,
--     in whole seconds, never below 0 (computeMovingTimeS in the API).
--   * rider_insights_season(user, from, to, groups, tolerance): one jsonb with
--     the free blocks and the requested detail groups. Shape in its header.
--   * rider_ride_overview(user, tz) and rider_personal_records(user): today's
--     RideOverview and RideRecord GraphQL shapes, computed from rides and
--     ride_stats with day, week and month buckets in the given zone.
--   * ride_new_roads(user, ride): metres of a ride on roads the rider had not
--     ridden before it.
--
-- ACCESS
--   Every function is SECURITY DEFINER with an empty search_path, every object
--   (PostGIS included) is schema-qualified, and EXECUTE is revoked from PUBLIC,
--   anon and authenticated by name (Supabase's default privileges grant it to
--   anon and authenticated explicitly) and granted to service_role only. The API
--   calls them with the service-role client after its own tier check, so Pro
--   detail never reaches a client that the API did not clear. None takes the
--   caller's identity: p_user_id is trusted, which is why no client may call them.
--
-- SYNTHETIC ACCOUNTS: every read is about one rider's own rides, and a synthetic
--   rider's rides count for that rider. Nothing here mixes riders.
--
-- PREREQUISITES
--   * 00197 applied and verified (ride_stats, ride_tracks, ref_* tables,
--     users.is_synthetic).
--   * The stats backfill at or above 99% of real riders' rides: before that most
--     rides have no ride_stats row and the insight groups read as computing.
--
-- DEPLOY ORDER: apply and verify BEFORE the API that reads these functions
-- deploys (the API deploys on merge). Nothing calls them until then.
-- Apply as ONE statement batch (one Management API call) with this leading
-- comment block stripped, record version 00199 in
-- supabase_migrations.schema_migrations, then run the footer queries.
--
-- ROLLBACK (nothing reads these functions until the API that uses them deploys):
--   DROP FUNCTION public.rider_insights_season(uuid, date, date, text[], double precision),
--     public.rider_ride_overview(uuid, text),
--     public.rider_personal_records(uuid),
--     public.ride_new_roads(uuid, uuid),
--     public.ride_is_qualifying(public.rides),
--     public.ride_duration_s(public.rides);

BEGIN;

-- ============================================================
-- 1. Per-ride predicates
-- ============================================================

-- Ended minus started minus manual and auto pauses, whole seconds, never below 0.
-- Timestamps are cut to milliseconds first, as JavaScript's Date.parse does.
CREATE FUNCTION public.ride_duration_s(p_ride public.rides)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT GREATEST(0,
    floor(extract(epoch FROM date_trunc('milliseconds', p_ride.ended_at))
          - extract(epoch FROM date_trunc('milliseconds', p_ride.started_at)))::integer
    - COALESCE(p_ride.paused_duration_s, 0)
    - COALESCE(p_ride.auto_paused_duration_s, 0))
$$;

-- Whether a ride counts toward ride milestones, records and insights: completed,
-- not deleted, not ended by the server (auto_ended_reason null, so rides the app
-- auto-ends still count), at least 1 km, and at least 180 s of duration after
-- pauses (the timestamp span, not GPS moving time). Unknown distance or a
-- missing timestamp never counts. Mirrors isQualifyingRide() in packages/types.
CREATE FUNCTION public.ride_is_qualifying(p_ride public.rides)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    p_ride.status = 'completed'
    AND p_ride.deleted_at IS NULL
    AND p_ride.auto_ended_reason IS NULL
    AND p_ride.distance_m >= 1000
    AND p_ride.started_at IS NOT NULL
    AND p_ride.ended_at IS NOT NULL
    AND public.ride_duration_s(p_ride) >= 180,
    false)
$$;

-- ============================================================
-- 2. New road
-- ============================================================

-- Metres of one ride on roads the rider had not ridden before it, or NULL when
-- the ride is not this rider's completed live ride or has no cells yet (stats
-- pending, or no geometry). 0 is a computed ride entirely on known roads.
--
-- Rule: ride_stats.cells holds the distinct H3 resolution 9 cells the ride's
-- 20 m resampled track touches. A cell is new for the ride when none of the
-- rider's earlier completed live rides (ordered by started_at, then id) has it.
-- Cells are counted, not measured, so the ride's distance is split evenly over
-- its cells: new road = distance_m x new cells / all cells, rounded to the
-- metre. A ride that repeats an earlier one has no new cell and returns 0.
CREATE FUNCTION public.ride_new_roads(p_user_id uuid, p_ride_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH me AS (
    SELECT r.id, r.started_at, s.cells, s.distance_m
    FROM public.rides r
    JOIN public.ride_stats s ON s.ride_id = r.id
    WHERE r.id = p_ride_id
      AND r.user_id = p_user_id
      AND r.status = 'completed'
      AND r.deleted_at IS NULL
      AND s.cells IS NOT NULL
  ),
  earlier AS (
    SELECT DISTINCT c.cell
    FROM me
    JOIN public.rides r
      ON r.user_id = p_user_id
     AND r.status = 'completed'
     AND r.deleted_at IS NULL
     AND (r.started_at, r.id) < (me.started_at, me.id)
    JOIN public.ride_stats s ON s.ride_id = r.id AND s.cells IS NOT NULL
    CROSS JOIN LATERAL unnest(s.cells) AS c (cell)
  )
  SELECT CASE
    WHEN cardinality(me.cells) = 0 THEN 0
    ELSE round(me.distance_m::numeric
               * (SELECT count(*) FROM unnest(me.cells) AS mc (cell)
                  WHERE NOT EXISTS (SELECT 1 FROM earlier e WHERE e.cell = mc.cell))
               / cardinality(me.cells))::integer
  END
  FROM me
$$;

-- ============================================================
-- 3. The season read
-- ============================================================

-- rider_insights_season(p_user_id, p_from, p_to, p_groups, p_tolerance)
--
-- p_from / p_to: inclusive local dates of the season (the calendar year in the
--   rider's zone, chosen by the API). A ride belongs to the season by its
--   ride_stats.local_date (its own zone), or its UTC start date while it has no
--   ride_stats row.
-- p_groups: detail groups to compute, any of territory, road_character, rhythm,
--   best_rides, bikes, countries. NULL or empty: none, and "groups" is {}.
--   Unknown names are ignored. A group not asked for is not computed.
-- p_tolerance: simplification tolerance in metres for the region routes
--   (Douglas-Peucker on lon/lat, converted at 111,320 m per degree).
--
-- Per ride: distance_m is ride_stats.distance_m, else rides.distance_m, else
--   0; climb is ride_stats.climb_m (corrected), else rides.elevation_gain.
--
-- Which rides feed what:
--   * Free blocks (totals, ribbon, regions, latest_ride, bikes, countries, cost)
--     use every completed live ride in the window, rides without geometry or
--     without a ride_stats row included.
--   * Pro groups (territory, road_character, rhythm, best_rides) and
--     longest_ride use the qualifying rides (ride_is_qualifying) in the window.
--
-- Returns (keys always present; numbers are JSON numbers; dates 'YYYY-MM-DD'):
-- {
--   "window": { "from": date, "to": date },
--   "totals": { "rides": int, "distance_m": int, "countries": int },
--       countries: distinct ISO codes across the season's ride_stats.countries.
--   "coverage": {
--     "rides": int,              completed live rides in the window
--     "qualifying_rides": int,   of those, qualifying
--     "pending_rides": int,      rides with no ride_stats row at all
--     "pending_recent_rides": int, of those, rides that ended within the last
--                                24 hours (their compute is still due; an older
--                                one is a compute that keeps failing)
--     "rides_with_bike": int,
--     "qualifying": {            counts over the qualifying rides
--       "with_stats", "with_route" (waypoints or polyline), "with_waypoints",
--       "with_bands" (band_km present), "with_lean" (lean_bands present),
--       "with_moving_time": int
--     }
--   },
--   "latest_ride": null | { "ride_id": uuid, "local_date": date, "distance_m": int,
--       "new_countries": [iso_a2] }   countries this ride added to the season
--       (in none of the season's earlier rides), in the ride's order.
--   "longest_ride": null | { "ride_id", "name", "local_date", "distance_m",
--       "moving_time_s" (null without waypoints), "duration_s",
--       "start_place", "end_place" }   longest qualifying ride.
--   "ribbon": [ { "week_start": date (Monday), "rides": int, "distance_m": int } ]
--       weeks with at least one ride, oldest first.
--   "regions": [ { "key": "<iso_a2>.<admin1_code>", "iso_a2", "name" (null if not
--       in ref_regions), "rides": int, "distance_m": int,
--       "bounds": [west, south, east, north] | null,
--       "routes": [encoded polyline (precision 5) per ride with a track,
--                  oldest first] } ]
--       At most 4, most distance first: element 0 is the main region, the rest
--       are the other regions for the tiles. Rides with no start region are left
--       out.
--   "cost_per_km": [ { "currency", "spend": numeric, "expense_count": int,
--       "distance_m": int, "distance_source": "odometer" | "tracked" | "mixed",
--       "cost_per_km": numeric (4 dp) | null } ]
--       One row per currency, most spend first. Spend: the window's live fuel
--       and maintenance expenses. Distance: per bike with spend in that
--       currency, the odometer change over the window when the bike has a
--       reading at both ends (the latest reading on or before p_from, else the
--       first in the window, and the last reading in the window, later and
--       higher), converted from the bike's distance_unit; otherwise the bike's
--       tracked ride distance in the window. distance_source says which; mixed
--       when the currency's bikes differ. cost_per_km is null at 0 distance.
--   "groups": { only the requested keys:
--     "territory": {
--       "explored_cells": int,     distinct H3 res 9 cells of the qualifying rides
--       "explored_km2": numeric,   explored_cells x 0.1053325 km2 (the average
--                                  res 9 cell area), 2 dp
--       "routed_m": int,           distance of the qualifying rides with cells
--       "new_road_m": int,         their new road (ride_new_roads' rule, each
--                                  cell's first visit across all the rider's
--                                  rides up to p_to)
--       "new_road_share": numeric | null   new_road_m / routed_m, 4 dp
--       "furthest": null | { "ride_id", "name" (null if unnamed), "local_date", "distance_m", "lat", "lng" }
--           the route vertex furthest from home among the qualifying rides.
--           Home is the rider's most common start cell (rides up to p_to; ties
--           to the most recent), placed at the start of the latest ride from
--           that cell that has a track. The vertex is picked on an
--           equirectangular projection at home's latitude; distance_m is
--           geodesic. lat/lng rounded to 6 dp.
--     },
--     "road_character": {
--       "band_km": { "straight", "sweeping", "twisty", "tight": numeric (3 dp) },
--       "routed_km": numeric (3 dp), "bends_count": int,
--       "bends_per_10km": numeric (2 dp) | null,
--       "rides_with_bands": int, "rides_with_lean": int,
--       "twistiest": [ride x3], "straightest": [ride x3]
--           ride = { "ride_id", "name", "local_date", "distance_m",
--                    "bends_per_10km" }, by ride bends_per_km
--       "lean": null | { "corners": int, "under20", "from20to30", "from30to40",
--                        "from40": share 0-1 (4 dp), corner-weighted }
--     },
--     "rhythm": {
--       "grid": 7 x 4 ride counts, rows Monday..Sunday (ride_stats.local_dow),
--               columns morning 05-11, afternoon 12-16, evening 17-21,
--               night 22-04 (ride_stats.local_start_hour),
--       "rides": int (qualifying rides with stats), "weekend_rides": int,
--       "weekend_share": numeric (4 dp) | null,
--       "median_distance_m": numeric | null,
--       "median_moving_time_s": numeric | null, "rides_with_moving_time": int
--     },
--     "best_rides": {
--       "count": int (qualifying rides),
--       "by_distance", "by_climb", "by_bends": [ride x10 at most]
--           ride = { "ride_id", "name", "local_date", "distance_m", "climb_m",
--                    "bends_per_10km", "moving_time_s" }; by_climb only rides
--           with a climb, by_bends only rides with bends; ties to the earlier.
--     },
--     "bikes": { "items": [ { "motorcycle_id": uuid | null (null = Unassigned),
--         "name": nickname, else make and model | null, "rides": int,
--         "distance_m": int, "moving_time_s": int } ] }
--         every ride; moving time is ride_stats.moving_time_s, else the
--         timestamps minus pauses. Most distance first, Unassigned last.
--     "countries": { "items": [ { "iso_a2", "name", "first_date", "first_ride_id",
--         "rides": int, "distance_m": int } ] }  in order of first entry.
--         A one-country ride gives it its whole distance; a ride through
--         several splits its distance by the length of its track inside each
--         country's published border (ref_country_parts kind = 'border'),
--         evenly when it has no track.
--   }
-- }
CREATE FUNCTION public.rider_insights_season(
  p_user_id uuid,
  p_from date,
  p_to date,
  p_groups text[] DEFAULT '{}',
  p_tolerance double precision DEFAULT 25
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- One statement: the season's rides are read once (sr), and each detail
  -- group sits in a CASE branch whose subqueries run only when it is requested.
  WITH sr AS MATERIALIZED (
    -- The started_at range is a superset of the window (a local date is at most
    -- 14 h from the UTC one), so the rides index bounds the scan.
    SELECT
      r.id AS ride_id,
      r.started_at,
      r.ended_at,
      r.name,
      r.motorcycle_id,
      COALESCE(s.distance_m, r.distance_m, 0) AS distance_m,
      public.ride_duration_s(r) AS duration_s,
      public.ride_is_qualifying(r) AS qualifying,
      s.ride_id IS NOT NULL AS has_stats,
      s.input_source,
      COALESCE(s.local_date, (r.started_at AT TIME ZONE 'UTC')::date) AS local_date,
      s.local_dow,
      s.local_start_hour,
      s.moving_time_s,
      COALESCE(s.climb_m, round(r.elevation_gain)::integer) AS climb_m,
      s.bends_count,
      s.bends_per_km,
      s.band_km,
      s.lean_bands,
      s.countries,
      s.start_region,
      s.start_place,
      s.end_place
    FROM public.rides r
    LEFT JOIN public.ride_stats s ON s.ride_id = r.id
    WHERE r.user_id = p_user_id
      AND r.status = 'completed'
      AND r.deleted_at IS NULL
      AND r.started_at >= (p_from - 1)::timestamp AT TIME ZONE 'UTC'
      AND r.started_at < (p_to + 2)::timestamp AT TIME ZONE 'UTC'
      AND COALESCE(s.local_date, (r.started_at AT TIME ZONE 'UTC')::date) BETWEEN p_from AND p_to
  ),
  q AS MATERIALIZED (
    SELECT * FROM sr WHERE sr.qualifying
  ),

  -- ---- Regions ----------------------------------------------------------
  reg AS (
    SELECT sr.start_region AS key, count(*) AS rides, sum(sr.distance_m) AS distance_m
    FROM sr
    WHERE sr.start_region IS NOT NULL
    GROUP BY sr.start_region
    ORDER BY sum(sr.distance_m) DESC, sr.start_region
    LIMIT 4
  ),

  -- ---- Cost per km ------------------------------------------------------
  spend AS (
    SELECT e.motorcycle_id, e.currency, sum(e.amount) AS amount, count(*) AS n
    FROM public.expenses e
    WHERE e.user_id = p_user_id
      AND e.deleted_at IS NULL
      AND e.category IN ('fuel', 'maintenance')
      AND e.date BETWEEN p_from AND p_to
    GROUP BY e.motorcycle_id, e.currency
  ),
  bike_distance AS (
    SELECT
      b.motorcycle_id,
      CASE
        WHEN st.value IS NOT NULL AND en.value IS NOT NULL
             AND en.recorded_at > st.recorded_at AND en.value > st.value
        THEN round((en.value - st.value)
                   * CASE WHEN m.distance_unit = 'mi' THEN 1609.344 ELSE 1000 END)
      END AS odometer_m,
      (SELECT COALESCE(sum(sr.distance_m), 0) FROM sr WHERE sr.motorcycle_id = b.motorcycle_id) AS tracked_m
    FROM (SELECT DISTINCT spend.motorcycle_id FROM spend) b
    -- Owner check: rides.motorcycle_id is not ownership-checked on UPDATE, so
    -- every bike lookup here also requires the bike to be the rider's own.
    LEFT JOIN public.motorcycles m ON m.id = b.motorcycle_id AND m.user_id = p_user_id
    -- Start: the latest reading on or before the window's first day, else the
    -- first reading inside the window.
    LEFT JOIN LATERAL (
      SELECT o.value, o.recorded_at FROM public.odometer_readings o
      WHERE o.motorcycle_id = b.motorcycle_id AND o.user_id = p_user_id
        AND o.recorded_at < (p_to + 1)::timestamp AT TIME ZONE 'UTC'
      ORDER BY (o.recorded_at < p_from::timestamp AT TIME ZONE 'UTC') DESC,
               CASE WHEN o.recorded_at < p_from::timestamp AT TIME ZONE 'UTC'
                    THEN -extract(epoch FROM o.recorded_at)
                    ELSE extract(epoch FROM o.recorded_at) END
      LIMIT 1
    ) st ON true
    -- End: the last reading inside the window.
    LEFT JOIN LATERAL (
      SELECT o.value, o.recorded_at FROM public.odometer_readings o
      WHERE o.motorcycle_id = b.motorcycle_id AND o.user_id = p_user_id
        AND o.recorded_at >= p_from::timestamp AT TIME ZONE 'UTC'
        AND o.recorded_at < (p_to + 1)::timestamp AT TIME ZONE 'UTC'
      ORDER BY o.recorded_at DESC
      LIMIT 1
    ) en ON true
  ),
  cur AS (
    SELECT
      s.currency,
      sum(s.amount) AS spend,
      sum(s.n) AS n,
      sum(COALESCE(b.odometer_m, b.tracked_m)) AS distance_m,
      CASE
        WHEN bool_and(b.odometer_m IS NOT NULL) THEN 'odometer'
        WHEN bool_and(b.odometer_m IS NULL) THEN 'tracked'
        ELSE 'mixed'
      END AS source
    FROM spend s
    JOIN bike_distance b ON b.motorcycle_id = s.motorcycle_id
    GROUP BY s.currency
  ),

  -- ---- Territory --------------------------------------------------------
  -- Every completed live ride of the rider up to the window's end with cells,
  -- in first-visit order (started_at, then id); in_season marks the season's
  -- qualifying rides.
  mine AS MATERIALIZED (
    SELECT r.id, s.cells, s.distance_m, s.start_cell, r.started_at,
           row_number() OVER (ORDER BY r.started_at, r.id) AS seq,
           q.ride_id IS NOT NULL AS in_season
    FROM public.rides r
    JOIN public.ride_stats s ON s.ride_id = r.id
    LEFT JOIN q ON q.ride_id = r.id
    WHERE r.user_id = p_user_id
      AND r.status = 'completed'
      AND r.deleted_at IS NULL
      AND r.started_at < (p_to + 2)::timestamp AT TIME ZONE 'UTC'
      AND s.local_date <= p_to
  ),
  -- One pass over the cells: each cell's first visit, and whether a season
  -- ride touched it.
  cell_visit AS MATERIALIZED (
    SELECT c.cell, min(m.seq) AS seq, bool_or(m.in_season) AS in_season
    FROM mine m CROSS JOIN LATERAL unnest(m.cells) AS c (cell)
    GROUP BY c.cell
  ),
  new_cells AS (
    SELECT cv.seq, count(*) AS n FROM cell_visit cv GROUP BY cv.seq
  ),
  territory_rides AS (
    SELECT m.distance_m, cardinality(m.cells) AS total, COALESCE(nc.n, 0) AS new_n
    FROM mine m
    LEFT JOIN new_cells nc ON nc.seq = m.seq
    WHERE m.in_season AND m.cells IS NOT NULL
  ),
  home AS (
    -- The most common start cell (ties to the most recent), placed at the start
    -- of the latest ride from it that has a track.
    SELECT public.ST_StartPoint(t.route) AS pt,
           cos(radians(public.ST_Y(public.ST_StartPoint(t.route)))) AS k
    FROM mine m
    JOIN public.ride_tracks t ON t.ride_id = m.id
    WHERE m.start_cell = (
      SELECT m2.start_cell FROM mine m2
      WHERE m2.start_cell IS NOT NULL
      GROUP BY m2.start_cell
      ORDER BY count(*) DESC, max(m2.started_at) DESC, m2.start_cell
      LIMIT 1)
    ORDER BY m.started_at DESC, m.id DESC
    LIMIT 1
  ),
  -- Each ride's furthest vertex on an equirectangular projection at home's
  -- latitude (longitude scaled by k); the geodesic distance is measured for the
  -- winner only.
  far_line AS (
    SELECT q.ride_id, q.name, q.local_date,
           public.ST_LongestLine(public.ST_Scale(h.pt, h.k, 1), public.ST_Scale(t.route, h.k, 1)) AS line
    FROM q
    JOIN public.ride_tracks t ON t.ride_id = q.ride_id
    CROSS JOIN home h
  ),
  furthest AS (
    SELECT f.ride_id, f.name, f.local_date, x.pt,
           public.ST_Distance(x.pt::public.geography, h.pt::public.geography) AS d
    FROM (
      SELECT fl.* FROM far_line fl
      ORDER BY public.ST_Length(fl.line) DESC, fl.local_date, fl.ride_id
      LIMIT 1
    ) f
    CROSS JOIN home h
    CROSS JOIN LATERAL (
      SELECT public.ST_SetSRID(public.ST_MakePoint(
               public.ST_X(public.ST_EndPoint(f.line)) / h.k, public.ST_Y(public.ST_EndPoint(f.line))), 4326) AS pt
    ) x
  ),

  -- ---- Road character ---------------------------------------------------
  banded AS (
    SELECT (q.band_km ->> 'straight')::numeric AS straight,
           (q.band_km ->> 'sweeping')::numeric AS sweeping,
           (q.band_km ->> 'twisty')::numeric AS twisty,
           (q.band_km ->> 'tight')::numeric AS tight,
           q.bends_count
    FROM q WHERE q.band_km IS NOT NULL
  ),
  band_sum AS (
    SELECT COALESCE(sum(b.straight), 0) AS straight, COALESCE(sum(b.sweeping), 0) AS sweeping,
           COALESCE(sum(b.twisty), 0) AS twisty, COALESCE(sum(b.tight), 0) AS tight,
           COALESCE(sum(b.bends_count), 0) AS bends, count(*) AS n
    FROM banded b
  ),
  lean AS (
    SELECT sum((q.lean_bands ->> 'corners')::numeric) AS corners,
           sum((q.lean_bands ->> 'under20')::numeric * (q.lean_bands ->> 'corners')::numeric) AS u20,
           sum((q.lean_bands ->> 'from20to30')::numeric * (q.lean_bands ->> 'corners')::numeric) AS f20,
           sum((q.lean_bands ->> 'from30to40')::numeric * (q.lean_bands ->> 'corners')::numeric) AS f30,
           sum((q.lean_bands ->> 'from40')::numeric * (q.lean_bands ->> 'corners')::numeric) AS f40,
           count(*) AS n
    FROM q WHERE q.lean_bands IS NOT NULL
  ),
  bend_rank AS (
    SELECT q.*,
           row_number() OVER (ORDER BY q.bends_per_km DESC, q.started_at, q.ride_id) AS twisty_rank,
           row_number() OVER (ORDER BY q.bends_per_km ASC, q.started_at, q.ride_id) AS straight_rank
    FROM q WHERE q.bends_per_km IS NOT NULL
  ),

  -- ---- Rhythm -----------------------------------------------------------
  rhythm_rides AS (
    SELECT q.*,
           CASE
             WHEN q.local_start_hour BETWEEN 5 AND 11 THEN 0
             WHEN q.local_start_hour BETWEEN 12 AND 16 THEN 1
             WHEN q.local_start_hour BETWEEN 17 AND 21 THEN 2
             ELSE 3
           END AS part
    FROM q WHERE q.has_stats
  ),

  -- ---- Countries --------------------------------------------------------
  ride_country AS (
    SELECT sr.ride_id, sr.started_at, sr.local_date, sr.distance_m, c.iso,
           cardinality(sr.countries) AS n
    FROM sr CROSS JOIN LATERAL unnest(sr.countries) AS c (iso)
    WHERE sr.countries IS NOT NULL
  ),
  -- Track length inside each country's published border, for rides through
  -- more than one country.
  inside AS MATERIALIZED (
    SELECT rc.ride_id, rc.iso,
           (SELECT sum(public.ST_Length(public.ST_Intersection(t.route, p.geom)::public.geography))
            FROM public.ride_tracks t
            JOIN public.ref_country_parts p
              ON p.kind = 'border' AND p.iso_a2 = rc.iso
             AND p.geom OPERATOR(public.&&) t.route
             AND public.ST_Intersects(p.geom, t.route)
            WHERE t.ride_id = rc.ride_id) AS len
    FROM ride_country rc WHERE rc.n > 1
  ),
  inside_total AS (
    SELECT i.ride_id, sum(i.len) AS len FROM inside i GROUP BY i.ride_id
  ),
  per_country AS (
    SELECT rc.iso,
           (array_agg(rc.local_date ORDER BY rc.started_at, rc.ride_id))[1] AS first_date,
           (array_agg(rc.ride_id ORDER BY rc.started_at, rc.ride_id))[1] AS first_ride_id,
           min(rc.started_at) AS first_at,
           count(*) AS rides,
           round(sum(CASE
             WHEN rc.n = 1 THEN rc.distance_m::numeric
             WHEN COALESCE(it.len, 0) > 0 THEN rc.distance_m * COALESCE(i.len, 0)::numeric / it.len::numeric
             ELSE rc.distance_m::numeric / rc.n
           END))::integer AS distance_m
    FROM ride_country rc
    LEFT JOIN inside i ON i.ride_id = rc.ride_id AND i.iso = rc.iso
    LEFT JOIN inside_total it ON it.ride_id = rc.ride_id
    GROUP BY rc.iso
  )

  SELECT jsonb_build_object(
    'window', jsonb_build_object('from', p_from, 'to', p_to),

    'totals', jsonb_build_object(
      'rides', (SELECT count(*) FROM sr),
      'distance_m', (SELECT COALESCE(sum(sr.distance_m), 0) FROM sr),
      'countries', (SELECT count(DISTINCT c) FROM sr CROSS JOIN LATERAL unnest(sr.countries) c)),

    'coverage', (
      SELECT jsonb_build_object(
        'rides', count(*),
        'qualifying_rides', count(*) FILTER (WHERE sr.qualifying),
        'pending_rides', count(*) FILTER (WHERE NOT sr.has_stats),
        'pending_recent_rides', count(*) FILTER (
          WHERE NOT sr.has_stats AND sr.ended_at > now() - interval '24 hours'),
        'rides_with_bike', count(*) FILTER (WHERE sr.motorcycle_id IS NOT NULL),
        'qualifying', jsonb_build_object(
          'with_stats', count(*) FILTER (WHERE sr.qualifying AND sr.has_stats),
          'with_route', count(*) FILTER (WHERE sr.qualifying AND sr.input_source IN ('waypoints', 'polyline')),
          'with_waypoints', count(*) FILTER (WHERE sr.qualifying AND sr.input_source = 'waypoints'),
          'with_bands', count(*) FILTER (WHERE sr.qualifying AND sr.band_km IS NOT NULL),
          'with_lean', count(*) FILTER (WHERE sr.qualifying AND sr.lean_bands IS NOT NULL),
          'with_moving_time', count(*) FILTER (WHERE sr.qualifying AND sr.moving_time_s IS NOT NULL)))
      FROM sr),

    'latest_ride', (
      SELECT jsonb_build_object(
        'ride_id', l.ride_id,
        'local_date', l.local_date,
        'distance_m', l.distance_m,
        'new_countries', COALESCE((
          SELECT jsonb_agg(c.iso ORDER BY c.ord)
          FROM unnest(l.countries) WITH ORDINALITY AS c (iso, ord)
          WHERE NOT EXISTS (
            SELECT 1 FROM sr e
            WHERE (e.started_at, e.ride_id) < (l.started_at, l.ride_id)
              AND c.iso = ANY (e.countries))), '[]'::jsonb))
      FROM (SELECT * FROM sr ORDER BY sr.started_at DESC, sr.ride_id DESC LIMIT 1) l),

    'longest_ride', (
      SELECT jsonb_build_object(
        'ride_id', l.ride_id, 'name', l.name, 'local_date', l.local_date,
        'distance_m', l.distance_m, 'moving_time_s', l.moving_time_s,
        'duration_s', l.duration_s, 'start_place', l.start_place, 'end_place', l.end_place)
      FROM (SELECT * FROM q ORDER BY q.distance_m DESC, q.started_at, q.ride_id LIMIT 1) l),

    'ribbon', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('week_start', w.week_start, 'rides', w.rides,
                                          'distance_m', w.distance_m) ORDER BY w.week_start)
      FROM (
        SELECT date_trunc('week', sr.local_date)::date AS week_start,
               count(*) AS rides, sum(sr.distance_m) AS distance_m
        FROM sr GROUP BY 1
      ) w), '[]'::jsonb),

    'regions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'key', g.key,
          'iso_a2', split_part(g.key, '.', 1),
          'name', rr.name,
          'rides', g.rides,
          'distance_m', g.distance_m,
          'bounds', x.bounds,
          'routes', COALESCE(x.routes, '[]'::jsonb))
        ORDER BY g.distance_m DESC, g.key)
      FROM reg g
      LEFT JOIN public.ref_regions rr
        ON rr.iso_a2 = split_part(g.key, '.', 1)
       AND rr.admin1_code = substr(g.key, strpos(g.key, '.') + 1)
      CROSS JOIN LATERAL (
        SELECT
          CASE WHEN count(t.route) = 0 THEN NULL ELSE jsonb_build_array(
            min(public.ST_XMin(t.route::public.box3d)), min(public.ST_YMin(t.route::public.box3d)),
            max(public.ST_XMax(t.route::public.box3d)), max(public.ST_YMax(t.route::public.box3d)))
          END AS bounds,
          jsonb_agg(public.ST_AsEncodedPolyline(
                      public.ST_Simplify(t.route, GREATEST(COALESCE(p_tolerance, 0), 0) / 111320.0, true), 5)
                    ORDER BY sr.started_at, sr.ride_id) AS routes
        FROM sr
        JOIN public.ride_tracks t ON t.ride_id = sr.ride_id
        WHERE sr.start_region = g.key
      ) x), '[]'::jsonb),

    'cost_per_km', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'currency', c.currency,
          'spend', c.spend,
          'expense_count', c.n,
          'distance_m', c.distance_m,
          'distance_source', c.source,
          'cost_per_km', CASE WHEN c.distance_m > 0 THEN round(c.spend / (c.distance_m / 1000.0), 4) END)
        -- Amounts in different currencies are not comparable, so the rider's
        -- profile currency leads; the rest follow by spend.
        ORDER BY (c.currency = (SELECT u.currency FROM public.users u WHERE u.id = p_user_id)) DESC NULLS LAST,
                 c.spend DESC, c.currency)
      FROM cur c), '[]'::jsonb),

    'groups',
      CASE WHEN 'territory' = ANY (p_groups) THEN jsonb_build_object('territory', (
        SELECT jsonb_build_object(
          'explored_cells', e.n,
          'explored_km2', round(e.n * 0.1053325, 2),
          'routed_m', su.routed_m,
          'new_road_m', su.new_m,
          'new_road_share', CASE WHEN su.routed_m > 0 THEN round(su.new_m / su.routed_m, 4) END,
          'furthest', (
            SELECT jsonb_build_object(
              'ride_id', f.ride_id, 'name', f.name, 'local_date', f.local_date, 'distance_m', round(f.d)::integer,
              'lat', round(public.ST_Y(f.pt)::numeric, 6), 'lng', round(public.ST_X(f.pt)::numeric, 6))
            FROM furthest f))
        FROM (SELECT count(*) FILTER (WHERE cv.in_season) AS n FROM cell_visit cv) e
        CROSS JOIN (
          SELECT COALESCE(sum(tr.distance_m), 0) AS routed_m,
                 COALESCE(sum(CASE WHEN tr.total = 0 THEN 0
                                   ELSE round(tr.distance_m::numeric * tr.new_n / tr.total) END), 0) AS new_m
          FROM territory_rides tr
        ) su))
      ELSE '{}'::jsonb END

      || CASE WHEN 'road_character' = ANY (p_groups) THEN jsonb_build_object('road_character', (
        SELECT jsonb_build_object(
          'band_km', jsonb_build_object('straight', round(a.straight, 3), 'sweeping', round(a.sweeping, 3),
                                        'twisty', round(a.twisty, 3), 'tight', round(a.tight, 3)),
          'routed_km', round(a.straight + a.sweeping + a.twisty + a.tight, 3),
          'bends_count', a.bends,
          'bends_per_10km', CASE WHEN a.straight + a.sweeping + a.twisty + a.tight > 0
                                 THEN round(a.bends * 10 / (a.straight + a.sweeping + a.twisty + a.tight), 2) END,
          'rides_with_bands', a.n,
          'rides_with_lean', l.n,
          'twistiest', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('ride_id', r.ride_id, 'name', r.name, 'local_date', r.local_date,
                                                'distance_m', r.distance_m,
                                                'bends_per_10km', round(r.bends_per_km::numeric * 10, 2))
                             ORDER BY r.twisty_rank)
            FROM bend_rank r WHERE r.twisty_rank <= 3), '[]'::jsonb),
          'straightest', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('ride_id', r.ride_id, 'name', r.name, 'local_date', r.local_date,
                                                'distance_m', r.distance_m,
                                                'bends_per_10km', round(r.bends_per_km::numeric * 10, 2))
                             ORDER BY r.straight_rank)
            FROM bend_rank r WHERE r.straight_rank <= 3), '[]'::jsonb),
          'lean', CASE WHEN l.corners > 0 THEN jsonb_build_object(
            'corners', l.corners,
            'under20', round(l.u20 / l.corners, 4), 'from20to30', round(l.f20 / l.corners, 4),
            'from30to40', round(l.f30 / l.corners, 4), 'from40', round(l.f40 / l.corners, 4)) END)
        FROM band_sum a CROSS JOIN lean l))
      ELSE '{}'::jsonb END

      || CASE WHEN 'rhythm' = ANY (p_groups) THEN jsonb_build_object('rhythm', (
        SELECT jsonb_build_object(
          'grid', (
            SELECT jsonb_agg(row.cells ORDER BY row.dow)
            FROM (
              SELECT d.dow, jsonb_agg((SELECT count(*) FROM rhythm_rides rr
                                       WHERE rr.local_dow = d.dow AND rr.part = p.part)
                                      ORDER BY p.part) AS cells
              FROM generate_series(1, 7) AS d (dow)
              CROSS JOIN generate_series(0, 3) AS p (part)
              GROUP BY d.dow
            ) row),
          'rides', count(*),
          'weekend_rides', count(*) FILTER (WHERE rr.local_dow IN (6, 7)),
          'weekend_share', CASE WHEN count(*) > 0
                                THEN round(count(*) FILTER (WHERE rr.local_dow IN (6, 7))::numeric / count(*), 4) END,
          'median_distance_m', percentile_cont(0.5) WITHIN GROUP (ORDER BY rr.distance_m),
          'median_moving_time_s', percentile_cont(0.5) WITHIN GROUP (ORDER BY rr.moving_time_s),
          'rides_with_moving_time', count(rr.moving_time_s))
        FROM rhythm_rides rr))
      ELSE '{}'::jsonb END

      || CASE WHEN 'best_rides' = ANY (p_groups) THEN jsonb_build_object('best_rides', (
        SELECT jsonb_build_object(
          'count', (SELECT count(*) FROM q),
          'by_distance', COALESCE((
            SELECT jsonb_agg(t.item ORDER BY t.rank) FROM (
              SELECT row_number() OVER (ORDER BY q.distance_m DESC, q.started_at, q.ride_id) AS rank,
                     jsonb_build_object('ride_id', q.ride_id, 'name', q.name, 'local_date', q.local_date,
                       'distance_m', q.distance_m, 'climb_m', q.climb_m,
                       'bends_per_10km', round(q.bends_per_km::numeric * 10, 2),
                       'moving_time_s', q.moving_time_s) AS item
              FROM q ORDER BY 1 LIMIT 10) t), '[]'::jsonb),
          'by_climb', COALESCE((
            SELECT jsonb_agg(t.item ORDER BY t.rank) FROM (
              SELECT row_number() OVER (ORDER BY q.climb_m DESC, q.started_at, q.ride_id) AS rank,
                     jsonb_build_object('ride_id', q.ride_id, 'name', q.name, 'local_date', q.local_date,
                       'distance_m', q.distance_m, 'climb_m', q.climb_m,
                       'bends_per_10km', round(q.bends_per_km::numeric * 10, 2),
                       'moving_time_s', q.moving_time_s) AS item
              FROM q WHERE q.climb_m IS NOT NULL ORDER BY 1 LIMIT 10) t), '[]'::jsonb),
          'by_bends', COALESCE((
            SELECT jsonb_agg(t.item ORDER BY t.rank) FROM (
              SELECT row_number() OVER (ORDER BY q.bends_per_km DESC, q.started_at, q.ride_id) AS rank,
                     jsonb_build_object('ride_id', q.ride_id, 'name', q.name, 'local_date', q.local_date,
                       'distance_m', q.distance_m, 'climb_m', q.climb_m,
                       'bends_per_10km', round(q.bends_per_km::numeric * 10, 2),
                       'moving_time_s', q.moving_time_s) AS item
              FROM q WHERE q.bends_per_km IS NOT NULL ORDER BY 1 LIMIT 10) t), '[]'::jsonb))))
      ELSE '{}'::jsonb END

      || CASE WHEN 'bikes' = ANY (p_groups) THEN jsonb_build_object('bikes', (
        SELECT jsonb_build_object('items', COALESCE(jsonb_agg(jsonb_build_object(
            'motorcycle_id', b.motorcycle_id,
            'name', CASE WHEN b.motorcycle_id IS NULL THEN NULL
                         ELSE COALESCE(NULLIF(m.nickname, ''), concat_ws(' ', m.make, m.model)) END,
            'rides', b.rides, 'distance_m', b.distance_m, 'moving_time_s', b.moving_time_s)
          ORDER BY (b.motorcycle_id IS NULL), b.distance_m DESC, b.motorcycle_id), '[]'::jsonb))
        FROM (
          SELECT sr.motorcycle_id, count(*) AS rides, sum(sr.distance_m) AS distance_m,
                 sum(COALESCE(sr.moving_time_s, sr.duration_s)) AS moving_time_s
          FROM sr GROUP BY sr.motorcycle_id
        ) b
        LEFT JOIN public.motorcycles m ON m.id = b.motorcycle_id AND m.user_id = p_user_id))
      ELSE '{}'::jsonb END

      || CASE WHEN 'countries' = ANY (p_groups) THEN jsonb_build_object('countries', (
        SELECT jsonb_build_object('items', COALESCE(jsonb_agg(jsonb_build_object(
            'iso_a2', pc.iso,
            'name', (SELECT p.name FROM public.ref_country_parts p WHERE p.iso_a2 = pc.iso LIMIT 1),
            'first_date', pc.first_date, 'first_ride_id', pc.first_ride_id,
            'rides', pc.rides, 'distance_m', pc.distance_m)
          ORDER BY pc.first_at, pc.iso), '[]'::jsonb))
        FROM per_country pc))
      ELSE '{}'::jsonb END
  )
$$;

-- ============================================================
-- 4. Legacy shapes: personal records and the ride overview
-- ============================================================

-- The RideRecord list: [{ recordType, value, unit, achievedAt, previousValue,
-- rideId }], newest achievement first. One record per type over the rider's
-- qualifying rides (ride_is_qualifying):
--   longest_distance (m): distance_m
--   longest_duration (s): ride_duration_s (timestamps minus pauses)
--   top_speed (mps): ride_stats.max_speed_mps, else rides.max_speed_mps
--   max_elevation_gain (m): ride_stats.climb_m, else rides.elevation_gain
-- The holder is the earliest-ended ride with the best value; achievedAt is its
-- ended_at; previousValue is the best value of the rides that ended before it
-- (null for the first). A type with no value on any ride has no record.
CREATE FUNCTION public.rider_personal_records(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH q AS (
    SELECT r.id, r.ended_at,
           COALESCE(s.distance_m, r.distance_m)::double precision AS longest_distance,
           public.ride_duration_s(r)::double precision AS longest_duration,
           COALESCE(s.max_speed_mps, r.max_speed_mps)::double precision AS top_speed,
           COALESCE(s.climb_m::double precision, r.elevation_gain::double precision) AS max_elevation_gain
    FROM public.rides r
    LEFT JOIN public.ride_stats s ON s.ride_id = r.id
    WHERE r.user_id = p_user_id
      AND r.status = 'completed'
      AND r.deleted_at IS NULL
      AND public.ride_is_qualifying(r)
  ),
  v AS (
    SELECT q.id, q.ended_at, x.record_type, x.unit, x.value
    FROM q
    CROSS JOIN LATERAL (VALUES
      ('longest_distance', 'm', q.longest_distance),
      ('longest_duration', 's', q.longest_duration),
      ('top_speed', 'mps', q.top_speed),
      ('max_elevation_gain', 'm', q.max_elevation_gain)
    ) AS x (record_type, unit, value)
    WHERE x.value IS NOT NULL
  ),
  best AS (
    SELECT DISTINCT ON (v.record_type) v.*
    FROM v
    ORDER BY v.record_type, v.value DESC, v.ended_at, v.id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'recordType', b.record_type,
      'value', b.value,
      'unit', b.unit,
      'achievedAt', b.ended_at,
      'previousValue', (SELECT max(p.value) FROM v p
                        WHERE p.record_type = b.record_type AND (p.ended_at, p.id) < (b.ended_at, b.id)),
      'rideId', b.id)
    ORDER BY b.ended_at DESC, b.record_type), '[]'::jsonb)
  FROM best b
$$;

-- The RideOverview object, keys as GraphQL names them:
-- {
--   lastRide: null | { id, distanceM, durationS, maxSpeedMps, date (ended_at),
--                      motorcycleName, summaryTitle },
--   last7Days, last30Days, thisWeek, thisMonth: { rideCount, distanceM, durationS },
--   dailyDistances: [{ date 'YYYY-MM-DD', distanceM }] x 14, oldest first, ending today,
--   currentStreak: int,
--   personalRecords: rider_personal_records(p_user_id)
-- }
-- Every completed, not deleted ride counts (the season totals' rule), each on
-- the local date of its start in p_tz (NULL or '' is UTC; an unknown zone
-- raises). Periods run from a start date to today: last7Days from today - 7,
-- last30Days from today - 30, thisWeek from this Monday, thisMonth from the
-- 1st. distanceM is ride_stats.distance_m, else rides.distance_m; durationS is
-- ride_duration_s. currentStreak counts consecutive Monday-start weeks with a
-- ride, ending this week or last week (0 otherwise), over the last two years.
-- lastRide is the latest-ended ride; motorcycleName is the bike's nickname, else
-- make and model; maxSpeedMps prefers ride_stats; summaryTitle is the ride
-- summary's text.
CREATE FUNCTION public.rider_ride_overview(p_user_id uuid, p_tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tz text := COALESCE(NULLIF(p_tz, ''), 'UTC');
  v_today date;
  v_monday date;
  v_result jsonb;
BEGIN
  v_today := (now() AT TIME ZONE v_tz)::date;
  v_monday := date_trunc('week', v_today)::date;

  WITH rr AS MATERIALIZED (
    SELECT (r.started_at AT TIME ZONE v_tz)::date AS d,
           COALESCE(s.distance_m, r.distance_m, 0) AS dist,
           public.ride_duration_s(r) AS dur
    FROM public.rides r
    LEFT JOIN public.ride_stats s ON s.ride_id = r.id
    WHERE r.user_id = p_user_id
      AND r.status = 'completed'
      AND r.deleted_at IS NULL
      AND r.started_at >= (v_today - 735)::timestamp AT TIME ZONE v_tz
  ),
  weeks AS (
    SELECT DISTINCT date_trunc('week', rr.d)::date AS w FROM rr WHERE rr.d >= v_today - 730
  ),
  streak AS (
    SELECT w.w, row_number() OVER (ORDER BY w.w DESC) AS rn FROM weeks w
  ),
  last_ride AS (
    SELECT r.id, r.ended_at, r.motorcycle_id,
           COALESCE(s.distance_m, r.distance_m, 0) AS dist,
           public.ride_duration_s(r) AS dur,
           COALESCE(s.max_speed_mps, r.max_speed_mps) AS max_speed
    FROM public.rides r
    LEFT JOIN public.ride_stats s ON s.ride_id = r.id
    WHERE r.user_id = p_user_id
      AND r.status = 'completed'
      AND r.deleted_at IS NULL
    ORDER BY r.ended_at DESC NULLS LAST, r.id DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'lastRide', (
      SELECT jsonb_build_object(
        'id', l.id,
        'distanceM', l.dist,
        'durationS', l.dur,
        'maxSpeedMps', l.max_speed,
        'date', l.ended_at,
        'motorcycleName', (SELECT COALESCE(NULLIF(m.nickname, ''), concat_ws(' ', m.make, m.model))
                           FROM public.motorcycles m
                           WHERE m.id = l.motorcycle_id AND m.user_id = p_user_id),
        'summaryTitle', (SELECT rs.summary_text FROM public.ride_summaries rs WHERE rs.ride_id = l.id))
      FROM last_ride l),
    'last7Days', (SELECT jsonb_build_object('rideCount', count(*), 'distanceM', COALESCE(sum(rr.dist), 0),
                                            'durationS', COALESCE(sum(rr.dur), 0))
                  FROM rr WHERE rr.d >= v_today - 7),
    'last30Days', (SELECT jsonb_build_object('rideCount', count(*), 'distanceM', COALESCE(sum(rr.dist), 0),
                                             'durationS', COALESCE(sum(rr.dur), 0))
                   FROM rr WHERE rr.d >= v_today - 30),
    'thisWeek', (SELECT jsonb_build_object('rideCount', count(*), 'distanceM', COALESCE(sum(rr.dist), 0),
                                           'durationS', COALESCE(sum(rr.dur), 0))
                 FROM rr WHERE rr.d >= v_monday),
    'thisMonth', (SELECT jsonb_build_object('rideCount', count(*), 'distanceM', COALESCE(sum(rr.dist), 0),
                                            'durationS', COALESCE(sum(rr.dur), 0))
                  FROM rr WHERE rr.d >= date_trunc('month', v_today)::date),
    'dailyDistances', (
      SELECT jsonb_agg(jsonb_build_object(
               'date', to_char(g.d, 'YYYY-MM-DD'),
               'distanceM', (SELECT COALESCE(sum(rr.dist), 0) FROM rr WHERE rr.d = g.d::date))
             ORDER BY g.d)
      FROM generate_series(v_today - 13, v_today, interval '1 day') AS g (d)),
    'currentStreak', (
      SELECT CASE
        WHEN max(s.w) IS NULL OR max(s.w) < v_monday - 7 THEN 0
        ELSE count(*) FILTER (WHERE s.w = (SELECT max(s2.w) FROM streak s2) - ((s.rn - 1) * 7)::integer)
      END
      FROM streak s),
    'personalRecords', public.rider_personal_records(p_user_id))
  INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 5. Access: service_role only
-- ============================================================
REVOKE ALL ON FUNCTION public.ride_duration_s(public.rides) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ride_is_qualifying(public.rides) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ride_new_roads(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rider_insights_season(uuid, date, date, text[], double precision)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rider_personal_records(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rider_ride_overview(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ride_duration_s(public.rides) TO service_role;
GRANT EXECUTE ON FUNCTION public.ride_is_qualifying(public.rides) TO service_role;
GRANT EXECUTE ON FUNCTION public.ride_new_roads(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rider_insights_season(uuid, date, date, text[], double precision)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.rider_personal_records(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rider_ride_overview(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Post-apply verification (read-only; run each and report the output):
--
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef,
--          p.proconfig, array_to_string(p.proacl, ',') AS acl
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('ride_duration_s', 'ride_is_qualifying', 'ride_new_roads',
--                       'rider_insights_season', 'rider_personal_records', 'rider_ride_overview')
--   ORDER BY 1;
--   -- expect exactly 6 rows (one signature each), every prosecdef t, every proconfig
--   --   {"search_path=\"\""}, every acl postgres=X/postgres and service_role=X/postgres
--   --   only: NO `=X/` (PUBLIC), anon=X or authenticated=X entry
--
--   SELECT has_function_privilege('anon', 'public.rider_insights_season(uuid, date, date, text[], double precision)', 'EXECUTE') AS anon_season,
--          has_function_privilege('authenticated', 'public.rider_insights_season(uuid, date, date, text[], double precision)', 'EXECUTE') AS auth_season,
--          has_function_privilege('authenticated', 'public.rider_ride_overview(uuid, text)', 'EXECUTE') AS auth_overview,
--          has_function_privilege('authenticated', 'public.ride_new_roads(uuid, uuid)', 'EXECUTE') AS auth_new_roads;
--   -- expect: f, f, f, f
--
--   -- Parity smoke: the qualifying count matches the rule spelled out.
--   SELECT count(*) FILTER (WHERE public.ride_is_qualifying(r)) AS by_function,
--          count(*) FILTER (WHERE r.status = 'completed' AND r.deleted_at IS NULL
--                             AND r.auto_ended_reason IS NULL AND r.distance_m >= 1000
--                             AND r.ended_at IS NOT NULL
--                             AND extract(epoch FROM r.ended_at - r.started_at)
--                                 - r.paused_duration_s - r.auto_paused_duration_s >= 181) AS by_hand_lower,
--          count(*) FILTER (WHERE r.status = 'completed' AND r.deleted_at IS NULL
--                             AND r.auto_ended_reason IS NULL AND r.distance_m >= 1000
--                             AND r.ended_at IS NOT NULL
--                             AND extract(epoch FROM r.ended_at - r.started_at)
--                                 - r.paused_duration_s - r.auto_paused_duration_s >= 180) AS by_hand_upper
--   FROM public.rides r;
--   -- expect: by_hand_lower <= by_function <= by_hand_upper (they differ only on
--   --   sub-second edges)
--
--   -- The heaviest real rider (most completed live rides, synthetic excluded):
--   SELECT r.user_id, count(*) AS rides
--   FROM public.rides r JOIN public.users u ON u.id = r.user_id
--   WHERE r.status = 'completed' AND r.deleted_at IS NULL AND NOT u.is_synthetic
--   GROUP BY r.user_id ORDER BY 2 DESC LIMIT 1;
--
--   -- With that user_id (replace <uid>) and this year's season, run each twice
--   -- and report the second run's "Execution Time":
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT public.rider_insights_season('<uid>'::uuid, date_trunc('year', now())::date,
--     (date_trunc('year', now()) + interval '1 year - 1 day')::date,
--     ARRAY['territory', 'road_character', 'rhythm', 'best_rides', 'bikes', 'countries'], 25);
--   -- expect: Execution Time under 300 ms (the plan's performance gate)
--
--   EXPLAIN (ANALYZE, BUFFERS) SELECT public.rider_ride_overview('<uid>'::uuid, 'Europe/Bratislava');
--   EXPLAIN (ANALYZE, BUFFERS) SELECT public.rider_personal_records('<uid>'::uuid);
--   -- expect: each well under 300 ms
--
--   -- Shape smoke on the same rider:
--   SELECT jsonb_object_keys(public.rider_insights_season('<uid>'::uuid, '2026-01-01', '2026-12-31', '{}', 25));
--   -- expect 9 rows: cost_per_km, coverage, groups, latest_ride, longest_ride, regions,
--   --   ribbon, totals, window
--   SELECT jsonb_object_keys(public.rider_ride_overview('<uid>'::uuid, 'UTC'));
--   -- expect 8 rows: currentStreak, dailyDistances, last30Days, last7Days, lastRide,
--   --   personalRecords, thisMonth, thisWeek
