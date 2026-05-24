-- =====================================================
-- Migration: ride_rollups table + sentinel UUID + RPC functions
-- Ticket: MOT-234
-- =====================================================

-- PostGIS for future heatmap aggregation — declared up front, low risk.
CREATE EXTENSION IF NOT EXISTS postgis;

-- "All bikes" aggregate row uses this sentinel instead of NULL.
-- NULL would break PK uniqueness — Postgres treats NULLs as distinct.
CREATE OR REPLACE FUNCTION public.all_bikes_sentinel() RETURNS UUID
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid $$;

-- Period discriminator for the single rollup table.
CREATE TYPE public.ride_rollup_period AS ENUM ('day', 'week', 'month');

-- Single rollup table with period_kind discriminator.
-- No FK on motorcycle_id — the sentinel UUID has no motorcycles row.
CREATE TABLE public.ride_rollups (
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id     UUID NOT NULL,
  period_kind       public.ride_rollup_period NOT NULL,
  period_start      DATE NOT NULL,
  ride_count        INT    NOT NULL DEFAULT 0,
  distance_m        BIGINT NOT NULL DEFAULT 0,
  moving_time_s     INT    NOT NULL DEFAULT 0,
  paused_time_s     INT    NOT NULL DEFAULT 0,
  elevation_gain_m  INT    NOT NULL DEFAULT 0,
  elevation_loss_m  INT    NOT NULL DEFAULT 0,
  max_speed_mps     REAL,
  max_lean_angle    REAL,
  band_urban_s      INT NOT NULL DEFAULT 0,
  band_cruise_s     INT NOT NULL DEFAULT 0,
  band_spirited_s   INT NOT NULL DEFAULT 0,
  band_silly_s      INT NOT NULL DEFAULT 0,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, motorcycle_id, period_kind, period_start)
);

CREATE INDEX ride_rollups_user_kind_period_idx
  ON public.ride_rollups (user_id, period_kind, period_start DESC);

ALTER TABLE public.ride_rollups ENABLE ROW LEVEL SECURITY;

-- Owner-read only for authenticated users; service-role writes.
CREATE POLICY "rollups_owner_read" ON public.ride_rollups
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- =====================================================
-- RPC: _upsert_rollup — plain SQL, no dynamic format()
-- =====================================================
CREATE OR REPLACE FUNCTION public._upsert_rollup(
  p_user_id        UUID,
  p_motorcycle_id  UUID,
  p_period_kind    public.ride_rollup_period,
  p_period_start   DATE,
  p_metrics        JSONB
) RETURNS VOID
LANGUAGE sql SECURITY DEFINER AS $$
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

-- =====================================================
-- RPC: record_ride_analytics — single transaction
-- Wraps 6 upserts + idempotency marker atomically.
-- =====================================================
CREATE OR REPLACE FUNCTION public.record_ride_analytics(
  p_ride_id        UUID,
  p_user_id        UUID,
  p_motorcycle_id  UUID,
  p_started_at     TIMESTAMPTZ,
  p_ride_metrics   JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bike     UUID := COALESCE(p_motorcycle_id, public.all_bikes_sentinel());
  v_sentinel UUID := public.all_bikes_sentinel();
  v_day      DATE := (p_started_at AT TIME ZONE 'UTC')::date;
  v_week     DATE := date_trunc('week', p_started_at AT TIME ZONE 'UTC')::date;
  v_mon      DATE := date_trunc('month', p_started_at AT TIME ZONE 'UTC')::date;
BEGIN
  -- 6 upserts: 3 period_kinds × (real bike + sentinel "all bikes")
  -- When p_motorcycle_id is NULL, v_bike = sentinel, so we write 2 identical
  -- sentinel rows which collapse via ON CONFLICT (effectively 3 upserts).
  PERFORM public._upsert_rollup(p_user_id, v_bike,     'day',   v_day,  p_ride_metrics);
  PERFORM public._upsert_rollup(p_user_id, v_sentinel, 'day',   v_day,  p_ride_metrics);
  PERFORM public._upsert_rollup(p_user_id, v_bike,     'week',  v_week, p_ride_metrics);
  PERFORM public._upsert_rollup(p_user_id, v_sentinel, 'week',  v_week, p_ride_metrics);
  PERFORM public._upsert_rollup(p_user_id, v_bike,     'month', v_mon,  p_ride_metrics);
  PERFORM public._upsert_rollup(p_user_id, v_sentinel, 'month', v_mon,  p_ride_metrics);

  -- Idempotency marker — same transaction.
  -- If this crashes before commit, neither rollups nor marker are written.
  UPDATE public.rides
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{analytics_processed_at}',
      to_jsonb(NOW())
    )
    WHERE id = p_ride_id;
END;
$$;
