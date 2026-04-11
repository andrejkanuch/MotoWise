-- Migration: 00088_fix_trips_rls_recursion
--
-- Production incident (2026-04-11): getTrips started returning
--   "infinite recursion detected in policy for relation \"trips\" (42P17)"
-- on every call, blocking the mobile Discover feed.
--
-- Root cause: 00085 + 00086 left trips_select and trip_participants_select
-- mutually recursive:
--
--   trips_select            -> SELECT FROM trip_participants (private branch)
--   trip_participants_select-> SELECT FROM trips             (organiser + public branches)
--
-- Postgres re-enters each policy when evaluating the inner SELECT against
-- the other relation, detects the cycle, and aborts. trip_waypoints_select
-- has the same problem because its trips subquery itself joins to
-- trip_participants through the trips_select policy.
--
-- Fix: extract the cross-table lookups into SECURITY DEFINER helpers with
-- pinned search_path = '' (matching the pattern from 00007 / 00085 / 00086).
-- SECURITY DEFINER bypasses RLS on the inner relation, so the helper returns
-- a plain boolean and the cycle is broken. The helpers are STABLE (not
-- VOLATILE) so the planner can cache them per row; they're also marked
-- PARALLEL SAFE because they only do read-only lookups on owner-visible data.
--
-- No visibility semantics change: every USING clause below computes the same
-- boolean it did before, just via definer-wrapped EXISTS checks.

BEGIN;

-- ==========================================
-- 1. SECURITY DEFINER helpers (RLS bypass)
-- ==========================================

-- Is the given user a participant of the given trip?
CREATE OR REPLACE FUNCTION public.user_is_trip_participant(
  p_trip_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_participants tp
    WHERE tp.trip_id = p_trip_id
      AND tp.user_id = p_user_id
  );
$$;

-- Is the given user the organiser of the given trip?
CREATE OR REPLACE FUNCTION public.user_is_trip_organiser(
  p_trip_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = p_trip_id
      AND t.organiser_user_id = p_user_id
  );
$$;

-- Is the given trip public (and not a draft)?
-- Mirrors the "public + non-draft" branch used in trips_select.
CREATE OR REPLACE FUNCTION public.trip_is_public(p_trip_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = p_trip_id
      AND t.visibility = 'public'
      AND t.status <> 'draft'
  );
$$;

-- Grants: policies run as the querying role, so both authenticated and anon
-- need EXECUTE to call these from USING clauses.
GRANT EXECUTE ON FUNCTION public.user_is_trip_participant(UUID, UUID)
  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_is_trip_organiser(UUID, UUID)
  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.trip_is_public(UUID)
  TO authenticated, anon;

-- ==========================================
-- 2. trips_select — break recursion into trip_participants
-- ==========================================
DROP POLICY IF EXISTS "trips_select" ON public.trips;

CREATE POLICY "trips_select" ON public.trips
  FOR SELECT
  USING (
    -- Public trips: visible to anyone, except drafts (organiser/admin still see own drafts)
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
    -- Private trips: visible to participants (via definer helper — no RLS recursion)
    OR (
      visibility = 'private'
      AND public.user_is_trip_participant(trips.id, (SELECT auth.uid()))
    )
    -- Admin bypass
    OR public.is_admin()
    -- NOTE: no 'unlisted' branch. Unlisted trips are ONLY reachable via
    -- public.resolve_trip_by_token() SECURITY DEFINER RPC (00086).
  );

-- ==========================================
-- 3. trip_participants_select — break recursion into trips
-- ==========================================
DROP POLICY IF EXISTS "trip_participants_select" ON public.trip_participants;

CREATE POLICY "trip_participants_select" ON public.trip_participants
  FOR SELECT
  USING (
    -- Caller is the participant row's user
    user_id = (SELECT auth.uid())
    -- Caller is the trip organiser (definer helper)
    OR public.user_is_trip_organiser(trip_participants.trip_id, (SELECT auth.uid()))
    -- Trip is public and not a draft (definer helper)
    OR public.trip_is_public(trip_participants.trip_id)
    -- Caller is another participant of the same trip (definer helper; self-join
    -- via trip_participants policy itself would also recurse)
    OR public.user_is_trip_participant(trip_participants.trip_id, (SELECT auth.uid()))
    -- Admin bypass
    OR public.is_admin()
  );

-- ==========================================
-- 4. trip_waypoints_select — same recursion path via trips
-- ==========================================
DROP POLICY IF EXISTS "trip_waypoints_select" ON public.trip_waypoints;

CREATE POLICY "trip_waypoints_select" ON public.trip_waypoints
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_waypoints.trip_id
        AND (
          (t.visibility = 'public' AND t.status <> 'draft')
          OR t.organiser_user_id = (SELECT auth.uid())
          OR (
            t.visibility = 'private'
            AND public.user_is_trip_participant(t.id, (SELECT auth.uid()))
          )
          OR public.is_admin()
        )
    )
  );

COMMIT;
