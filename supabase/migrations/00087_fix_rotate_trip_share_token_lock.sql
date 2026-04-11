-- Migration: 00087_fix_rotate_trip_share_token_lock
--
-- Review finding M-4: the rotate_trip_share_token RPC in 00086 used
-- `FOR UPDATE` inside an `EXISTS (SELECT 1 … FOR UPDATE)` subquery, which
-- Postgres silently IGNORES (locking clauses are a no-op inside subqueries).
-- The ON CONFLICT DO UPDATE on the unique constraint still serialized
-- concurrent rotations, so the behavior was safe — but the code did not
-- actually match the comment.
--
-- This migration replaces the function body with a real row lock via a
-- top-level `SELECT … FOR UPDATE` so the comment matches reality.
-- Signature, return type, grants, and SECURITY DEFINER settings are unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.rotate_trip_share_token(p_trip_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_plaintext TEXT;
  v_hash      BYTEA;
  v_locked_id UUID;
BEGIN
  -- Explicitly lock the trip row so concurrent rotations serialize here.
  -- FOR UPDATE inside an EXISTS subquery is a no-op, so use a real SELECT.
  SELECT id INTO v_locked_id
    FROM public.trips
    WHERE id = p_trip_id
      AND organiser_user_id = auth.uid()
    FOR UPDATE;

  IF v_locked_id IS NULL THEN
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

-- Grants are inherited from 00086; re-grant defensively for idempotency
REVOKE ALL ON FUNCTION public.rotate_trip_share_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_trip_share_token(UUID) TO authenticated;

COMMIT;
