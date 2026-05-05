-- Migration: Explore Funnel & Monetization — schema extensions
--
-- Adds elevation_profile + best_season_months to trips (pre-computed data).
-- Extends user_gating_events with trip_id for trip-based GPX metering.
-- Extends trip_suggestions (00106) with new_route kind for country-page CTA.
-- Adds partial indexes for filter queries and place sitemap lookups.
--
-- See: docs/plans/2026-05-03-001-feat-explore-monetization-funnel-plan.md

BEGIN;

-- =================================================================
-- 1. New columns on trips
-- =================================================================

-- Elevation profile: pre-computed from Mapbox Tilequery backfill script.
-- Shape: Array<{distanceKm: number, elevationM: number, lat: number, lng: number}>
-- Includes lat/lng for map↔chart hover sync.
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS elevation_profile JSONB
  CHECK (
    elevation_profile IS NULL
    OR (
      jsonb_typeof(elevation_profile) = 'array'
      AND jsonb_array_length(elevation_profile) > 0
    )
  );

-- Best season: manually edited per trip, months 1-12.
-- Queryable with && (overlap) operator for "includes month 7" filters.
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS best_season_months SMALLINT[]
  DEFAULT '{}'
  CHECK (best_season_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::SMALLINT[]);

-- =================================================================
-- 2. Extend user_gating_events for trip-based GPX metering
-- =================================================================

-- New trip_id column alongside legacy route_id.
-- XOR-ish constraint: a row references at most one of route or trip.
-- Both-NULL is intentional: covers feature-level events (no content ref)
-- and orphaned rows after ON DELETE SET NULL preserves audit trail.
-- route_id will be dropped in a future migration once legacy routes are removed.
ALTER TABLE public.user_gating_events
  ADD COLUMN IF NOT EXISTS trip_id UUID
  REFERENCES public.trips(id) ON DELETE SET NULL;

-- Only add constraint if it doesn't already exist (<= 1 allows both-NULL; see above)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_gating_events_target_xor'
  ) THEN
    ALTER TABLE public.user_gating_events
      ADD CONSTRAINT user_gating_events_target_xor
      CHECK ((route_id IS NOT NULL)::int + (trip_id IS NOT NULL)::int <= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gating_events_trip
  ON public.user_gating_events (user_id, feature, trip_id)
  WHERE trip_id IS NOT NULL;

-- =================================================================
-- 3. Extend trip_suggestions (00106) for "Suggest a route" CTA
-- =================================================================

-- Allow country-level suggestions where no trip exists yet.
ALTER TABLE public.trip_suggestions
  ALTER COLUMN trip_id DROP NOT NULL;

-- New columns for country-level route suggestions.
ALTER TABLE public.trip_suggestions
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT
    CHECK (source_url IS NULL OR char_length(source_url) <= 2048);

-- Extend kind enum to cover the new use case.
ALTER TABLE public.trip_suggestions
  DROP CONSTRAINT IF EXISTS trip_suggestions_kind_check;
ALTER TABLE public.trip_suggestions
  ADD CONSTRAINT trip_suggestions_kind_check
  CHECK (kind IN ('waypoint', 'note', 'new_route'));

-- Ensure either trip_id (waypoint/note) OR country_code (new_route) is set.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trip_suggestions_target_check'
  ) THEN
    ALTER TABLE public.trip_suggestions
      ADD CONSTRAINT trip_suggestions_target_check
      CHECK (
        (kind IN ('waypoint', 'note') AND trip_id IS NOT NULL)
        OR (kind = 'new_route' AND country_code IS NOT NULL AND trip_id IS NULL)
      );
  END IF;
END $$;

-- =================================================================
-- 4. Partial index for trip template filter queries
-- =================================================================

CREATE INDEX IF NOT EXISTS idx_trips_template_filters
  ON public.trips (difficulty, surface_type, distance_m, estimated_duration_minutes)
  WHERE is_template = true AND NOT is_flagged;

-- =================================================================
-- 5. Index for place sitemap / noindex queries
-- =================================================================

CREATE INDEX IF NOT EXISTS idx_places_kind_route_count
  ON public.places (kind, route_count)
  WHERE kind IN ('country', 'region');

-- =================================================================
-- 6. RLS policies for new_route suggestions (trip_id IS NULL)
-- =================================================================
-- Existing policies (00106/00107) join on trip_id → trips, which
-- returns zero rows when trip_id IS NULL. These additive policies
-- cover the new_route kind so the feature is not dead on arrival.

CREATE POLICY "trip_suggestions_insert_new_route" ON public.trip_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (
    kind = 'new_route'
    AND author_user_id = (select auth.uid())
    AND trip_id IS NULL
    AND country_code IS NOT NULL
  );

CREATE POLICY "trip_suggestions_select_new_route" ON public.trip_suggestions
  FOR SELECT TO authenticated
  USING (
    kind = 'new_route'
    AND author_user_id = (select auth.uid())
  );

CREATE POLICY "trip_suggestions_delete_new_route" ON public.trip_suggestions
  FOR DELETE TO authenticated
  USING (
    kind = 'new_route'
    AND author_user_id = (select auth.uid())
  );

-- =================================================================
-- 7. Ordering index for listTemplates query
-- =================================================================

CREATE INDEX IF NOT EXISTS idx_trips_template_listing
  ON public.trips (published_at DESC NULLS LAST, id DESC)
  WHERE is_template = true AND NOT is_flagged;

-- =================================================================
-- 8. Monthly quota index for GPX export metering
-- =================================================================

CREATE INDEX IF NOT EXISTS idx_gating_events_quota
  ON public.user_gating_events (user_id, feature, year_month);

COMMIT;
