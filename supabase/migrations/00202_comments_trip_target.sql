-- Migration: let comments target a trip
--
-- Sentry MOTO-VAULT-NODE-NESTJS-W / MOTO-VAULT-REACT-NATIVE-46 (2026-11-11):
-- every createComment on a trip failed with
--   23514 new row for relation "comments" violates check constraint "comments_single_target"
--
-- 00072 added comments.trip_id but never widened the 00063 "exactly one target"
-- CHECK, which still counts only ride_id + route_id + group_ride_id. A trip comment
-- (trip_id set, the other three null) sums to 0, so the insert is always rejected.
-- Production had 0 rows with trip_id set on 2026-11-12: trip comments never worked.
--
-- 00072 also left comments_insert (last re-created by 00196) without a trip_id gate,
-- so once the CHECK accepts trip_id, anyone could comment on any trip id, including
-- private or draft trips they cannot see. The gate added here is "the commenter can
-- read the trip": the subquery runs under trips_select RLS, so it accepts exactly the
-- trips the caller can open (public non-draft, their own, ones they take part in).
--
-- The read side needs the same gate. comments_select (00063) is USING (true), which
-- leaked nothing while trip comments could not exist. Once they can, a comment on a
-- private or unlisted trip would be readable by any rider (getComments(tripId) or a
-- direct PostgREST query on trip_id). comments_select is re-created here so ride,
-- route and group-ride comments stay readable by anyone, as before, and a trip
-- comment is readable only by someone who can read the trip under trips_select.
-- trip_waypoints_select (00123) uses the same subquery-under-RLS shape.
--
-- Safe to apply: production has no row that the new CHECK rejects (0 rows with
-- trip_id set; the 00119 route->trip remap touched none). Run the pre-check below
-- first anyway; ADD CONSTRAINT validates every existing row.
--   SELECT count(*) FROM public.comments
--   WHERE (ride_id IS NOT NULL)::int + (route_id IS NOT NULL)::int
--       + (group_ride_id IS NOT NULL)::int + (trip_id IS NOT NULL)::int <> 1;
--
-- DEPLOY ORDER: independent of the API. The API change in the same PR only maps
-- RLS/FK errors to 4xx; it works before and after this migration.
--
-- ROLLBACK: re-create comments_single_target and comments_select with the 00063
-- bodies and comments_insert with the 00196 body.

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_single_target;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_single_target CHECK (
    (ride_id IS NOT NULL)::int +
    (route_id IS NOT NULL)::int +
    (group_ride_id IS NOT NULL)::int +
    (trip_id IS NOT NULL)::int = 1
  );

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
    AND (
      trip_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.trips
        WHERE id = trip_id
      )
    )
  );

DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT
  USING (
    trip_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
