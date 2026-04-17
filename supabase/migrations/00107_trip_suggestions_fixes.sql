-- Migration: Harden trip_suggestions RLS + prevent waypoint sort_order races
--
-- 1. SELECT policy — drop the status-based branch that leaked notes to any
--    authenticated user on published/active/completed trips (todo 138). Restrict
--    visibility to organiser + current trip participants only.
-- 2. UPDATE policy — add an explicit WITH CHECK that splits branches by role
--    so:
--      a) authors can actually transition pending → withdrawn (previously dead
--         because USING was defaulted as WITH CHECK — todo 118),
--      b) authors cannot forge `decided_by / decided_at / waypoint_id / trip_id`,
--      c) organiser/co_planner decisions must claim `decided_by = auth.uid()`.
-- 3. Waypoint sort_order race — add a partial unique index on
--    (trip_id, day_index, sort_order) so two co-planners accepting suggestions
--    concurrently get a deterministic 23505 that the service layer can retry
--    (todo 131). day_index is NOT NULL DEFAULT 0 in this schema, but the partial
--    WHERE keeps us safe if that changes.

BEGIN;

-- ==========================================
-- 1. SELECT policy: participants + organiser only
-- ==========================================
DROP POLICY IF EXISTS "trip_suggestions_select" ON public.trip_suggestions;

CREATE POLICY "trip_suggestions_select" ON public.trip_suggestions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_suggestions.trip_id
        AND (
          t.organiser_user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.trip_participants p
            WHERE p.trip_id = t.id
              AND p.user_id = (SELECT auth.uid())
              AND p.status IN ('going', 'invited', 'maybe')
          )
        )
    )
  );

-- ==========================================
-- 2. UPDATE policy: split USING vs WITH CHECK, branch by role
-- ==========================================
DROP POLICY IF EXISTS "trip_suggestions_update" ON public.trip_suggestions;

CREATE POLICY "trip_suggestions_update" ON public.trip_suggestions
  FOR UPDATE TO authenticated
  USING (
    -- Organiser of the trip
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_suggestions.trip_id
        AND t.organiser_user_id = (SELECT auth.uid())
    )
    -- Active co-planner participant
    OR EXISTS (
      SELECT 1 FROM public.trip_participants p
      WHERE p.trip_id = trip_suggestions.trip_id
        AND p.user_id = (SELECT auth.uid())
        AND p.role = 'co_planner'
        AND p.status = 'going'
    )
    -- Author on their own still-pending suggestion
    OR (
      trip_suggestions.author_user_id = (SELECT auth.uid())
      AND trip_suggestions.status = 'pending'
    )
  )
  WITH CHECK (
    -- Organiser / co-planner branch: may flip status to pending/accepted/rejected
    -- but must own the decision stamp.
    (
      (
        EXISTS (
          SELECT 1 FROM public.trips t
          WHERE t.id = trip_suggestions.trip_id
            AND t.organiser_user_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.trip_participants p
          WHERE p.trip_id = trip_suggestions.trip_id
            AND p.user_id = (SELECT auth.uid())
            AND p.role = 'co_planner'
            AND p.status = 'going'
        )
      )
      AND trip_suggestions.status IN ('pending', 'accepted', 'rejected')
      AND (
        trip_suggestions.decided_by IS NULL
        OR trip_suggestions.decided_by = (SELECT auth.uid())
      )
    )
    -- Author branch: may edit own pending row or withdraw it. Cannot reassign
    -- author_user_id, and cannot push into accepted/rejected.
    OR (
      trip_suggestions.author_user_id = (SELECT auth.uid())
      AND trip_suggestions.status IN ('pending', 'withdrawn')
    )
  );

-- ==========================================
-- 3. Waypoint sort_order race guard
-- ==========================================
-- Ensures concurrent accepts surface as 23505 instead of silently double-booking
-- the same (trip_id, day_index, sort_order) slot. The service layer retries.
CREATE UNIQUE INDEX IF NOT EXISTS trip_waypoints_trip_day_sort_order_unique
  ON public.trip_waypoints (trip_id, day_index, sort_order);

COMMIT;
