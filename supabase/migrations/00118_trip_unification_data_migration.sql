-- Migration: 00118_trip_unification_data_migration
--
-- Phase 2 of trip unification: Copies discover_trips → trips with is_template=true.
-- Deserializes JSONB waypoints → trip_waypoints rows.
-- Remaps self-referencing FKs.
--
-- IDEMPOTENT: Uses migrated_from_discover_trip_id guard + ON CONFLICT DO NOTHING.
-- SAFE: Old tables remain untouched. This only adds data.
--
-- See: docs/plans/2026-04-22-002-refactor-trip-unification-implementation-plan.md

BEGIN;

-- ==========================================
-- STEP 0: Disable triggers to prevent counter/tsv recalculation during bulk insert
-- ==========================================
ALTER TABLE public.trip_reviews DISABLE TRIGGER trg_update_trip_rating;
ALTER TABLE public.trips DISABLE TRIGGER trg_trips_search_tsv;

-- ==========================================
-- STEP 1: INSERT discover_trips → trips (first pass — creates mapping)
-- Each discover_trip becomes a trip with is_template = true
-- ==========================================
INSERT INTO public.trips (
  -- Template identity
  is_template, slug, country_code, region_code, city,
  -- Content
  title, description, difficulty, day_count,
  polyline, distance_m, elevation_gain_m, estimated_duration_minutes,
  surface_type, curvature_index,
  -- Counters (copied as-is, NOT trigger-computed)
  view_count, clone_count, average_rating, review_count,
  -- Editorial
  is_featured, is_motovault_pick,
  -- Timestamps
  published_at, created_at, updated_at,
  -- Ownership
  organiser_user_id,
  -- Trip defaults for template rows
  start_date, end_date, dates_pending, visibility, status, max_riders,
  -- Search
  search_tsv,
  -- Migration guard
  migrated_from_discover_trip_id
)
SELECT
  -- Template identity
  true, dt.slug, dt.country_code, dt.region_code, dt.city,
  -- Content (title capped at 150 per new CHECK constraint)
  LEFT(dt.title, 150),
  COALESCE(NULLIF(TRIM(dt.description), ''), 'A motorcycle route shared on MotoVault.'),
  dt.difficulty, dt.day_count,
  dt.polyline, dt.distance_m, dt.elevation_gain_m, dt.estimated_duration_minutes,
  dt.surface_type, dt.curvature_index,
  -- Counters (literal copy)
  dt.view_count, dt.clone_count, dt.average_rating, dt.review_count,
  -- Editorial
  dt.is_featured, dt.is_motovault_pick,
  -- Timestamps
  dt.published_at, dt.published_at, dt.updated_at,
  -- Ownership: use contributor, fall back to a system user if NULL
  COALESCE(dt.contributor_user_id, (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)),
  -- Trip defaults: sentinel dates for templates (they don't have real dates)
  '1970-01-01'::date, '1970-01-01'::date, true,
  'public'::public.content_visibility,
  'active',
  50,  -- max_riders: irrelevant for templates but satisfies NOT NULL
  -- Compute search_tsv inline (trigger is disabled)
  setweight(to_tsvector('english', coalesce(dt.title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(dt.description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(dt.city, '')), 'C'),
  -- Migration guard
  dt.id
FROM public.discover_trips dt
WHERE NOT EXISTS (
  SELECT 1 FROM public.trips t WHERE t.migrated_from_discover_trip_id = dt.id
);

-- ==========================================
-- STEP 2: Copy start_point/lat/lng from discover_trips
-- ==========================================
UPDATE public.trips t
SET
  start_point = dt.start_point,
  start_lat = dt.start_lat,
  start_lng = dt.start_lng
FROM public.discover_trips dt
WHERE t.migrated_from_discover_trip_id = dt.id
  AND dt.start_point IS NOT NULL
  AND t.start_point IS NULL;

-- ==========================================
-- STEP 3: Deserialize JSONB waypoints → trip_waypoints rows
-- Validates each element against trip_waypoints CHECK constraints.
-- Skips malformed entries (missing lat/lng or invalid type) instead of failing.
-- ==========================================
INSERT INTO public.trip_waypoints (trip_id, sort_order, day_index, type, name, notes, lat, lng)
SELECT
  t.id,
  COALESCE((elem->>'sortOrder')::int, ordinality::int),
  COALESCE((elem->>'dayIndex')::int, 0),
  elem->>'type',
  LEFT(COALESCE(NULLIF(TRIM(elem->>'name'), ''), 'Waypoint'), 200),
  LEFT(elem->>'notes', 1000),
  (elem->>'lat')::float,
  (elem->>'lng')::float
FROM public.discover_trips dt
JOIN public.trips t ON t.migrated_from_discover_trip_id = dt.id
CROSS JOIN LATERAL jsonb_array_elements(dt.waypoints) WITH ORDINALITY AS arr(elem, ordinality)
WHERE
  -- Validate type is in the CHECK constraint
  (elem->>'type') = ANY(ARRAY[
    'start', 'end', 'fuel', 'food', 'scenic', 'overnight',
    'photo', 'mechanical', 'ferry', 'pass_summit', 'rally_point'
  ])
  -- Must have valid coordinates
  AND (elem->>'lat') IS NOT NULL
  AND (elem->>'lng') IS NOT NULL
  AND (elem->>'lat')::float BETWEEN -90 AND 90
  AND (elem->>'lng')::float BETWEEN -180 AND 180
  -- Don't re-insert if waypoints already exist (idempotent)
  AND NOT EXISTS (
    SELECT 1 FROM public.trip_waypoints tw
    WHERE tw.trip_id = t.id
      AND tw.sort_order = COALESCE((elem->>'sortOrder')::int, ordinality::int)
      AND tw.day_index = COALESCE((elem->>'dayIndex')::int, 0)
  );

-- ==========================================
-- STEP 4: Auto-create organiser as participant for migrated template trips
-- (trip_participants requires at least the organiser)
-- ==========================================
INSERT INTO public.trip_participants (trip_id, user_id, role, status)
SELECT t.id, t.organiser_user_id, 'organizer', 'going'
FROM public.trips t
WHERE t.migrated_from_discover_trip_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.trip_participants tp
    WHERE tp.trip_id = t.id AND tp.user_id = t.organiser_user_id
  )
ON CONFLICT DO NOTHING;

-- ==========================================
-- STEP 5: Second pass — remap cloned_from_trip_id self-references
-- Trips that were cloned from discover_trips need their FK updated
-- to point to the newly migrated trip row.
-- ==========================================
UPDATE public.trips t
SET cloned_from_trip_id = mapping.new_id
FROM (
  SELECT dt.id AS old_discover_trip_id, t2.id AS new_id
  FROM public.discover_trips dt
  JOIN public.trips t2 ON t2.migrated_from_discover_trip_id = dt.id
) mapping
WHERE t.cloned_from_discover_trip_id = mapping.old_discover_trip_id
  AND t.cloned_from_trip_id IS NULL;

-- Also remap forked_from_discover_trip_id → forked_from_trip_id
UPDATE public.trips t
SET forked_from_trip_id = mapping.new_id
FROM (
  SELECT dt.id AS old_discover_trip_id, t2.id AS new_id
  FROM public.discover_trips dt
  JOIN public.trips t2 ON t2.migrated_from_discover_trip_id = dt.id
) mapping
WHERE t.migrated_from_discover_trip_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.discover_trips dt2
    WHERE dt2.id = t.migrated_from_discover_trip_id
      AND dt2.forked_from_discover_trip_id = mapping.old_discover_trip_id
  );

-- ==========================================
-- STEP 6: Re-enable triggers
-- ==========================================
ALTER TABLE public.trips ENABLE TRIGGER trg_trips_search_tsv;
ALTER TABLE public.trip_reviews ENABLE TRIGGER trg_update_trip_rating;

-- ==========================================
-- VALIDATION: Log counts for verification
-- ==========================================
DO $$
DECLARE
  discover_count INT;
  migrated_count INT;
  wp_discover INT;
  wp_migrated INT;
BEGIN
  SELECT COUNT(*) INTO discover_count FROM public.discover_trips;
  SELECT COUNT(*) INTO migrated_count FROM public.trips WHERE migrated_from_discover_trip_id IS NOT NULL;
  RAISE NOTICE 'discover_trips: %, migrated trips: %', discover_count, migrated_count;

  -- Waypoint count comparison (approximate — some malformed entries may be skipped)
  SELECT SUM(jsonb_array_length(waypoints)) INTO wp_discover FROM public.discover_trips;
  SELECT COUNT(*) INTO wp_migrated FROM public.trip_waypoints tw
    JOIN public.trips t ON t.id = tw.trip_id
    WHERE t.migrated_from_discover_trip_id IS NOT NULL;
  RAISE NOTICE 'discover_trip waypoints (JSONB): %, migrated trip_waypoints: %', wp_discover, wp_migrated;
END;
$$;

COMMIT;
