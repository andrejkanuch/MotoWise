-- Migration: rides visibility canonicalization (audit C6)
--
-- `is_public` and `visibility` have been two diverging sources of truth since 00084:
-- updateRide wrote only is_public, updateRideVisibility wrote only visibility, RLS
-- gated on visibility while getPublicRide and several policies gated on is_public —
-- contradictory access answers depending on the code path.
--
-- This migration makes `visibility` canonical:
--   (a) snapshots disagreeing rows (the backfill is otherwise irreversible),
--   (b) restrictive merge: any disagreement collapses to PRIVATE — the privacy-safe
--       default. Accepted consequence: some previously-shared ride links 404 until
--       the owner re-publishes. (Product sign-off required in the PR.)
--   (c) drops the stale `rides_public_read` policy from 00058 — it still granted
--       world-read on `is_public = true`, which would have made the restrictive
--       merge a read no-op,
--   (d) migrates every SQL consumer of rides.is_public to visibility
--       (summaries_public_read, kudos_insert, comments_insert, feed partial index).
--
-- DEPLOY ORDER: the dual-writing API (updateRide/updateRideVisibility write BOTH
-- columns; feed + getPublicRide read visibility) must deploy BEFORE this runs.
-- The old is_public column + idx_rides_feed_user are dropped in a LATER cleanup
-- migration, once nothing reads them.
--
-- Note on 'unlisted': kudos/comments remain allowed on visibility='public' rides
-- ONLY (matches the pre-migration is_public behavior — unlisted rides were never
-- kudos-able because is_public was false for them).
--
-- ROLLBACK: restore column pairs from _visibility_backfill_audit and re-create the
-- 00058/00060/00070 policy bodies (kept verbatim in those files).

BEGIN;

-- ============================================================
-- (a) Snapshot disagreeing rows
-- ============================================================
CREATE TABLE IF NOT EXISTS public._visibility_backfill_audit (
  ride_id     UUID PRIMARY KEY,
  is_public   BOOLEAN NOT NULL,
  visibility  public.content_visibility NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public._visibility_backfill_audit ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only.

INSERT INTO public._visibility_backfill_audit (ride_id, is_public, visibility)
SELECT id, is_public, visibility FROM public.rides
WHERE (is_public AND visibility <> 'public') OR (NOT is_public AND visibility = 'public')
ON CONFLICT (ride_id) DO NOTHING;

-- ============================================================
-- (b) Restrictive merge — write BOTH columns so dual-writing code stays consistent
-- ============================================================
UPDATE public.rides
SET visibility = 'private', is_public = false
WHERE (is_public AND visibility <> 'public') OR (NOT is_public AND visibility = 'public');

-- ============================================================
-- (c) Drop the stale is_public world-read policy (00058). Owner/admin/shared/public
--     reads are fully covered by rides_select_with_visibility (00084).
-- ============================================================
DROP POLICY IF EXISTS "rides_public_read" ON public.rides;

-- ============================================================
-- (d) Migrate SQL consumers of is_public → visibility
-- ============================================================
DROP POLICY IF EXISTS "summaries_public_read" ON public.ride_summaries;
CREATE POLICY "summaries_public_read" ON public.ride_summaries
  FOR SELECT TO authenticated
  USING (
    ride_id IN (
      SELECT id FROM public.rides WHERE visibility = 'public' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "kudos_insert" ON public.ride_kudos;
CREATE POLICY "kudos_insert" ON public.ride_kudos
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.rides
      WHERE id = ride_id AND visibility = 'public' AND deleted_at IS NULL
    )
  );

-- Recreates the LIVE body from 00070 (not the superseded 00063 version),
-- swapping only the rides predicate.
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND (
      ride_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.rides
        WHERE id = ride_id AND visibility = 'public' AND deleted_at IS NULL
      )
    )
    AND (
      route_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.routes
        WHERE id = route_id AND status = 'published'
      )
    )
    AND (
      group_ride_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.group_rides
        WHERE id = group_ride_id AND status IN ('published', 'full')
      )
    )
  );

-- New feed index BEFORE the old one is dropped (later cleanup) so feed queries
-- never lose index coverage between deploys.
CREATE INDEX IF NOT EXISTS idx_rides_feed_user_visibility
  ON public.rides (user_id, started_at DESC)
  WHERE visibility = 'public' AND deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Post-deploy verification:
--   SELECT count(*) FROM public.rides
--   WHERE (is_public AND visibility <> 'public') OR (NOT is_public AND visibility = 'public');
--   -- expect: 0
--   SELECT policyname FROM pg_policies WHERE tablename = 'rides';
--   -- expect: rides_public_read ABSENT, rides_select_with_visibility present
--   SELECT count(*) FROM public._visibility_backfill_audit;  -- snapshot size
