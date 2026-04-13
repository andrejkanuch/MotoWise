-- MOT-183: Crowd-sourced surface condition reports

-- Enum for surface conditions
CREATE TYPE surface_condition AS ENUM (
  'smooth',
  'rough',
  'gravel',
  'potholes',
  'wet',
  'icy',
  'debris',
  'construction'
);

-- Surface reports table
CREATE TABLE surface_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id    UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  condition   surface_condition NOT NULL,
  note        TEXT,
  photo_url   TEXT,

  -- One report per user per route per day
  CONSTRAINT uq_surface_report_per_day
    UNIQUE (route_id, user_id, (reported_at::date))
);

-- Indexes
CREATE INDEX idx_surface_reports_route_date
  ON surface_reports (route_id, reported_at DESC);

CREATE INDEX idx_surface_reports_user
  ON surface_reports (user_id);

-- RLS
ALTER TABLE surface_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read surface reports
CREATE POLICY "surface_reports_select"
  ON surface_reports FOR SELECT
  USING (true);

-- Authenticated users can insert their own reports
CREATE POLICY "surface_reports_insert"
  ON surface_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reports
CREATE POLICY "surface_reports_update"
  ON surface_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reports
CREATE POLICY "surface_reports_delete"
  ON surface_reports FOR DELETE
  USING (auth.uid() = user_id);
