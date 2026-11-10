-- Migration: 00200_ride_overview_skip_short_rides
-- The ride overview (rideOverview: last 7 / 30 days, this week, this month,
-- daily distances, streak) leaves out rides below the real-ride threshold that
-- today's rollups apply: under 500 m, or under 60 s of moving time
-- (MIN_RIDE_DISTANCE_M and MIN_RIDE_MOVING_TIME_S in ride-analytics.constants.ts).
-- 00199 counted every completed ride, so an accidental start would show as
-- "1 ride, 0 km" where riders see 0 rides today. Owner decision 2026-11-10.
-- lastRide is unchanged: it was never filtered. Season totals (R15) still count
-- every completed ride. Personal records already use ride_is_qualifying.
--
-- Only rider_ride_overview changes, by CREATE OR REPLACE, which keeps its ACL;
-- the ACL is re-asserted anyway.
--
-- PREREQUISITES: 00199 applied.
-- DEPLOY ORDER: apply before or after the API that reads it; both work.
-- Apply as ONE statement batch (one Management API call) with this leading
-- comment block stripped, record version 00200 in
-- supabase_migrations.schema_migrations, then run the footer query.
--
-- ROLLBACK: re-run 00199's CREATE FUNCTION body for rider_ride_overview as
-- CREATE OR REPLACE (the same function without the two threshold lines).

BEGIN;

CREATE OR REPLACE FUNCTION public.rider_ride_overview(p_user_id uuid, p_tz text DEFAULT 'UTC')
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
      -- Below the real-ride threshold the rollups used (MIN_RIDE_DISTANCE_M,
      -- MIN_RIDE_MOVING_TIME_S): an accidental start is not a ride in the totals.
      AND COALESCE(r.distance_m, 0) >= 500
      AND public.ride_duration_s(r) >= 60
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

REVOKE ALL ON FUNCTION public.rider_ride_overview(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rider_ride_overview(uuid, text) TO service_role;

COMMIT;

-- Post-apply verification (read-only):
--   SELECT pg_get_functiondef('public.rider_ride_overview(uuid, text)'::regprocedure)
--     LIKE '%>= 500%' AS has_threshold,
--     has_function_privilege('authenticated', 'public.rider_ride_overview(uuid, text)', 'EXECUTE') AS auth,
--     has_function_privilege('service_role', 'public.rider_ride_overview(uuid, text)', 'EXECUTE') AS svc;
--   -- expect: t, f, t
