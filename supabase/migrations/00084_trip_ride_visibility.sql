-- Migration: 00084_trip_ride_visibility
-- Feature: Trip/Ride privacy controls
--
-- Every trip and ride can now be marked 'private', 'unlisted', or 'public'.
-- Private trips/rides are visible only to the owner + explicitly invited
-- users (trip_participants or ride_shares). Unlisted content is visible to
-- anyone with the link (for sharing with friends outside the app). Public
-- content appears in the Discover feed and is visible to everyone.
--
-- Admins (users.role = 'admin') retain full visibility across all content
-- via the existing is_admin() helper — this gives the app creator the
-- ability to see participants, moderate content, and investigate reports.
--
-- Backwards compat:
--   - Existing trips default to 'public' if their status is published/active/
--     completed, otherwise 'private'. Mirrors the prior select-policy logic.
--   - Existing rides default to 'private' (preserves owner-only default).

-- ==========================================
-- 1. Trip visibility
-- ==========================================

CREATE TYPE public.content_visibility AS ENUM ('private', 'unlisted', 'public');

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS visibility public.content_visibility NOT NULL DEFAULT 'private';

-- Backfill visibility for existing trips based on their current status
UPDATE public.trips
SET visibility = (CASE
  WHEN status IN ('published', 'active', 'completed') THEN 'public'
  ELSE 'private'
END)::public.content_visibility;

-- Replace the existing select policy with visibility-aware logic
DROP POLICY IF EXISTS "trips_select" ON public.trips;

CREATE POLICY "trips_select" ON public.trips
  FOR SELECT
  USING (
    -- Public trips: visible to anyone (includes anon for Discover feed)
    visibility = 'public'
    -- Unlisted trips: visible to anyone holding the link. Since we don't
    -- have a per-row token on trips (shared via link-through-share-links
    -- table), unlisted is treated the same as public from the RLS layer.
    -- App layer enforces "only via link" by not listing unlisted trips.
    OR visibility = 'unlisted'
    -- Private trips: owner sees their own, participants see ones they joined,
    -- admins see everything
    OR organiser_user_id = (SELECT auth.uid())
    OR (
      visibility = 'private'
      AND EXISTS (
        SELECT 1 FROM public.trip_participants tp
        WHERE tp.trip_id = trips.id
        AND tp.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_admin()
  );

-- ==========================================
-- 2. Trip invites (separate from trip_participants)
-- ==========================================
-- trip_participants is for people who already joined. trip_invites is for
-- people the organizer specifically invited (they may or may not have joined
-- yet). When a user accepts an invite they're upserted into trip_participants.

CREATE TABLE IF NOT EXISTS public.trip_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  UNIQUE (trip_id, invited_user_id)
);

CREATE INDEX idx_trip_invites_trip ON public.trip_invites(trip_id);
CREATE INDEX idx_trip_invites_user ON public.trip_invites(invited_user_id)
  WHERE accepted_at IS NULL AND declined_at IS NULL;

ALTER TABLE public.trip_invites ENABLE ROW LEVEL SECURITY;

-- Owner (inviter), invitee, and admins can see the invite
CREATE POLICY "trip_invites_select" ON public.trip_invites
  FOR SELECT
  USING (
    invited_by_user_id = (SELECT auth.uid())
    OR invited_user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_invites.trip_id
      AND trips.organiser_user_id = (SELECT auth.uid())
    )
  );

-- Only the trip organizer can invite people
CREATE POLICY "trip_invites_insert" ON public.trip_invites
  FOR INSERT
  WITH CHECK (
    invited_by_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_invites.trip_id
      AND trips.organiser_user_id = (SELECT auth.uid())
    )
  );

-- The invitee can update (to accept/decline); the organizer can update
-- (to rescind) via a separate path
CREATE POLICY "trip_invites_update" ON public.trip_invites
  FOR UPDATE
  USING (invited_user_id = (SELECT auth.uid()))
  WITH CHECK (invited_user_id = (SELECT auth.uid()));

-- Either the inviter or invitee can delete
CREATE POLICY "trip_invites_delete" ON public.trip_invites
  FOR DELETE
  USING (
    invited_by_user_id = (SELECT auth.uid())
    OR invited_user_id = (SELECT auth.uid())
  );

-- ==========================================
-- 3. Ride visibility
-- ==========================================

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS visibility public.content_visibility NOT NULL DEFAULT 'private';

-- Backfill from the existing is_public boolean (if it exists — added in
-- an earlier community migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'rides'
    AND column_name = 'is_public'
  ) THEN
    UPDATE public.rides
    SET visibility = (CASE
      WHEN is_public = true THEN 'public'
      ELSE 'private'
    END)::public.content_visibility;
  END IF;
END $$;

-- ==========================================
-- 4. Ride shares — explicit invite list for private rides
-- ==========================================

CREATE TABLE IF NOT EXISTS public.ride_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ride_id, shared_with_user_id)
);

CREATE INDEX idx_ride_shares_ride ON public.ride_shares(ride_id);
CREATE INDEX idx_ride_shares_user ON public.ride_shares(shared_with_user_id);

ALTER TABLE public.ride_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ride_shares_select" ON public.ride_shares
  FOR SELECT
  USING (
    shared_by_user_id = (SELECT auth.uid())
    OR shared_with_user_id = (SELECT auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "ride_shares_insert" ON public.ride_shares
  FOR INSERT
  WITH CHECK (
    shared_by_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ride_shares.ride_id
      AND rides.user_id = (SELECT auth.uid())
      AND rides.deleted_at IS NULL
    )
  );

CREATE POLICY "ride_shares_delete" ON public.ride_shares
  FOR DELETE
  USING (
    shared_by_user_id = (SELECT auth.uid())
    OR shared_with_user_id = (SELECT auth.uid())
  );

-- ==========================================
-- 5. Update rides select policy to honor visibility + shares + admin
-- ==========================================

DROP POLICY IF EXISTS "Enable read access for ride owner or admin" ON public.rides;

CREATE POLICY "rides_select_with_visibility"
  ON public.rides
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      -- Owner always sees their own
      user_id = (SELECT auth.uid())
      -- Public rides visible to everyone
      OR visibility = 'public'
      -- Unlisted rides visible via app-layer share link (RLS treats same as public
      -- for authenticated users; anon access handled by a separate token flow)
      OR visibility = 'unlisted'
      -- Private rides visible to explicitly-shared users
      OR (
        visibility = 'private'
        AND EXISTS (
          SELECT 1 FROM public.ride_shares
          WHERE ride_shares.ride_id = rides.id
          AND ride_shares.shared_with_user_id = (SELECT auth.uid())
        )
      )
      -- Admin bypass
      OR public.is_admin()
    )
  );

COMMENT ON TYPE public.content_visibility IS 'Shared visibility enum for user-generated trips and rides. private = owner + invited only, unlisted = anyone with the link, public = discoverable.';
COMMENT ON TABLE public.trip_invites IS 'Pending/accepted/declined invitations to join private trips. Separate from trip_participants so invites survive decline and the inviter can see the response.';
COMMENT ON TABLE public.ride_shares IS 'Explicit read-access grants for private rides. The owner grants another user permission to view a specific ride.';
