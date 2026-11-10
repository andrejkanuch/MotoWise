-- Migration: 00197_rider_insights_schema
-- Rider insights: the additive schema for per-ride derived stats, plus the purge
-- of that derived data with the ride.
--
-- WHAT IT ADDS
--   * rides: end_source, track_updated_at, and an index for "this rider's
--     completed, live rides, newest first".
--   * ride_private_details: one owner-only row per ride for what the rider's
--     device reported or the rider answered: time_zone, purpose, passenger. Kept
--     off rides on purpose: rides is readable by every signed-in rider for a
--     public or unlisted ride (00084), so a column there would leak through
--     PostgREST even with the GraphQL field hidden.
--   * ride_stats: one row per ride, computed by the API from the ride's
--     waypoints (or its polyline, or neither), versioned by stats_version and
--     written by an idempotent upsert. Every insight aggregate is SQL over these
--     rows. A ride with no geometry still gets a row (input_source = 'none')
--     carrying its distance and time, so totals count it; every
--     geometry-derived column is therefore nullable.
--   * ride_tracks: one simplified route geometry per ride.
--   * ref_country_parts, ref_regions, ref_places: reference geodata (Natural
--     Earth admin-0, GeoNames admin-1 names and cities15000). Created EMPTY: an
--     owner-run loader fills them in one transaction.
--   * users.is_synthetic: flags generated demo accounts.
--   * odometer_readings.source gains 'ride_end', written only by the new
--     log_ride_end_odometer() (one per ride; a corrected value updates it).
--   * ride_track_points(): a rider's own ride track in one row of arrays,
--     optionally downsampled, so reads are not cut at PostgREST's 1,000-row cap.
--   * purge_soft_deleted_rides(): also deletes ride_stats, ride_tracks and
--     ride_private_details of the rides it purges. ride_stats and ride_tracks hold
--     the same location detail as the raw track (stops, places, cells, route
--     geometry); ride_private_details holds the rider's zone and answers. The purge
--     anonymises rides rather than deleting them, so ON DELETE CASCADE alone would
--     never remove these rows; they follow the track on the same 30-day schedule.
--   * Three service-role helpers for the API's stats compute and sweep:
--     ride_stats_places() (countries, start and end towns of a route, from the
--     reference geodata), ride_stats_stale_rides() and ride_stats_stale_count()
--     (rides whose ride_stats row is missing, outdated or older than their track).
--
-- ACCESS
--   ride_stats, ride_tracks and the reference tables have RLS on, no policies,
--   and no privilege for PUBLIC, anon or authenticated. Supabase's default
--   privileges grant ALL on every new table (and EXECUTE on every new function)
--   to anon and authenticated explicitly, so each object is revoked by name
--   (00176, 00178). The API reads them only through service-role RPCs after its
--   own tier check, which keeps Pro detail on the server.
--   The three ride_stats_* helpers are SECURITY INVOKER and executable by
--   service_role only.
--   ride_private_details has RLS on with owner-only policies: a rider selects,
--   inserts and updates only rows whose user_id is their own, and inserts or
--   updates only for a ride they own. No PUBLIC or anon privilege; authenticated
--   gets SELECT, INSERT and UPDATE only (no DELETE: rows go with the ride);
--   service_role gets full access (the stats compute reads the zone). The API
--   writes it through the rider's own client and re-validates time_zone; a CHECK
--   constrains purpose.
--   rides gets no column-level revoke: the API writes rides through the rider's
--   own client and the table-wide grant would make a column revoke ineffective.
--   A CHECK constrains end_source.
--   users.is_synthetic gets no client grant: 00178 replaced the table-wide grants
--   on users with column lists, and a new column is in none of them.
--
-- ACCOUNT DELETION: ride_stats, ride_tracks and ride_private_details cascade from
-- rides and users, so hard_delete_expired_accounts() covers them with no change.
--
-- PREREQUISITES
--   * 00196 applied and verified. It set purge_soft_deleted_rides() to
--     service_role only; the function is re-created here with CREATE OR REPLACE,
--     which keeps that ACL, and the ACL is re-asserted below anyway.
--   * PostGIS installed (3.3.7 on production since 00064).
--
-- DEPLOY ORDER: apply and verify BEFORE the API that writes ride_stats,
-- ride_tracks, ride_private_details or the new rides columns deploys (the API
-- deploys on merge).
-- Apply as ONE statement batch (one Management API call) with this leading
-- comment block stripped, record version 00197 in
-- supabase_migrations.schema_migrations, then run the footer queries.
--
-- ROLLBACK (nothing reads these objects until the API that uses them deploys):
--   restore 00048's body of purge_soft_deleted_rides() with CREATE OR REPLACE;
--   DROP FUNCTION public.ride_track_points(uuid, integer),
--     public.log_ride_end_odometer(uuid, integer, text),
--     public.ride_stats_places(text, double precision, double precision,
--       double precision, double precision),
--     public.ride_stats_stale_rides(smallint, integer, uuid[]),
--     public.ride_stats_stale_count(smallint, timestamptz);
--   DELETE FROM public.odometer_readings WHERE source = 'ride_end'; then restore
--     the source CHECK without 'ride_end';
--   DROP TABLE public.ride_stats, public.ride_tracks, public.ride_private_details,
--     public.ref_country_parts, public.ref_regions, public.ref_places;
--   DROP INDEX public.idx_rides_user_started_completed;
--   ALTER TABLE public.rides DROP COLUMN end_source, DROP COLUMN track_updated_at;
--   ALTER TABLE public.users DROP COLUMN is_synthetic.

BEGIN;

-- ============================================================
-- 1. rides: recording additions
-- ============================================================
ALTER TABLE public.rides
  ADD COLUMN end_source text
    CONSTRAINT rides_end_source_check
    CHECK (end_source IN ('rider_phone', 'rider_carplay', 'client_auto', 'server_idle',
                          'stale_on_start', 'new_ride_save')),
  ADD COLUMN track_updated_at timestamptz;

COMMENT ON COLUMN public.rides.end_source IS
  'How the ride ended: rider_phone, rider_carplay, client_auto (app auto-end), server_idle (idle sweep), stale_on_start (superseded at the next start), new_ride_save (saved as the next ride started). NULL for rides ended before this column existed. Does not change auto_ended_reason, which only server ends set.';
COMMENT ON COLUMN public.rides.track_updated_at IS
  'When the ride''s track last changed (ride end, late waypoint upload). A ride_stats row computed before this is stale.';

CREATE INDEX idx_rides_user_started_completed
  ON public.rides (user_id, started_at DESC)
  WHERE status = 'completed' AND deleted_at IS NULL;

-- ============================================================
-- 1b. ride_private_details: the rider's own zone and answers, owner only
-- ============================================================
CREATE TABLE public.ride_private_details (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  time_zone text,
  purpose text
    CONSTRAINT ride_private_details_purpose_check
    CHECK (purpose IN ('leisure', 'commute', 'tour', 'errand', 'track', 'offroad', 'other')),
  passenger boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ride_private_details IS
  'What the rider''s device reported or the rider answered about a ride, readable by the owner only (rides itself is readable by any signed-in rider for a public or unlisted ride). One row per ride, upserted by the API with the rider''s client. Purged with the ride.';
COMMENT ON COLUMN public.ride_private_details.time_zone IS
  'IANA zone of the device at ride start, as the client sent it. The stats compute re-validates it and falls back to the start point''s zone.';
COMMENT ON COLUMN public.ride_private_details.purpose IS
  'Optional purpose the rider picked after the ride. NULL = not answered.';
COMMENT ON COLUMN public.ride_private_details.passenger IS
  'Optional: whether the rider carried a passenger. NULL = not answered.';

-- The stats compute's fallback: the rider's latest reported zone.
CREATE INDEX idx_ride_private_details_user_created
  ON public.ride_private_details (user_id, created_at DESC);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ride_private_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.ride_private_details ENABLE ROW LEVEL SECURITY;

-- Insert and update also require the ride to be the rider's own, so no one can
-- park a row on another rider's ride (it would block the owner's upsert).
CREATE POLICY ride_private_details_select_own ON public.ride_private_details
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY ride_private_details_insert_own ON public.ride_private_details
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = ride_private_details.ride_id AND r.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ride_private_details_update_own ON public.ride_private_details
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = ride_private_details.ride_id AND r.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON public.ride_private_details FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ride_private_details TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_private_details TO service_role;

-- ============================================================
-- 2. ride_stats: per-ride derived values
-- ============================================================
CREATE TABLE public.ride_stats (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id uuid,
  stats_version smallint NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  input_source text NOT NULL CHECK (input_source IN ('waypoints', 'polyline', 'none')),
  wp_count integer,
  wp_truncated boolean,
  -- Local time: the ride's zone, else the start point's, else the rider's latest
  -- known zone, else UTC. Always resolved, so never null.
  time_zone text NOT NULL,
  local_date date NOT NULL,
  local_start_hour smallint NOT NULL CHECK (local_start_hour BETWEEN 0 AND 23),
  local_dow smallint NOT NULL CHECK (local_dow BETWEEN 1 AND 7),
  distance_m integer NOT NULL,
  elapsed_s integer NOT NULL,
  moving_time_s integer,
  avg_moving_speed_mps real,
  max_speed_mps real,
  climb_m integer,
  descent_m integer,
  max_altitude_m integer,
  min_altitude_m integer,
  bends_count integer,
  bends_per_km real,
  band_km jsonb,
  lean_bands jsonb,
  night_m integer,
  stop_count integer,
  stops jsonb,
  countries text[],
  start_region text,
  start_place text,
  end_place text,
  start_cell bigint,
  cells bigint[],
  gps_quality real,
  gps_metrics jsonb,
  weather jsonb,
  weather_fetched_at timestamptz,
  temp_min_c real,
  temp_max_c real,
  wet boolean
);

COMMENT ON TABLE public.ride_stats IS
  'Derived per-ride stats, one row per ride, computed by the API and versioned by stats_version. Service role only: no client privilege, read through RPCs. Holds location detail (stops, places, cells): purged with the ride.';
COMMENT ON COLUMN public.ride_stats.motorcycle_id IS
  'The ride''s bike when the row was computed (snapshot, no FK). Joins use rides.motorcycle_id.';
COMMENT ON COLUMN public.ride_stats.input_source IS
  'waypoints, polyline, or none (no geometry: only distance and time from rides; every geometry-derived column is null).';
COMMENT ON COLUMN public.ride_stats.local_dow IS 'ISO day of week in the ride''s zone, 1 = Monday.';
COMMENT ON COLUMN public.ride_stats.band_km IS
  'Routed km in each road-character band: {"straight","sweeping","twisty","tight"}.';
COMMENT ON COLUMN public.ride_stats.lean_bands IS
  'Estimated share of corners per lean band (under 20, 20-30, 30-40, 40 and over degrees). NULL without waypoints.';
COMMENT ON COLUMN public.ride_stats.countries IS
  'ISO alpha-2 codes in order of first entry; a country counts with at least 1 km of route inside its border shrunk by 500 m.';
COMMENT ON COLUMN public.ride_stats.start_region IS
  'First-level administrative area where the ride started: ref_regions key as <iso_a2>.<admin1_code>.';
COMMENT ON COLUMN public.ride_stats.cells IS
  'Distinct H3 resolution 9 cells the route touches, sorted. A resolution change is a stats_version bump and a full recompute.';

CREATE INDEX idx_ride_stats_user_date ON public.ride_stats (user_id, local_date DESC);

-- ============================================================
-- 3. ride_tracks: route geometry per ride
-- ============================================================
CREATE TABLE public.ride_tracks (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('waypoints', 'polyline')),
  route geometry(LineString, 4326) NOT NULL,
  built_at timestamptz NOT NULL DEFAULT now(),
  stats_version smallint NOT NULL
);

COMMENT ON TABLE public.ride_tracks IS
  'Simplified route geometry per ride, built with its ride_stats row. Service role only. Purged with the ride.';

CREATE INDEX idx_ride_tracks_route ON public.ride_tracks USING gist (route);
CREATE INDEX idx_ride_tracks_user ON public.ride_tracks (user_id);

-- ============================================================
-- 4. Reference geodata (filled by the owner-run loader)
-- ============================================================
CREATE TABLE public.ref_country_parts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  iso_a2 text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('border', 'core')),
  geom geometry(Polygon, 4326) NOT NULL
);

COMMENT ON TABLE public.ref_country_parts IS
  'Natural Earth admin-0 (ISO_A2_EH), subdivided into small polygons. kind = border: the country as published. kind = core: the country shrunk inward by 500 m (negative buffer on geography) and THEN subdivided, so subdivision seams never become gaps. Countries on a route are counted against core parts.';

CREATE INDEX idx_ref_country_parts_geom ON public.ref_country_parts USING gist (geom);

CREATE TABLE public.ref_regions (
  iso_a2 text NOT NULL,
  admin1_code text NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (iso_a2, admin1_code)
);

COMMENT ON TABLE public.ref_regions IS
  'GeoNames admin1CodesASCII: first-level administrative area names keyed by country and admin-1 code (CC BY 4.0).';

CREATE TABLE public.ref_places (
  geonameid integer PRIMARY KEY,
  name text NOT NULL,
  iso_a2 text NOT NULL,
  admin1_code text,
  population integer,
  geom geometry(Point, 4326) NOT NULL
);

COMMENT ON TABLE public.ref_places IS
  'GeoNames cities15000 (CC BY 4.0): nearest town within 25 km of a ride''s start and end, and the start region through admin1_code.';

CREATE INDEX idx_ref_places_geom ON public.ref_places USING gist (geom);

-- ============================================================
-- 5. Access: RLS on, no policies, no client privilege
-- ============================================================
ALTER TABLE public.ride_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_country_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_places ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ride_stats, public.ride_tracks,
  public.ref_country_parts, public.ref_regions, public.ref_places
  FROM PUBLIC, anon, authenticated;

-- The API computes and writes ride_stats/ride_tracks and reads the reference
-- data as service_role (the default privileges already grant it; stated here so
-- the contract does not depend on them).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_stats, public.ride_tracks TO service_role;
GRANT SELECT ON public.ref_country_parts, public.ref_regions, public.ref_places TO service_role;

-- ============================================================
-- 6. users.is_synthetic
-- ============================================================
ALTER TABLE public.users ADD COLUMN is_synthetic boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_synthetic IS
  'Generated demo account. Still gets its own insights; excluded from other riders'' baselines, metrics and backfill progress, and processed last. Set by the owner only (no client grant).';

-- ============================================================
-- 7. Odometer reading at ride end
-- ============================================================
ALTER TABLE public.odometer_readings DROP CONSTRAINT odometer_readings_source_check;
ALTER TABLE public.odometer_readings ADD CONSTRAINT odometer_readings_source_check
  CHECK (source IN ('manual', 'gps_ride', 'initial', 'backfill', 'ride_end'));

-- SECURITY DEFINER: clients hold no write privilege on odometer_readings (00181).
-- Called on the RIDER's client: auth.uid() is pinned, the ride must be the
-- caller's live ride and its bike the caller's live bike; service-role calls
-- (auth.uid() NULL) are refused. log_odometer_reading() is left as it is: an
-- overload would make free odometer logging ambiguous to PostgREST.
--
-- p_value is in p_unit ('km' or 'mi') and is stored in the bike's distance_unit
-- (00180), like every odometer_readings.value. One ride gets at most one
-- 'ride_end' reading: a replay with the same value returns the existing
-- reading's id and changes nothing; a different value is a correction and
-- updates that reading in place.
--
-- The typed value is the bike's odometer unless a reading NOT of this ride is
-- newer than the ride's end. This ride's own readings are ignored on purpose:
-- endRide adds the GPS distance first, and the 00181 trigger logs that as a
-- 'gps_ride' reading with this ride_id stamped at processing time, after
-- ended_at. The typed value is meant to replace that estimate: when it moves
-- the bike, the ride's 'gps_ride' reading is deleted.
--
-- Another ride's 'gps_ride' reading is dated by that ride's ended_at, not by
-- its recorded_at: the trigger stamps it when the ride SYNCS, so two rides
-- recorded offline would otherwise make the earlier ride's estimate look newer
-- than the later ride's end, and the later ride's typed value would be taken
-- for history.
--
-- The ride must be completed: a value logged before endRide would move the
-- bike, and endRide would then add the GPS distance on top. A ride still
-- recording is refused with 55000 (object_not_in_prerequisite_state).
--
-- Returns the reading's id and bike_moved: whether this call set the bike's
-- odometer to the typed value. False for a history reading and for a replay of
-- the same value; endRide then still owes the bike the ride's GPS distance.
CREATE FUNCTION public.log_ride_end_odometer(
  p_ride_id uuid,
  p_value integer,
  p_unit text,
  OUT reading_id uuid,
  OUT bike_moved boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_km_per_mile CONSTANT numeric := 1.609344;
  v_motorcycle_id uuid;
  v_ended_at timestamptz;
  v_status text;
  v_bike_unit text;
  v_value integer;
  v_recorded_at timestamptz;
  v_reading_id uuid;
  v_existing_value integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_value IS NULL OR p_value < 0 THEN
    RAISE EXCEPTION 'invalid_value' USING ERRCODE = '22023';
  END IF;

  IF p_unit IS NULL OR p_unit NOT IN ('km', 'mi') THEN
    RAISE EXCEPTION 'invalid_unit' USING ERRCODE = '22023';
  END IF;

  SELECT r.motorcycle_id, r.ended_at, r.status INTO v_motorcycle_id, v_ended_at, v_status
  FROM public.rides r
  WHERE r.id = p_ride_id AND r.user_id = v_uid AND r.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ride_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'ride_not_completed' USING ERRCODE = '55000';
  END IF;

  -- Row lock, as in log_odometer_reading(): readings for one bike are
  -- serialised, which also makes the replay check below race-free.
  SELECT m.distance_unit INTO v_bike_unit
  FROM public.motorcycles m
  WHERE m.id = v_motorcycle_id AND m.user_id = v_uid AND m.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'motorcycle_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_value := CASE
    WHEN p_unit = COALESCE(v_bike_unit, 'km') THEN p_value
    WHEN p_unit = 'km' THEN round(p_value / v_km_per_mile)::integer
    ELSE round(p_value * v_km_per_mile)::integer
  END;

  SELECT o.id, o.value, o.recorded_at INTO v_reading_id, v_existing_value, v_recorded_at
  FROM public.odometer_readings o
  WHERE o.ride_id = p_ride_id AND o.source = 'ride_end';
  bike_moved := false;
  IF FOUND THEN
    IF v_existing_value = v_value THEN
      reading_id := v_reading_id;
      RETURN;
    END IF;
    UPDATE public.odometer_readings SET value = v_value WHERE id = v_reading_id;
  ELSE
    v_recorded_at := LEAST(COALESCE(v_ended_at, now()), now());

    INSERT INTO public.odometer_readings (user_id, motorcycle_id, value, recorded_at, source, ride_id)
    VALUES (v_uid, v_motorcycle_id, v_value, v_recorded_at, 'ride_end', p_ride_id)
    RETURNING id INTO v_reading_id;
  END IF;

  -- Same rule as log_odometer_reading(): a reading older than the latest one is
  -- history and does not move the bike's current odometer. This ride's own
  -- readings (its gps_ride estimate) do not count as later ones, and another
  -- ride's gps_ride estimate counts from that ride's end (see above).
  IF NOT EXISTS (
    SELECT 1
    FROM public.odometer_readings o
    LEFT JOIN public.rides lr ON lr.id = o.ride_id
    WHERE o.motorcycle_id = v_motorcycle_id
      AND o.ride_id IS DISTINCT FROM p_ride_id
      AND CASE
            WHEN o.source = 'gps_ride' THEN COALESCE(lr.ended_at, o.recorded_at)
            ELSE o.recorded_at
          END > v_recorded_at
  ) THEN
    -- Tells trg_motorcycles_log_odometer (00181) this write is already logged,
    -- so it does not add a second reading. Cleared straight after the UPDATE.
    PERFORM set_config('app.odometer_logged', '1', true);

    UPDATE public.motorcycles
    SET current_mileage = v_value,
        mileage_updated_at = v_recorded_at,
        odometer_sync_source = 'manual',
        odometer_last_ride_id = NULL
    WHERE id = v_motorcycle_id AND user_id = v_uid;

    PERFORM set_config('app.odometer_logged', '', true);

    -- The typed value replaces this ride's GPS estimate, so the estimate is
    -- retired: otherwise it stays the bike's newest reading (stamped after
    -- ended_at) while current_mileage shows the typed value. A history end
    -- reading (the branch not taken) leaves the estimate alone.
    DELETE FROM public.odometer_readings
    WHERE ride_id = p_ride_id AND source = 'gps_ride';

    bike_moved := true;
  END IF;

  reading_id := v_reading_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_ride_end_odometer(uuid, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_ride_end_odometer(uuid, integer, text) TO authenticated;

-- ============================================================
-- 8. ride_track_points: a ride's fixes in one row of arrays
-- ============================================================
-- SECURITY INVOKER: runs under ride_waypoints RLS, so a rider sees only their
-- own live rides; another rider's ride (or one with no fixes) returns NO row.
-- The single row carries total_points (the ride's fix count) and parallel
-- arrays in recorded_at order. With p_max_points NULL, or not below the fix
-- count, every fix is returned; otherwise exactly p_max_points (at least 2)
-- evenly spaced fixes, always including the first and the last.
CREATE FUNCTION public.ride_track_points(
  p_ride_id uuid,
  p_max_points integer DEFAULT NULL
)
RETURNS TABLE (
  total_points integer,
  recorded_at timestamptz[],
  latitude double precision[],
  longitude double precision[],
  altitude real[],
  speed_mps real[],
  heading real[],
  accuracy real[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH pts AS (
    SELECT
      w.recorded_at, w.latitude, w.longitude, w.altitude, w.speed_mps, w.heading, w.accuracy,
      (row_number() OVER (ORDER BY w.recorded_at) - 1)::integer AS idx
    FROM public.ride_waypoints w
    WHERE w.ride_id = p_ride_id
  ),
  total AS (
    SELECT count(*)::integer AS n FROM pts
  ),
  cap AS (
    -- GREATEST ignores NULL, so "no cap" is kept explicitly.
    SELECT CASE WHEN p_max_points IS NULL THEN NULL ELSE GREATEST(p_max_points, 2) END AS m
  ),
  keep AS (
    SELECT round(g::numeric * (t.n - 1) / (c.m - 1))::integer AS idx
    FROM total t, cap c, generate_series(0, c.m - 1) g
    WHERE t.n > c.m
  )
  SELECT
    t.n,
    array_agg(p.recorded_at ORDER BY p.idx),
    array_agg(p.latitude ORDER BY p.idx),
    array_agg(p.longitude ORDER BY p.idx),
    array_agg(p.altitude ORDER BY p.idx),
    array_agg(p.speed_mps ORDER BY p.idx),
    array_agg(p.heading ORDER BY p.idx),
    array_agg(p.accuracy ORDER BY p.idx)
  FROM pts p
  CROSS JOIN total t
  CROSS JOIN cap c
  WHERE c.m IS NULL OR t.n <= c.m OR p.idx IN (SELECT k.idx FROM keep k)
  GROUP BY t.n
$$;

REVOKE ALL ON FUNCTION public.ride_track_points(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ride_track_points(uuid, integer) TO authenticated, service_role;

-- ============================================================
-- 9. Purge derived data with the raw track (00048's body plus three deletes)
-- ============================================================
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_rides()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Derived data first: stops, places, cells and route geometry are location
  -- data just like the waypoints.
  DELETE FROM public.ride_stats
  WHERE ride_id IN (
    SELECT id FROM public.rides
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days'
  );

  DELETE FROM public.ride_tracks
  WHERE ride_id IN (
    SELECT id FROM public.rides
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days'
  );

  -- The rider's zone and answers. Rides are anonymised below, not deleted, so the
  -- ON DELETE CASCADE never fires for them.
  DELETE FROM public.ride_private_details
  WHERE ride_id IN (
    SELECT id FROM public.rides
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days'
  );

  -- Hard-delete waypoints for rides deleted >30 days ago
  DELETE FROM public.ride_waypoints
  WHERE ride_id IN (
    SELECT id FROM public.rides
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days'
  );

  -- Anonymize rides: null location PII
  UPDATE public.rides
  SET
    route_polyline = NULL,
    region = NULL,
    weather_snapshot = NULL
  WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '30 days';
END $$;

-- The ACL 00196 set (CREATE OR REPLACE keeps it; re-asserted so this file alone
-- leaves the purge service-role only).
REVOKE ALL ON FUNCTION public.purge_soft_deleted_rides() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted_rides() TO service_role;

-- ============================================================
-- 10. Stats helpers for the API (service role only)
-- ============================================================
-- All three are SECURITY INVOKER: only service_role may execute them, and it
-- already reads every table they touch (it bypasses RLS), so they need no
-- elevated rights. Each pins an empty search_path and names every object,
-- PostGIS functions and operators included, by schema.

-- Measures a route against the reference geodata for the per-ride stats.
--   p_route: EWKT 'SRID=4326;LINESTRING(lng lat, ...)'; p_start_* / p_end_*: the
--   ride's first and last fix.
-- Returns
--   { reference_ready: ref_country_parts has rows,
--     countries: [{ iso_a2, core_m, first_at }],
--     start_place, end_place: { name, iso_a2, admin1_code } | null }
--   core_m: metres (geodesic) of the route inside the country's kind = 'core'
--     parts, the country shrunk 500 m inward, so a road along a border does not
--     count the neighbour. Every country whose core the route touches is listed;
--     the API applies the 1 km floor.
--   first_at: route fraction (0-1) where the route first enters that core.
--   start_place / end_place: the nearest ref_places town within 25 km.
-- Cost: the GiST index on ref_country_parts.geom picks the subdivided parts
-- whose box meets the route, ST_Intersects drops the rest, and ST_Intersection
-- runs only on those small parts. Towns: an index box of about 25 km around the
-- point, then exact geodesic distance on the few candidates.
CREATE FUNCTION public.ride_stats_places(
  p_route text,
  p_start_lat double precision,
  p_start_lng double precision,
  p_end_lat double precision,
  p_end_lng double precision
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH route AS (
    SELECT public.ST_GeomFromEWKT(p_route) AS g
  ),
  pieces AS (
    SELECT p.iso_a2, d.geom AS piece
    FROM route r
    JOIN public.ref_country_parts p
      ON p.kind = 'core'
     AND public.ST_Intersects(p.geom, r.g)
    CROSS JOIN LATERAL public.ST_Dump(
      public.ST_CollectionExtract(public.ST_Intersection(r.g, p.geom), 2)
    ) d
  ),
  per_country AS (
    SELECT
      pc.iso_a2,
      sum(public.ST_Length(pc.piece::public.geography)) AS core_m,
      -- An intersection piece may come back reversed; its nearer end is the entry.
      min(LEAST(public.ST_LineLocatePoint(r.g, public.ST_StartPoint(pc.piece)),
                public.ST_LineLocatePoint(r.g, public.ST_EndPoint(pc.piece)))) AS first_at
    FROM pieces pc
    CROSS JOIN route r
    GROUP BY pc.iso_a2
  ),
  ends AS (
    SELECT e.which, public.ST_SetSRID(public.ST_MakePoint(e.lng, e.lat), 4326) AS pt, e.lat
    FROM (VALUES ('start', p_start_lat, p_start_lng), ('end', p_end_lat, p_end_lng)) AS e (which, lat, lng)
  ),
  places AS (
    SELECT
      e.which,
      (
        SELECT jsonb_build_object('name', pl.name, 'iso_a2', pl.iso_a2, 'admin1_code', pl.admin1_code)
        FROM public.ref_places pl
        -- 0.25 degrees of latitude is 27.8 km; longitude widens with latitude.
        WHERE pl.geom OPERATOR(public.&&) public.ST_Expand(
                e.pt, 0.25 / GREATEST(cos(radians(e.lat)), 0.01), 0.25)
          AND public.ST_DWithin(pl.geom::public.geography, e.pt::public.geography, 25000)
        ORDER BY public.ST_Distance(pl.geom::public.geography, e.pt::public.geography), pl.geonameid
        LIMIT 1
      ) AS place
    FROM ends e
  )
  SELECT jsonb_build_object(
    'reference_ready', EXISTS (SELECT 1 FROM public.ref_country_parts),
    'countries', COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object('iso_a2', c.iso_a2, 'core_m', c.core_m, 'first_at', c.first_at)
                ORDER BY c.first_at, c.iso_a2)
       FROM per_country c),
      '[]'::jsonb),
    'start_place', (SELECT pl.place FROM places pl WHERE pl.which = 'start'),
    'end_place', (SELECT pl.place FROM places pl WHERE pl.which = 'end')
  )
$$;

REVOKE ALL ON FUNCTION public.ride_stats_places(text, double precision, double precision,
  double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ride_stats_places(text, double precision, double precision,
  double precision, double precision) TO service_role;

-- Rides whose stats the sweep must (re)compute: completed, not soft-deleted, not
-- in p_exclude (the API's list of rides whose compute threw), and with no
-- ride_stats row, a row below p_stats_version, or a track that changed after
-- the row was computed (late waypoint upload). Real riders first, synthetic
-- accounts last, then oldest change first. stale_since is when the ride last
-- changed: COALESCE(track_updated_at, ended_at).
CREATE FUNCTION public.ride_stats_stale_rides(
  p_stats_version smallint,
  p_limit integer,
  p_exclude uuid[]
)
RETURNS TABLE (
  ride_id uuid,
  user_id uuid,
  is_synthetic boolean,
  stale_since timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT r.id, r.user_id, u.is_synthetic, COALESCE(r.track_updated_at, r.ended_at)
  FROM public.rides r
  JOIN public.users u ON u.id = r.user_id
  LEFT JOIN public.ride_stats s ON s.ride_id = r.id
  WHERE r.status = 'completed'
    AND r.deleted_at IS NULL
    AND r.id <> ALL (COALESCE(p_exclude, '{}'::uuid[]))
    AND (s.ride_id IS NULL
         OR s.stats_version < p_stats_version
         OR r.track_updated_at > s.computed_at)
  ORDER BY u.is_synthetic, COALESCE(r.track_updated_at, r.ended_at) NULLS LAST, r.id
  LIMIT p_limit
$$;

REVOKE ALL ON FUNCTION public.ride_stats_stale_rides(smallint, integer, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ride_stats_stale_rides(smallint, integer, uuid[]) TO service_role;

-- How many rides are stale by the rule above (no exclusion) and last changed
-- before p_older_than. The sweep reports a non-zero count for an hour ago.
CREATE FUNCTION public.ride_stats_stale_count(
  p_stats_version smallint,
  p_older_than timestamptz
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT count(*)::integer
  FROM public.rides r
  LEFT JOIN public.ride_stats s ON s.ride_id = r.id
  WHERE r.status = 'completed'
    AND r.deleted_at IS NULL
    AND (s.ride_id IS NULL
         OR s.stats_version < p_stats_version
         OR r.track_updated_at > s.computed_at)
    AND COALESCE(r.track_updated_at, r.ended_at) < p_older_than
$$;

REVOKE ALL ON FUNCTION public.ride_stats_stale_count(smallint, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ride_stats_stale_count(smallint, timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Post-apply verification (read-only; run each and report the output):
--
--   SELECT c.relname, c.relrowsecurity, array_to_string(c.relacl, ',') AS acl
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public'
--     AND c.relname IN ('ride_stats', 'ride_tracks', 'ref_country_parts', 'ref_regions', 'ref_places')
--   ORDER BY 1;
--   -- expect 5 rows, relrowsecurity = true; acl has postgres and service_role
--   --   entries only: NO `=` (PUBLIC), `anon=` or `authenticated=` entry
--
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('ride_stats', 'ride_tracks', 'ref_country_parts', 'ref_regions', 'ref_places');
--   -- expect: 0 rows (service role only)
--
--   SELECT c.relrowsecurity, array_to_string(c.relacl, ',') AS acl
--   FROM pg_class c WHERE c.oid = 'public.ride_private_details'::regclass;
--   -- expect relrowsecurity = true; acl has postgres=arwdDxt..., authenticated=arw/...
--   --   (SELECT, INSERT, UPDATE only) and service_role=arwd/...; NO `=` (PUBLIC) or
--   --   `anon=` entry
--
--   SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'ride_private_details' ORDER BY 1;
--   -- expect 3 rows, all roles {authenticated}: ride_private_details_insert_own (INSERT),
--   --   ride_private_details_select_own (SELECT), ride_private_details_update_own (UPDATE);
--   --   each tests user_id = (SELECT auth.uid()); insert and update also require
--   --   the ride to be the rider's own
--
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef,
--          array_to_string(p.proacl, ',') AS acl
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('log_ride_end_odometer', 'ride_track_points', 'purge_soft_deleted_rides',
--                       'log_odometer_reading', 'ride_stats_places', 'ride_stats_stale_rides',
--                       'ride_stats_stale_count')
--   ORDER BY 1;
--   -- expect exactly 7 rows:
--   --   log_ride_end_odometer (uuid, integer, text): prosecdef t; acl postgres=X and
--   --     authenticated=X only (no `=X/`, anon=X or service_role=X)
--   --   ride_track_points (uuid, integer): prosecdef f; acl postgres=X, authenticated=X,
--   --     service_role=X (no `=X/` or anon=X)
--   --   purge_soft_deleted_rides (): prosecdef t; acl postgres=X and service_role=X only
--   --   log_odometer_reading (uuid, integer, timestamptz): unchanged from 00181 (one row,
--   --     no overload; authenticated=X, no anon=X)
--   --   ride_stats_places (p_route text, p_start_lat double precision, p_start_lng double
--   --     precision, p_end_lat double precision, p_end_lng double precision),
--   --   ride_stats_stale_count (p_stats_version smallint, p_older_than timestamp with time zone),
--   --   ride_stats_stale_rides (p_stats_version smallint, p_limit integer, p_exclude uuid[]):
--   --     each prosecdef f; acl postgres=X and service_role=X only (no `=X/`, anon=X or
--   --     authenticated=X)
--
--   SELECT p.proname, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname LIKE 'ride_stats\_%'
--   ORDER BY 1;
--   -- expect 3 rows, each proconfig {"search_path=\"\""}
--
--   SELECT public.ride_stats_places('SRID=4326;LINESTRING(0 0,0.001 0.001)', 0, 0, 0.001, 0.001)
--     ->> 'reference_ready' AS reference_ready;
--   -- expect: false right after apply (true once the loader has filled ref_country_parts)
--
--   SELECT public.ride_stats_stale_count(1::smallint, now()) = (
--     SELECT count(*) FROM public.rides
--     WHERE status = 'completed' AND deleted_at IS NULL AND COALESCE(track_updated_at, ended_at) < now()
--   ) AS every_finished_ride_stale;
--   -- expect: t right after apply (ride_stats is empty, so every finished ride is stale)
--
--   SELECT pg_get_functiondef('public.purge_soft_deleted_rides()'::regprocedure) LIKE '%ride_stats%'
--      AND pg_get_functiondef('public.purge_soft_deleted_rides()'::regprocedure) LIKE '%ride_tracks%'
--      AND pg_get_functiondef('public.purge_soft_deleted_rides()'::regprocedure) LIKE '%ride_private_details%'
--      AS purge_covers_derived;
--   -- expect: t
--
--   SELECT tablename, indexname, indexdef FROM pg_indexes
--   WHERE schemaname = 'public'
--     AND indexname IN ('idx_rides_user_started_completed', 'idx_ride_stats_user_date',
--                       'idx_ride_tracks_route', 'idx_ride_tracks_user',
--                       'idx_ref_country_parts_geom', 'idx_ref_places_geom',
--                       'idx_ride_private_details_user_created')
--   ORDER BY 1, 2;
--   -- expect 7 rows; the ride_private_details index is (user_id, created_at DESC); the rides index has WHERE status = 'completed' AND deleted_at IS NULL;
--   --   the three geometry indexes are USING gist
--
--   SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND ((table_name = 'rides' AND column_name IN ('time_zone', 'purpose', 'passenger',
--                                                    'end_source', 'track_updated_at'))
--       OR (table_name = 'users' AND column_name = 'is_synthetic'))
--   ORDER BY 1, 2;
--   -- expect 3 rows: rides.end_source, rides.track_updated_at, users.is_synthetic
--   --   (boolean, NOT NULL (is_nullable NO), default false). rides has NO time_zone,
--   --   purpose or passenger: those live in ride_private_details only
--
--   SELECT grantee, privilege_type FROM information_schema.column_privileges
--   WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_synthetic'
--     AND grantee IN ('anon', 'authenticated');
--   -- expect: 0 rows
--
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname IN ('odometer_readings_source_check', 'rides_end_source_check',
--                     'ride_private_details_purpose_check');
--   -- expect 3 rows; odometer_readings_source_check includes 'ride_end'
--
--   SELECT
--     (SELECT count(*) FROM public.ride_stats) AS ride_stats,
--     (SELECT count(*) FROM public.ride_tracks) AS ride_tracks,
--     (SELECT count(*) FROM public.ride_private_details) AS ride_private_details,
--     (SELECT count(*) FROM public.ref_country_parts) AS ref_country_parts,
--     (SELECT count(*) FROM public.ref_regions) AS ref_regions,
--     (SELECT count(*) FROM public.ref_places) AS ref_places,
--     (SELECT count(*) FROM public.users WHERE is_synthetic) AS synthetic_users,
--     (SELECT count(*) FROM public.odometer_readings WHERE source = 'ride_end') AS ride_end_readings,
--     (SELECT count(*) FROM public.rides WHERE end_source IS NOT NULL) AS rides_with_end_source;
--   -- expect: all 0 right after apply (nothing writes them until the API deploys
--   --   and the loader runs)
