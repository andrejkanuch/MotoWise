-- Migration: 00112_migrate_routes_to_discover_trips
--
-- Migrates published routes into discover_trips as 1-day trip templates.
-- Also migrates route_reviews into discover_trip_reviews.
--
-- Key fixes from Round 2 review:
--   - Disable triggers before bulk INSERT (avoid trigger storm)
--   - Preserve routes.created_at as published_at (avoid cursor collision)
--   - LEFT(name, 150) for title truncation
--   - Meaningful fallback for NULL descriptions (not empty string)
--   - Skip routes with NULL start_point/end_point for waypoint generation
--   - Sanitize slugs to fit CHECK constraint
--   - Disable review rating trigger during bulk review migration

BEGIN;

-- ==========================================
-- STEP 1: Disable triggers for bulk performance
-- ==========================================
ALTER TABLE public.discover_trips DISABLE TRIGGER trg_discover_trips_search_tsv;
ALTER TABLE public.discover_trips DISABLE TRIGGER trg_discover_trips_updated_at;
ALTER TABLE public.discover_trip_reviews DISABLE TRIGGER trg_update_discover_trip_rating;

-- ==========================================
-- STEP 2: Migrate routes → discover_trips
-- ==========================================
INSERT INTO public.discover_trips (
  slug,
  title,
  description,
  difficulty,
  day_count,
  waypoints,
  polyline,
  start_point,
  contributor_user_id,
  country_code,
  region_code,
  city,
  distance_m,
  elevation_gain_m,
  surface_type,
  curvature_index,
  status,
  is_motovault_pick,
  view_count,
  clone_count,
  average_rating,
  review_count,
  migrated_from_route_id,
  published_at,
  updated_at
)
SELECT
  -- Slug: sanitize to fit CHECK pattern ^[a-z0-9][a-z0-9-]{2,80}$
  -- 1. Lowercase + strip invalid chars, 2. Truncate to 75, 3. Append UUID suffix for uniqueness
  LEFT(
    regexp_replace(
      lower(COALESCE(NULLIF(r.slug, ''), COALESCE(NULLIF(r.name, ''), 'route'))),
      '[^a-z0-9-]', '', 'g'
    ),
    70
  ) || '-' || LEFT(r.id::TEXT, 8),
  -- Title: truncate to 150, fallback for NULL
  LEFT(COALESCE(NULLIF(TRIM(r.name), ''), 'Untitled Route'), 150),
  -- Description: meaningful fallback (NOT empty string — fails CHECK >= 1)
  LEFT(
    COALESCE(NULLIF(TRIM(r.description), ''), 'A motorcycle route shared on MotoVault.'),
    3000
  ),
  -- Difficulty: routes have no difficulty column, default to 'moderate'
  'moderate',
  -- Day count: all migrated routes are 1-day
  1,
  -- Waypoints: build from PostGIS start_point/end_point (skip if NULL)
  CASE
    WHEN r.start_point IS NOT NULL AND r.end_point IS NOT NULL THEN
      jsonb_build_array(
        jsonb_build_object(
          'sortOrder', 0, 'dayIndex', 0, 'type', 'start', 'name', 'Start',
          'lat', ST_Y(r.start_point::geometry), 'lng', ST_X(r.start_point::geometry)
        ),
        jsonb_build_object(
          'sortOrder', 1, 'dayIndex', 0, 'type', 'end', 'name', 'End',
          'lat', ST_Y(r.end_point::geometry), 'lng', ST_X(r.end_point::geometry)
        )
      )
    ELSE
      '[]'::jsonb
  END,
  r.polyline,
  r.start_point,
  r.contributor_user_id,
  COALESCE(r.country_code, 'XX'),
  r.region_code,
  r.city,
  r.distance_m::INT,
  r.elevation_gain_m::INT,
  r.surface_type,
  r.curvature_index,
  'published',
  r.is_motovault_pick,
  0,  -- view_count starts at 0
  0,  -- clone_count starts at 0
  r.rating_avg,
  r.rating_count,
  r.id,  -- migrated_from_route_id
  r.created_at,  -- Preserve original timestamp (avoids cursor collision)
  r.updated_at
FROM public.routes r
WHERE r.status = 'published'
ON CONFLICT (migrated_from_route_id) WHERE migrated_from_route_id IS NOT NULL
DO NOTHING;

-- ==========================================
-- STEP 3: Backfill tsvector (single pass, not per-row trigger)
-- ==========================================
UPDATE public.discover_trips
SET search_tsv =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(city, '')), 'C')
WHERE migrated_from_route_id IS NOT NULL;

-- ==========================================
-- STEP 4: Migrate route_reviews → discover_trip_reviews
-- ==========================================
INSERT INTO public.discover_trip_reviews (
  discover_trip_id, user_id, rating, text, condition_tags, bike_id, created_at
)
SELECT
  dt.id,
  rr.user_id,
  rr.rating,
  rr.text,
  rr.condition_tags,
  rr.bike_id,
  rr.created_at
FROM public.route_reviews rr
JOIN public.discover_trips dt ON dt.migrated_from_route_id = rr.route_id
ON CONFLICT (discover_trip_id, user_id) DO NOTHING;

-- ==========================================
-- STEP 5: Re-enable triggers
-- ==========================================
ALTER TABLE public.discover_trips ENABLE TRIGGER trg_discover_trips_search_tsv;
ALTER TABLE public.discover_trips ENABLE TRIGGER trg_discover_trips_updated_at;
ALTER TABLE public.discover_trip_reviews ENABLE TRIGGER trg_update_discover_trip_rating;

COMMIT;
