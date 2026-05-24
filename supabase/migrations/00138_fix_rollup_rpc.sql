-- =====================================================
-- Patch: fix double-counting bug + add SET search_path
-- Applied after 00134 already ran on staging.
--
-- Fixes:
--   1. record_ride_analytics double-counted sentinel rollups
--      when motorcycle_id IS NULL (v_bike = v_sentinel).
--   2. Both SECURITY DEFINER functions lacked SET search_path.
-- =====================================================

-- Patched _upsert_rollup: add SET search_path = public
CREATE OR REPLACE FUNCTION public._upsert_rollup(
  p_user_id        UUID,
  p_motorcycle_id  UUID,
  p_period_kind    public.ride_rollup_period,
  p_period_start   DATE,
  p_metrics        JSONB
) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.ride_rollups (
    user_id, motorcycle_id, period_kind, period_start,
    ride_count, distance_m, moving_time_s, paused_time_s,
    elevation_gain_m, elevation_loss_m,
    max_speed_mps, max_lean_angle,
    band_urban_s, band_cruise_s, band_spirited_s, band_silly_s
  )
  VALUES (
    p_user_id, p_motorcycle_id, p_period_kind, p_period_start,
    1,
    COALESCE((p_metrics->>'distance_m')::BIGINT, 0),
    COALESCE((p_metrics->>'moving_time_s')::INT, 0),
    COALESCE((p_metrics->>'paused_time_s')::INT, 0),
    COALESCE((p_metrics->>'elevation_gain_m')::INT, 0),
    COALESCE((p_metrics->>'elevation_loss_m')::INT, 0),
    NULLIF((p_metrics->>'max_speed_mps'), '')::REAL,
    NULLIF((p_metrics->>'max_lean_angle'), '')::REAL,
    COALESCE((p_metrics->>'band_urban_s')::INT, 0),
    COALESCE((p_metrics->>'band_cruise_s')::INT, 0),
    COALESCE((p_metrics->>'band_spirited_s')::INT, 0),
    COALESCE((p_metrics->>'band_silly_s')::INT, 0)
  )
  ON CONFLICT (user_id, motorcycle_id, period_kind, period_start) DO UPDATE SET
    ride_count        = ride_rollups.ride_count + 1,
    distance_m        = ride_rollups.distance_m + EXCLUDED.distance_m,
    moving_time_s     = ride_rollups.moving_time_s + EXCLUDED.moving_time_s,
    paused_time_s     = ride_rollups.paused_time_s + EXCLUDED.paused_time_s,
    elevation_gain_m  = ride_rollups.elevation_gain_m + EXCLUDED.elevation_gain_m,
    elevation_loss_m  = ride_rollups.elevation_loss_m + EXCLUDED.elevation_loss_m,
    max_speed_mps     = GREATEST(ride_rollups.max_speed_mps, EXCLUDED.max_speed_mps),
    max_lean_angle    = GREATEST(ride_rollups.max_lean_angle, EXCLUDED.max_lean_angle),
    band_urban_s      = ride_rollups.band_urban_s + EXCLUDED.band_urban_s,
    band_cruise_s     = ride_rollups.band_cruise_s + EXCLUDED.band_cruise_s,
    band_spirited_s   = ride_rollups.band_spirited_s + EXCLUDED.band_spirited_s,
    band_silly_s      = ride_rollups.band_silly_s + EXCLUDED.band_silly_s,
    computed_at       = NOW();
$$;

-- Patched record_ride_analytics:
--   1. Guard sentinel upserts with IF v_bike <> v_sentinel
--      (prevents double-counting when motorcycle_id IS NULL)
--   2. Add SET search_path = public
CREATE OR REPLACE FUNCTION public.record_ride_analytics(
  p_ride_id        UUID,
  p_user_id        UUID,
  p_motorcycle_id  UUID,
  p_started_at     TIMESTAMPTZ,
  p_ride_metrics   JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bike     UUID := COALESCE(p_motorcycle_id, public.all_bikes_sentinel());
  v_sentinel UUID := public.all_bikes_sentinel();
  v_day      DATE := (p_started_at AT TIME ZONE 'UTC')::date;
  v_week     DATE := date_trunc('week', p_started_at AT TIME ZONE 'UTC')::date;
  v_mon      DATE := date_trunc('month', p_started_at AT TIME ZONE 'UTC')::date;
BEGIN
  -- Per-bike upserts (skip if ride has no motorcycle — sentinel handles it below)
  IF v_bike <> v_sentinel THEN
    PERFORM public._upsert_rollup(p_user_id, v_bike, 'day',   v_day,  p_ride_metrics);
    PERFORM public._upsert_rollup(p_user_id, v_bike, 'week',  v_week, p_ride_metrics);
    PERFORM public._upsert_rollup(p_user_id, v_bike, 'month', v_mon,  p_ride_metrics);
  END IF;

  -- All-bikes sentinel upserts (always written, exactly once per period)
  PERFORM public._upsert_rollup(p_user_id, v_sentinel, 'day',   v_day,  p_ride_metrics);
  PERFORM public._upsert_rollup(p_user_id, v_sentinel, 'week',  v_week, p_ride_metrics);
  PERFORM public._upsert_rollup(p_user_id, v_sentinel, 'month', v_mon,  p_ride_metrics);

  -- Idempotency marker — same transaction.
  UPDATE public.rides
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{analytics_processed_at}',
      to_jsonb(NOW())
    )
    WHERE id = p_ride_id;
END;
$$;
