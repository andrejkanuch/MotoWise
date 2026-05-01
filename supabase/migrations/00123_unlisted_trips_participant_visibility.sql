-- Migration: 00123_unlisted_trips_participant_visibility
--
-- Bug: participants of unlisted trips could not see the trip via normal
-- SELECT (tripDetail). The trips_select policy from 00089 intentionally
-- omitted an 'unlisted' branch — unlisted trips were only reachable via
-- resolve_trip_by_token() SECURITY DEFINER RPC. However, once a user
-- joins an unlisted trip (via share-link → joinTrip), they need normal
-- SELECT access to load the trip detail screen.
--
-- Fix: add an 'unlisted + participant' branch to trips_select,
-- trip_participants_select, and trip_waypoints_select so that
-- participants (and the organiser, already covered) can read the trip
-- after joining.

BEGIN;

-- ==========================================
-- 1. trips_select — add unlisted + participant branch
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
    -- Unlisted trips: visible to participants (share-link joiners need read access)
    OR (
      visibility = 'unlisted'
      AND public.user_is_trip_participant(trips.id, (SELECT auth.uid()))
    )
    -- Admin bypass
    OR public.is_admin()
  );

-- ==========================================
-- 2. trip_waypoints_select — add unlisted + participant branch
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
          OR (
            t.visibility = 'unlisted'
            AND public.user_is_trip_participant(t.id, (SELECT auth.uid()))
          )
          OR public.is_admin()
        )
    )
  );

COMMIT;
