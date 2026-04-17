-- Migration: 00108_auto_promote_on_share
--
-- Two changes to the trip-sharing RPCs:
--
-- 1. rotate_trip_share_token:
--    - Block archived trips from being shared (ERRCODE P0002).
--    - Auto-promote: set status='published' if 'draft', set
--      visibility='unlisted' if 'private'. Never demote from 'public'
--      or change non-draft statuses.
--
-- 2. resolve_trip_by_token:
--    - Allow share links to resolve for both 'unlisted' AND 'public' trips,
--      so promoting a trip to Discover doesn't break existing share links.

BEGIN;

-- ============================================================
-- 1. rotate_trip_share_token  (replaces 00087)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rotate_trip_share_token(p_trip_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_plaintext TEXT;
  v_hash      BYTEA;
  v_trip      public.trips%ROWTYPE;
BEGIN
  -- Explicitly lock the trip row so concurrent rotations serialize here.
  SELECT * INTO v_trip
    FROM public.trips
    WHERE id = p_trip_id
      AND organiser_user_id = auth.uid()
    FOR UPDATE;

  IF v_trip IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Block archived trips from being shared.
  IF v_trip.status = 'archived' THEN
    RAISE EXCEPTION 'Archived trips cannot be shared' USING ERRCODE = 'P0002';
  END IF;

  -- Auto-promote: draft -> published, private -> unlisted.
  -- Never demote from 'public'; never change non-draft statuses.
  UPDATE public.trips
    SET status     = CASE WHEN status = 'draft' THEN 'published' ELSE status END,
        visibility = CASE WHEN visibility = 'private' THEN 'unlisted' ELSE visibility END
    WHERE id = p_trip_id
      AND (status = 'draft' OR visibility = 'private');

  -- Generate a new share token.
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

-- ============================================================
-- 2. resolve_trip_by_token  (replaces 00086)
-- ============================================================
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
      AND t.visibility IN ('unlisted', 'public')
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

  -- Explicit allow-list (never to_jsonb - 'field' -- deny-by-exception)
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

COMMIT;
