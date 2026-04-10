-- Migration: 00086_trip_share_tokens
--
-- H2 security fix: capability URLs for unlisted trips.
-- Plan: docs/plans/2026-04-10-002-feat-trip-share-links-plan.md
--
-- Summary:
--   1. Create trip_share_tokens table (SHA-256 hashed tokens at rest)
--   2. Backfill tokens for existing unlisted trips (plaintext discarded)
--   3. Drop the unlisted branch from trips_select / trip_waypoints_select /
--      trip_participants_select so PostgREST direct enumeration returns empty
--   4. Create resolve_trip_by_token (anon + auth callable SECURITY DEFINER)
--   5. Create rotate_trip_share_token (organiser-only SECURITY DEFINER)
--
-- All functions: SECURITY DEFINER with SET search_path = '',
-- SET log_min_duration_statement = -1, SET log_statement = 'none'
-- to prevent token leakage into Postgres logs / pg_stat_statements / WAL.
--
-- Token format: 64-char lowercase hex (32 bytes via extensions.gen_random_bytes).
-- Plaintext NEVER stored — only SHA-256 hash in trip_share_tokens.token_hash.

BEGIN;

-- ==========================================
-- Baseline assertion
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trips' AND policyname = 'trips_select'
  ) THEN
    RAISE EXCEPTION 'Missing baseline policy from 00085 — run migrations in order';
  END IF;
END $$;

-- ==========================================
-- 1. trip_share_tokens table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.trip_share_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trip_share_tokens_trip_unique UNIQUE (trip_id),
  CONSTRAINT trip_share_tokens_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_trip_share_tokens_trip_id
  ON public.trip_share_tokens(trip_id);

ALTER TABLE public.trip_share_tokens ENABLE ROW LEVEL SECURITY;

-- Only the trip organiser can see their own share token row (metadata only;
-- the plaintext is never stored and the hash is not useful without the token).
-- All reads + mutations go through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "trip_share_tokens_select" ON public.trip_share_tokens;
CREATE POLICY "trip_share_tokens_select" ON public.trip_share_tokens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_share_tokens.trip_id
        AND t.organiser_user_id = (SELECT auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policies — these are exclusively handled by the
-- SECURITY DEFINER rotate_trip_share_token RPC.

-- ==========================================
-- 2. Backfill: mint new tokens for existing unlisted trips
-- (plaintext is DISCARDED — existing URLs stop working by design)
-- ==========================================
INSERT INTO public.trip_share_tokens (trip_id, token_hash)
SELECT
  t.id,
  extensions.digest(
    encode(extensions.gen_random_bytes(32), 'hex')::bytea,
    'sha256'
  )
FROM public.trips t
WHERE t.visibility = 'unlisted'
ON CONFLICT (trip_id) DO NOTHING;

-- ==========================================
-- 3. Drop unlisted branch from trips_select
-- (the enumeration hole H2 fix)
-- ==========================================
DROP POLICY IF EXISTS "trips_select" ON public.trips;
CREATE POLICY "trips_select" ON public.trips FOR SELECT USING (
  -- Public trips: visible to anyone, except drafts
  (
    visibility = 'public'
    AND (
      status <> 'draft'
      OR organiser_user_id = (SELECT auth.uid())
      OR public.is_admin()
    )
  )
  -- Owner always sees their own (any status, any visibility including unlisted)
  OR organiser_user_id = (SELECT auth.uid())
  -- Private trips: visible to participants
  OR (
    visibility = 'private'
    AND EXISTS (
      SELECT 1 FROM public.trip_participants tp
      WHERE tp.trip_id = trips.id
        AND tp.user_id = (SELECT auth.uid())
    )
  )
  -- Admin bypass
  OR public.is_admin()
  -- NOTE: no 'unlisted' branch. Unlisted trips are ONLY reachable via
  -- public.resolve_trip_by_token() SECURITY DEFINER RPC.
);

-- ==========================================
-- 4. Drop unlisted branch from trip_waypoints_select
-- ==========================================
DROP POLICY IF EXISTS "trip_waypoints_select" ON public.trip_waypoints;
CREATE POLICY "trip_waypoints_select" ON public.trip_waypoints
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_waypoints.trip_id
        AND (
          t.visibility = 'public'
          OR t.organiser_user_id = (SELECT auth.uid())
          OR (
            t.visibility = 'private'
            AND EXISTS (
              SELECT 1 FROM public.trip_participants tp
              WHERE tp.trip_id = t.id
                AND tp.user_id = (SELECT auth.uid())
            )
          )
          OR public.is_admin()
        )
    )
  );

-- ==========================================
-- 5. Tighten trip_participants_select (drop unlisted from the mingled branch)
-- ==========================================
DROP POLICY IF EXISTS "trip_participants_select" ON public.trip_participants;
CREATE POLICY "trip_participants_select" ON public.trip_participants
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_participants.trip_id
        AND t.organiser_user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_participants.trip_id
        AND t.visibility = 'public'
    )
    OR EXISTS (
      SELECT 1 FROM public.trip_participants self
      WHERE self.trip_id = trip_participants.trip_id
        AND self.user_id = (SELECT auth.uid())
    )
    OR public.is_admin()
  );

-- ==========================================
-- 6. resolve_trip_by_token RPC
-- ==========================================
CREATE OR REPLACE FUNCTION public.resolve_trip_by_token(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_hash         BYTEA;
  v_trip         public.trips%ROWTYPE;
  v_waypoints    JSONB;
  v_participants JSONB;
BEGIN
  -- Validate shape (defense only; hash comparison is the real gate)
  IF p_token IS NULL OR p_token !~ '^[a-fA-F0-9]{64}$' THEN
    PERFORM pg_sleep(0.02);
    RAISE EXCEPTION 'Trip not found' USING ERRCODE = 'P0002';
  END IF;

  v_hash := extensions.digest(lower(p_token)::bytea, 'sha256');

  SELECT t.* INTO v_trip
    FROM public.trip_share_tokens tst
    JOIN public.trips t ON t.id = tst.trip_id
    WHERE tst.token_hash = v_hash
      AND t.visibility = 'unlisted'
      AND t.status NOT IN ('draft', 'archived');

  IF NOT FOUND THEN
    PERFORM pg_sleep(0.02);
    RAISE EXCEPTION 'Trip not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', w.id,
      'sort_order', w.sort_order,
      'day_index', w.day_index,
      'type', w.type,
      'name', w.name,
      'notes', w.notes,
      'lat', w.lat,
      'lng', w.lng
    ) ORDER BY w.sort_order, w.day_index), '[]'::jsonb)
    INTO v_waypoints
    FROM public.trip_waypoints w
    WHERE w.trip_id = v_trip.id;

  -- Participants: hash user_id with trip_id for correlation resistance;
  -- gate display_name / avatar_url on users.is_public.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'anon_id', encode(
        extensions.digest((tp.user_id::text || v_trip.id::text)::bytea, 'sha256'),
        'hex'
      ),
      'role', tp.role,
      'status', tp.status,
      'display_name', CASE WHEN u.is_public THEN u.display_name ELSE 'Rider' END,
      'avatar_url',   CASE WHEN u.is_public THEN u.avatar_url   ELSE NULL    END
    )), '[]'::jsonb)
    INTO v_participants
    FROM public.trip_participants tp
    LEFT JOIN public.users u ON u.id = tp.user_id
    WHERE tp.trip_id = v_trip.id;

  -- Explicit allow-list (never to_jsonb - 'field' — deny-by-exception)
  RETURN jsonb_build_object(
    'trip', jsonb_build_object(
      'id', v_trip.id,
      'title', v_trip.title,
      'description', v_trip.description,
      'status', v_trip.status,
      'difficulty', v_trip.difficulty,
      'start_date', v_trip.start_date,
      'end_date', v_trip.end_date,
      'max_riders', v_trip.max_riders,
      'participant_count', v_trip.participant_count,
      'cover_image_url', v_trip.cover_image_url
    ),
    'waypoints', v_waypoints,
    'participants', v_participants
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

REVOKE ALL ON FUNCTION public.resolve_trip_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_trip_by_token(TEXT) TO anon, authenticated;

-- ==========================================
-- 7. rotate_trip_share_token RPC (organiser-only, returns plaintext once)
-- ==========================================
CREATE OR REPLACE FUNCTION public.rotate_trip_share_token(p_trip_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_plaintext TEXT;
  v_hash      BYTEA;
BEGIN
  -- Verify organiser + lock the trip row to serialize concurrent rotations
  IF NOT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = p_trip_id
      AND organiser_user_id = auth.uid()
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_plaintext := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := extensions.digest(v_plaintext::bytea, 'sha256');

  INSERT INTO public.trip_share_tokens (trip_id, token_hash)
  VALUES (p_trip_id, v_hash)
  ON CONFLICT (trip_id) DO UPDATE
    SET token_hash = EXCLUDED.token_hash,
        rotated_at = now();

  RETURN v_plaintext;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

REVOKE ALL ON FUNCTION public.rotate_trip_share_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_trip_share_token(UUID) TO authenticated;

COMMIT;
