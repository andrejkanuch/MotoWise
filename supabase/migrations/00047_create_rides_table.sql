-- Migration: Create rides + ride_waypoints tables
-- Ride logging feature: GPS-tracked rides with waypoints, RLS, indexes, triggers

-- ==========================================
-- TABLE: rides
-- ==========================================
CREATE TABLE public.rides (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id          UUID REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  status                 TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'paused', 'completed')),
  started_at             TIMESTAMPTZ NOT NULL,              -- H14: no DEFAULT, client-supplied
  ended_at               TIMESTAMPTZ,                       -- H14: client-supplied
  paused_duration_s      INT NOT NULL DEFAULT 0,            -- H18: INT seconds, not INTERVAL
  auto_paused_duration_s INT NOT NULL DEFAULT 0,            -- H17: auto-pause duration
  distance_m             INT,
  max_speed_mps          REAL,
  avg_speed_mps          REAL,
  max_lean_angle         REAL,                              -- v1.1, nullable
  elevation_gain         REAL,
  elevation_loss         REAL,
  route_polyline         TEXT,
  gps_quality            REAL,
  mileage_applied        BOOLEAN NOT NULL DEFAULT FALSE,
  is_public              BOOLEAN NOT NULL DEFAULT FALSE,
  region                 TEXT,
  weather_snapshot       JSONB,
  name                   TEXT,                              -- R17: optional ride name
  route_thumbnail_uri    TEXT,                              -- local file path to 400x300 map snapshot
  metadata               JSONB NOT NULL DEFAULT '{}',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ
);

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TABLE: ride_waypoints (composite PK — H16 fix)
-- ==========================================
CREATE TABLE public.ride_waypoints (
  ride_id     UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  altitude    REAL,
  speed_mps   REAL,
  heading     REAL,
  lean_angle  REAL,
  accuracy    REAL,
  PRIMARY KEY (ride_id, recorded_at)   -- H16: composite PK, eliminates UUID overhead
);

ALTER TABLE public.ride_waypoints ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES
-- ==========================================

-- Composite index for user ride history queries
CREATE INDEX rides_user_id_motorcycle_id_started_at_idx
  ON public.rides (user_id, motorcycle_id, started_at DESC)
  WHERE deleted_at IS NULL;

-- Partial index for active rides lookup
CREATE INDEX rides_status_idx
  ON public.rides (status)
  WHERE status IN ('recording', 'paused');

-- Prevent multiple concurrent rides per user (data integrity guard)
CREATE UNIQUE INDEX rides_one_active_per_user
  ON public.rides (user_id)
  WHERE status IN ('recording', 'paused') AND deleted_at IS NULL;

-- ==========================================
-- RLS POLICIES — RIDES
-- ==========================================
CREATE POLICY "Enable read access for ride owner or admin"
  ON public.rides
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND deleted_at IS NULL)
    OR public.is_admin()
  );

CREATE POLICY "Enable insert for authenticated users"
  ON public.rides
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (motorcycle_id IS NULL OR motorcycle_id IN (
      SELECT id FROM public.motorcycles WHERE user_id = auth.uid() AND deleted_at IS NULL
    ))
  );

CREATE POLICY "Enable update for ride owner"
  ON public.rides
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable delete for ride owner"
  ON public.rides
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- ==========================================
-- RLS POLICIES — RIDE WAYPOINTS (C2 fix)
-- ==========================================
CREATE POLICY "Enable read for ride owner"
  ON public.ride_waypoints
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ride_waypoints.ride_id
      AND rides.user_id = auth.uid()
      AND rides.deleted_at IS NULL
    )
    OR public.is_admin()
  );

CREATE POLICY "Enable insert for ride owner"
  ON public.ride_waypoints
  FOR INSERT TO authenticated
  WITH CHECK (
    ride_id IN (
      SELECT id FROM public.rides
      WHERE user_id = auth.uid()
      AND status IN ('recording', 'paused')
      AND deleted_at IS NULL
    )
  );

-- ==========================================
-- TRIGGER: auto-update updated_at
-- ==========================================
CREATE TRIGGER set_rides_updated_at
  BEFORE UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();  -- H7: reuses existing trigger function
