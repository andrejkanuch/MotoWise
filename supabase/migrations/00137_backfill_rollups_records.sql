-- =====================================================
-- Migration: backfill ride_rollups + ride_records from historical rides
-- Ticket: MOT-236
--
-- Idempotent: uses INSERT ... ON CONFLICT DO UPDATE for rollups
-- and INSERT ... ON CONFLICT DO NOTHING for records.
--
-- Real-ride filter: distance_m >= 500 AND
--   (EXTRACT(EPOCH FROM ended_at - started_at) - COALESCE(paused_duration_s,0)) >= 60
-- =====================================================

-- =====================================================
-- 1) Backfill ride_rollups (day + week + month × per-bike + sentinel)
-- =====================================================

-- Helper: compute moving_time_s from ride timestamps
-- moving_time = total_duration - paused_duration - auto_paused_duration

-- Daily rollups — per bike
INSERT INTO public.ride_rollups (
  user_id, motorcycle_id, period_kind, period_start,
  ride_count, distance_m, moving_time_s, paused_time_s,
  elevation_gain_m, elevation_loss_m,
  max_speed_mps, max_lean_angle,
  band_urban_s, band_cruise_s, band_spirited_s, band_silly_s
)
SELECT
  r.user_id,
  COALESCE(r.motorcycle_id, public.all_bikes_sentinel()),
  'day'::public.ride_rollup_period,
  (r.started_at AT TIME ZONE 'UTC')::date,
  COUNT(*)::INT,
  SUM(COALESCE(r.distance_m, 0))::BIGINT,
  SUM(GREATEST(0,
    EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
    - COALESCE(r.paused_duration_s, 0)
    - COALESCE(r.auto_paused_duration_s, 0)
  ))::INT,
  SUM(COALESCE(r.paused_duration_s, 0) + COALESCE(r.auto_paused_duration_s, 0))::INT,
  SUM(COALESCE(r.elevation_gain, 0))::INT,
  SUM(COALESCE(r.elevation_loss, 0))::INT,
  MAX(r.max_speed_mps),
  MAX(r.max_lean_angle),
  0, 0, 0, 0  -- speed bands not computed in backfill (would require waypoint scan)
FROM public.rides r
WHERE r.status = 'completed'
  AND r.deleted_at IS NULL
  AND r.distance_m >= 500
  AND (EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
       - COALESCE(r.paused_duration_s, 0)
       - COALESCE(r.auto_paused_duration_s, 0)) >= 60
GROUP BY r.user_id, COALESCE(r.motorcycle_id, public.all_bikes_sentinel()),
         (r.started_at AT TIME ZONE 'UTC')::date
ON CONFLICT (user_id, motorcycle_id, period_kind, period_start) DO UPDATE SET
  ride_count = EXCLUDED.ride_count,
  distance_m = EXCLUDED.distance_m,
  moving_time_s = EXCLUDED.moving_time_s,
  paused_time_s = EXCLUDED.paused_time_s,
  elevation_gain_m = EXCLUDED.elevation_gain_m,
  elevation_loss_m = EXCLUDED.elevation_loss_m,
  max_speed_mps = EXCLUDED.max_speed_mps,
  max_lean_angle = EXCLUDED.max_lean_angle,
  computed_at = NOW();

-- Daily rollups — sentinel (all bikes)
INSERT INTO public.ride_rollups (
  user_id, motorcycle_id, period_kind, period_start,
  ride_count, distance_m, moving_time_s, paused_time_s,
  elevation_gain_m, elevation_loss_m,
  max_speed_mps, max_lean_angle,
  band_urban_s, band_cruise_s, band_spirited_s, band_silly_s
)
SELECT
  r.user_id,
  public.all_bikes_sentinel(),
  'day'::public.ride_rollup_period,
  (r.started_at AT TIME ZONE 'UTC')::date,
  COUNT(*)::INT,
  SUM(COALESCE(r.distance_m, 0))::BIGINT,
  SUM(GREATEST(0,
    EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
    - COALESCE(r.paused_duration_s, 0)
    - COALESCE(r.auto_paused_duration_s, 0)
  ))::INT,
  SUM(COALESCE(r.paused_duration_s, 0) + COALESCE(r.auto_paused_duration_s, 0))::INT,
  SUM(COALESCE(r.elevation_gain, 0))::INT,
  SUM(COALESCE(r.elevation_loss, 0))::INT,
  MAX(r.max_speed_mps),
  MAX(r.max_lean_angle),
  0, 0, 0, 0
FROM public.rides r
WHERE r.status = 'completed'
  AND r.deleted_at IS NULL
  AND r.distance_m >= 500
  AND (EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
       - COALESCE(r.paused_duration_s, 0)
       - COALESCE(r.auto_paused_duration_s, 0)) >= 60
GROUP BY r.user_id, (r.started_at AT TIME ZONE 'UTC')::date
ON CONFLICT (user_id, motorcycle_id, period_kind, period_start) DO UPDATE SET
  ride_count = EXCLUDED.ride_count,
  distance_m = EXCLUDED.distance_m,
  moving_time_s = EXCLUDED.moving_time_s,
  paused_time_s = EXCLUDED.paused_time_s,
  elevation_gain_m = EXCLUDED.elevation_gain_m,
  elevation_loss_m = EXCLUDED.elevation_loss_m,
  max_speed_mps = EXCLUDED.max_speed_mps,
  max_lean_angle = EXCLUDED.max_lean_angle,
  computed_at = NOW();

-- Weekly rollups — per bike
INSERT INTO public.ride_rollups (
  user_id, motorcycle_id, period_kind, period_start,
  ride_count, distance_m, moving_time_s, paused_time_s,
  elevation_gain_m, elevation_loss_m,
  max_speed_mps, max_lean_angle,
  band_urban_s, band_cruise_s, band_spirited_s, band_silly_s
)
SELECT
  r.user_id,
  COALESCE(r.motorcycle_id, public.all_bikes_sentinel()),
  'week'::public.ride_rollup_period,
  date_trunc('week', r.started_at AT TIME ZONE 'UTC')::date,
  COUNT(*)::INT,
  SUM(COALESCE(r.distance_m, 0))::BIGINT,
  SUM(GREATEST(0,
    EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
    - COALESCE(r.paused_duration_s, 0)
    - COALESCE(r.auto_paused_duration_s, 0)
  ))::INT,
  SUM(COALESCE(r.paused_duration_s, 0) + COALESCE(r.auto_paused_duration_s, 0))::INT,
  SUM(COALESCE(r.elevation_gain, 0))::INT,
  SUM(COALESCE(r.elevation_loss, 0))::INT,
  MAX(r.max_speed_mps),
  MAX(r.max_lean_angle),
  0, 0, 0, 0
FROM public.rides r
WHERE r.status = 'completed'
  AND r.deleted_at IS NULL
  AND r.distance_m >= 500
  AND (EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
       - COALESCE(r.paused_duration_s, 0)
       - COALESCE(r.auto_paused_duration_s, 0)) >= 60
GROUP BY r.user_id, COALESCE(r.motorcycle_id, public.all_bikes_sentinel()),
         date_trunc('week', r.started_at AT TIME ZONE 'UTC')::date
ON CONFLICT (user_id, motorcycle_id, period_kind, period_start) DO UPDATE SET
  ride_count = EXCLUDED.ride_count,
  distance_m = EXCLUDED.distance_m,
  moving_time_s = EXCLUDED.moving_time_s,
  paused_time_s = EXCLUDED.paused_time_s,
  elevation_gain_m = EXCLUDED.elevation_gain_m,
  elevation_loss_m = EXCLUDED.elevation_loss_m,
  max_speed_mps = EXCLUDED.max_speed_mps,
  max_lean_angle = EXCLUDED.max_lean_angle,
  computed_at = NOW();

-- Weekly rollups — sentinel
INSERT INTO public.ride_rollups (
  user_id, motorcycle_id, period_kind, period_start,
  ride_count, distance_m, moving_time_s, paused_time_s,
  elevation_gain_m, elevation_loss_m,
  max_speed_mps, max_lean_angle,
  band_urban_s, band_cruise_s, band_spirited_s, band_silly_s
)
SELECT
  r.user_id,
  public.all_bikes_sentinel(),
  'week'::public.ride_rollup_period,
  date_trunc('week', r.started_at AT TIME ZONE 'UTC')::date,
  COUNT(*)::INT,
  SUM(COALESCE(r.distance_m, 0))::BIGINT,
  SUM(GREATEST(0,
    EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
    - COALESCE(r.paused_duration_s, 0)
    - COALESCE(r.auto_paused_duration_s, 0)
  ))::INT,
  SUM(COALESCE(r.paused_duration_s, 0) + COALESCE(r.auto_paused_duration_s, 0))::INT,
  SUM(COALESCE(r.elevation_gain, 0))::INT,
  SUM(COALESCE(r.elevation_loss, 0))::INT,
  MAX(r.max_speed_mps),
  MAX(r.max_lean_angle),
  0, 0, 0, 0
FROM public.rides r
WHERE r.status = 'completed'
  AND r.deleted_at IS NULL
  AND r.distance_m >= 500
  AND (EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
       - COALESCE(r.paused_duration_s, 0)
       - COALESCE(r.auto_paused_duration_s, 0)) >= 60
GROUP BY r.user_id, date_trunc('week', r.started_at AT TIME ZONE 'UTC')::date
ON CONFLICT (user_id, motorcycle_id, period_kind, period_start) DO UPDATE SET
  ride_count = EXCLUDED.ride_count,
  distance_m = EXCLUDED.distance_m,
  moving_time_s = EXCLUDED.moving_time_s,
  paused_time_s = EXCLUDED.paused_time_s,
  elevation_gain_m = EXCLUDED.elevation_gain_m,
  elevation_loss_m = EXCLUDED.elevation_loss_m,
  max_speed_mps = EXCLUDED.max_speed_mps,
  max_lean_angle = EXCLUDED.max_lean_angle,
  computed_at = NOW();

-- Monthly rollups — per bike
INSERT INTO public.ride_rollups (
  user_id, motorcycle_id, period_kind, period_start,
  ride_count, distance_m, moving_time_s, paused_time_s,
  elevation_gain_m, elevation_loss_m,
  max_speed_mps, max_lean_angle,
  band_urban_s, band_cruise_s, band_spirited_s, band_silly_s
)
SELECT
  r.user_id,
  COALESCE(r.motorcycle_id, public.all_bikes_sentinel()),
  'month'::public.ride_rollup_period,
  date_trunc('month', r.started_at AT TIME ZONE 'UTC')::date,
  COUNT(*)::INT,
  SUM(COALESCE(r.distance_m, 0))::BIGINT,
  SUM(GREATEST(0,
    EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
    - COALESCE(r.paused_duration_s, 0)
    - COALESCE(r.auto_paused_duration_s, 0)
  ))::INT,
  SUM(COALESCE(r.paused_duration_s, 0) + COALESCE(r.auto_paused_duration_s, 0))::INT,
  SUM(COALESCE(r.elevation_gain, 0))::INT,
  SUM(COALESCE(r.elevation_loss, 0))::INT,
  MAX(r.max_speed_mps),
  MAX(r.max_lean_angle),
  0, 0, 0, 0
FROM public.rides r
WHERE r.status = 'completed'
  AND r.deleted_at IS NULL
  AND r.distance_m >= 500
  AND (EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
       - COALESCE(r.paused_duration_s, 0)
       - COALESCE(r.auto_paused_duration_s, 0)) >= 60
GROUP BY r.user_id, COALESCE(r.motorcycle_id, public.all_bikes_sentinel()),
         date_trunc('month', r.started_at AT TIME ZONE 'UTC')::date
ON CONFLICT (user_id, motorcycle_id, period_kind, period_start) DO UPDATE SET
  ride_count = EXCLUDED.ride_count,
  distance_m = EXCLUDED.distance_m,
  moving_time_s = EXCLUDED.moving_time_s,
  paused_time_s = EXCLUDED.paused_time_s,
  elevation_gain_m = EXCLUDED.elevation_gain_m,
  elevation_loss_m = EXCLUDED.elevation_loss_m,
  max_speed_mps = EXCLUDED.max_speed_mps,
  max_lean_angle = EXCLUDED.max_lean_angle,
  computed_at = NOW();

-- Monthly rollups — sentinel
INSERT INTO public.ride_rollups (
  user_id, motorcycle_id, period_kind, period_start,
  ride_count, distance_m, moving_time_s, paused_time_s,
  elevation_gain_m, elevation_loss_m,
  max_speed_mps, max_lean_angle,
  band_urban_s, band_cruise_s, band_spirited_s, band_silly_s
)
SELECT
  r.user_id,
  public.all_bikes_sentinel(),
  'month'::public.ride_rollup_period,
  date_trunc('month', r.started_at AT TIME ZONE 'UTC')::date,
  COUNT(*)::INT,
  SUM(COALESCE(r.distance_m, 0))::BIGINT,
  SUM(GREATEST(0,
    EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
    - COALESCE(r.paused_duration_s, 0)
    - COALESCE(r.auto_paused_duration_s, 0)
  ))::INT,
  SUM(COALESCE(r.paused_duration_s, 0) + COALESCE(r.auto_paused_duration_s, 0))::INT,
  SUM(COALESCE(r.elevation_gain, 0))::INT,
  SUM(COALESCE(r.elevation_loss, 0))::INT,
  MAX(r.max_speed_mps),
  MAX(r.max_lean_angle),
  0, 0, 0, 0
FROM public.rides r
WHERE r.status = 'completed'
  AND r.deleted_at IS NULL
  AND r.distance_m >= 500
  AND (EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
       - COALESCE(r.paused_duration_s, 0)
       - COALESCE(r.auto_paused_duration_s, 0)) >= 60
GROUP BY r.user_id, date_trunc('month', r.started_at AT TIME ZONE 'UTC')::date
ON CONFLICT (user_id, motorcycle_id, period_kind, period_start) DO UPDATE SET
  ride_count = EXCLUDED.ride_count,
  distance_m = EXCLUDED.distance_m,
  moving_time_s = EXCLUDED.moving_time_s,
  paused_time_s = EXCLUDED.paused_time_s,
  elevation_gain_m = EXCLUDED.elevation_gain_m,
  elevation_loss_m = EXCLUDED.elevation_loss_m,
  max_speed_mps = EXCLUDED.max_speed_mps,
  max_lean_angle = EXCLUDED.max_lean_angle,
  computed_at = NOW();

-- =====================================================
-- 2) Backfill ride_records (per-ride bests, sentinel only)
-- =====================================================

-- Longest distance
INSERT INTO public.ride_records (user_id, motorcycle_id, record_type, value, unit, ride_id, achieved_at)
SELECT DISTINCT ON (r.user_id)
  r.user_id,
  public.all_bikes_sentinel(),
  'longest_distance'::public.ride_record_type,
  r.distance_m::REAL,
  'm',
  r.id,
  r.ended_at
FROM public.rides r
WHERE r.status = 'completed' AND r.deleted_at IS NULL AND r.distance_m >= 500
ORDER BY r.user_id, r.distance_m DESC NULLS LAST
ON CONFLICT (user_id, motorcycle_id, record_type) DO NOTHING;

-- Longest duration (moving_time)
INSERT INTO public.ride_records (user_id, motorcycle_id, record_type, value, unit, ride_id, achieved_at)
SELECT DISTINCT ON (r.user_id)
  r.user_id,
  public.all_bikes_sentinel(),
  'longest_duration'::public.ride_record_type,
  GREATEST(0,
    EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
    - COALESCE(r.paused_duration_s, 0)
    - COALESCE(r.auto_paused_duration_s, 0)
  )::REAL,
  's',
  r.id,
  r.ended_at
FROM public.rides r
WHERE r.status = 'completed' AND r.deleted_at IS NULL AND r.distance_m >= 500
ORDER BY r.user_id,
  GREATEST(0, EXTRACT(EPOCH FROM r.ended_at - r.started_at)::INT
    - COALESCE(r.paused_duration_s, 0)
    - COALESCE(r.auto_paused_duration_s, 0)) DESC NULLS LAST
ON CONFLICT (user_id, motorcycle_id, record_type) DO NOTHING;

-- Top speed
INSERT INTO public.ride_records (user_id, motorcycle_id, record_type, value, unit, ride_id, achieved_at)
SELECT DISTINCT ON (r.user_id)
  r.user_id,
  public.all_bikes_sentinel(),
  'top_speed'::public.ride_record_type,
  r.max_speed_mps::REAL,
  'mps',
  r.id,
  r.ended_at
FROM public.rides r
WHERE r.status = 'completed' AND r.deleted_at IS NULL
  AND r.distance_m >= 500 AND r.max_speed_mps IS NOT NULL
ORDER BY r.user_id, r.max_speed_mps DESC NULLS LAST
ON CONFLICT (user_id, motorcycle_id, record_type) DO NOTHING;

-- Most elevation gain
INSERT INTO public.ride_records (user_id, motorcycle_id, record_type, value, unit, ride_id, achieved_at)
SELECT DISTINCT ON (r.user_id)
  r.user_id,
  public.all_bikes_sentinel(),
  'max_elevation_gain'::public.ride_record_type,
  r.elevation_gain::REAL,
  'm',
  r.id,
  r.ended_at
FROM public.rides r
WHERE r.status = 'completed' AND r.deleted_at IS NULL
  AND r.distance_m >= 500 AND r.elevation_gain IS NOT NULL
ORDER BY r.user_id, r.elevation_gain DESC NULLS LAST
ON CONFLICT (user_id, motorcycle_id, record_type) DO NOTHING;

-- =====================================================
-- 3) Mark all backfilled rides as analytics-processed
-- =====================================================
UPDATE public.rides
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{analytics_processed_at}',
  to_jsonb(NOW())
)
WHERE status = 'completed'
  AND deleted_at IS NULL
  AND distance_m >= 500
  AND (metadata IS NULL OR metadata->>'analytics_processed_at' IS NULL);
