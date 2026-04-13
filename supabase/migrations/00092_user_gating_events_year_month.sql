-- MOT-179: Add year_month generated column for monthly quota windowing
-- No cron/reset needed — quota is computed via WHERE year_month = current month

ALTER TABLE public.user_gating_events
  ADD COLUMN year_month TEXT GENERATED ALWAYS AS (to_char(created_at, 'YYYY-MM')) STORED;

CREATE INDEX idx_gating_events_user_feature_month
  ON public.user_gating_events (user_id, feature, year_month DESC);
