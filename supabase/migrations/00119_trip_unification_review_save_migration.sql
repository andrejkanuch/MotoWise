-- Migration: 00119_trip_unification_review_save_migration
--
-- Phase 2b: Migrates reviews, saves, and comments to unified tables.
-- Only migrates from discover_trip_reviews (already includes route_reviews via 00112).
-- Remaps comments.route_id → comments.trip_id for route-linked comments.
--
-- IDEMPOTENT: All INSERTs use ON CONFLICT DO NOTHING.
--
-- See: docs/plans/2026-04-22-002-refactor-trip-unification-implementation-plan.md

BEGIN;

-- ==========================================
-- STEP 0: Disable rating trigger during bulk insert
-- ==========================================
ALTER TABLE public.trip_reviews DISABLE TRIGGER trg_update_trip_rating;

-- ==========================================
-- STEP 1: discover_trip_reviews → trip_reviews
-- Only migrate from discover_trip_reviews (which already includes
-- route_reviews data from migration 00112). Skipping route_reviews
-- directly to avoid duplicates.
-- ==========================================
INSERT INTO public.trip_reviews (trip_id, user_id, rating, text, condition_tags, bike_id, created_at)
SELECT
  t.id,
  dtr.user_id,
  dtr.rating,
  dtr.text,
  dtr.condition_tags,
  dtr.bike_id,
  dtr.created_at
FROM public.discover_trip_reviews dtr
JOIN public.trips t ON t.migrated_from_discover_trip_id = dtr.discover_trip_id
WHERE dtr.user_id IS NOT NULL  -- Skip orphaned reviews (user deleted)
ON CONFLICT (trip_id, user_id) DO NOTHING;

-- Also migrate orphaned reviews (user_id IS NULL) — preserves rating data
INSERT INTO public.trip_reviews (trip_id, user_id, rating, text, condition_tags, bike_id, created_at)
SELECT
  t.id,
  NULL,
  dtr.rating,
  dtr.text,
  dtr.condition_tags,
  dtr.bike_id,
  dtr.created_at
FROM public.discover_trip_reviews dtr
JOIN public.trips t ON t.migrated_from_discover_trip_id = dtr.discover_trip_id
WHERE dtr.user_id IS NULL;

-- ==========================================
-- STEP 2: route_saves → trip_saves
-- Routes were already migrated to discover_trips (00112).
-- Map: route_saves.route_id → discover_trips.migrated_from_route_id → trips.migrated_from_discover_trip_id
-- ==========================================
INSERT INTO public.trip_saves (trip_id, user_id, saved_at)
SELECT
  t.id,
  rs.user_id,
  rs.saved_at
FROM public.saved_routes rs
JOIN public.discover_trips dt ON dt.migrated_from_route_id = rs.route_id
JOIN public.trips t ON t.migrated_from_discover_trip_id = dt.id
ON CONFLICT (trip_id, user_id) DO NOTHING;

-- ==========================================
-- STEP 3: Remap comments.route_id → comments.trip_id
-- Comments linked to routes get re-linked to the migrated trip.
-- Only updates comments that have a route_id but no trip_id.
-- ==========================================
UPDATE public.comments c
SET trip_id = t.id
FROM public.discover_trips dt
JOIN public.trips t ON t.migrated_from_discover_trip_id = dt.id
WHERE dt.migrated_from_route_id = c.route_id
  AND c.route_id IS NOT NULL
  AND c.trip_id IS NULL;

-- ==========================================
-- STEP 4: Re-enable rating trigger
-- ==========================================
ALTER TABLE public.trip_reviews ENABLE TRIGGER trg_update_trip_rating;

-- ==========================================
-- VALIDATION
-- ==========================================
DO $$
DECLARE
  src_reviews INT;
  dst_reviews INT;
  src_saves INT;
  dst_saves INT;
  remapped_comments INT;
BEGIN
  SELECT COUNT(*) INTO src_reviews FROM public.discover_trip_reviews;
  SELECT COUNT(*) INTO dst_reviews FROM public.trip_reviews;
  RAISE NOTICE 'Reviews: source=%, migrated=%', src_reviews, dst_reviews;

  SELECT COUNT(*) INTO src_saves FROM public.saved_routes;
  SELECT COUNT(*) INTO dst_saves FROM public.trip_saves;
  RAISE NOTICE 'Saves: source=%, migrated=%', src_saves, dst_saves;

  SELECT COUNT(*) INTO remapped_comments FROM public.comments
    WHERE trip_id IS NOT NULL AND route_id IS NOT NULL;
  RAISE NOTICE 'Comments remapped (have both route_id and trip_id): %', remapped_comments;
END;
$$;

COMMIT;
