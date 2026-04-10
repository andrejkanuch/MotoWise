-- Migration: 00085_trip_security_hardening
--
-- Security hardening addressing findings from the 2026-04-10 audit:
--   C2 — trip_waypoints_select must respect trip visibility
--   C3 — trip_participants_select USING (true) was world-readable
--   C4 — join_trip RPC did not verify visibility/invite for private trips
--   C5 — reorder_trip_waypoints RPC did not verify organiser ownership
--   H1 — trips_select exposed draft trips via public/unlisted branches
--   H3 — same draft-guard applied to rides (n/a — rides have no draft state)
--   M1 — trip_invites needed immutable-columns trigger
--   M2 — trip_invites needed accepted/declined mutual-exclusion CHECK
--   M3 — trips_update needed explicit WITH CHECK + immutable-columns trigger
--   L6 — trip_participants role self-promotion blocked via trigger
--   L7 — organiser self-enrolment allowed on draft trips
--   L9 — trip_invites policies missing TO authenticated clause
--
-- All new functions use SECURITY DEFINER + pinned search_path = '' and
-- fully-qualify public.* references, matching the pattern from
-- 00007_fix_security_definer_search_path.sql.

BEGIN;

-- ==========================================
-- C2 — trip_waypoints_select visibility-aware
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
          OR t.visibility = 'unlisted'
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
-- C3 — trip_participants_select restricted
-- ==========================================

DROP POLICY IF EXISTS "trip_participants_select" ON public.trip_participants;

CREATE POLICY "trip_participants_select" ON public.trip_participants
  FOR SELECT
  USING (
    -- Caller is the participant row's user
    user_id = (SELECT auth.uid())
    -- Caller is the trip organiser
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_participants.trip_id
        AND t.organiser_user_id = (SELECT auth.uid())
    )
    -- Trip is public or unlisted (participant lists are visible with the trip)
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_participants.trip_id
        AND t.visibility IN ('public', 'unlisted')
    )
    -- Caller is another participant of the same trip (self-join)
    OR EXISTS (
      SELECT 1 FROM public.trip_participants self
      WHERE self.trip_id = trip_participants.trip_id
        AND self.user_id = (SELECT auth.uid())
    )
    -- Admin bypass
    OR public.is_admin()
  );

-- ==========================================
-- H1 — trips_select: block draft trips from public/unlisted branches
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
    -- Unlisted trips: same draft-guard
    OR (
      visibility = 'unlisted'
      AND (
        status <> 'draft'
        OR organiser_user_id = (SELECT auth.uid())
        OR public.is_admin()
      )
    )
    -- Owner always sees their own (any status, any visibility)
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
  );

-- ==========================================
-- H3 — Rides draft-guard
-- ==========================================
-- Rides table (00047) has status values ('recording','paused','completed')
-- with no 'draft' concept, so no equivalent guard is needed. Unlisted treated
-- same as public is consistent with trips_select. Leaving
-- rides_select_with_visibility from 00084 unchanged.

-- ==========================================
-- C4 + L7 — join_trip RPC visibility/invite check,
--           trip_participants_insert organiser-self-enrol + invite check
-- ==========================================

CREATE OR REPLACE FUNCTION public.join_trip(
  p_trip_id UUID,
  p_user_id UUID,
  p_status TEXT DEFAULT 'going',
  p_bike_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_visibility public.content_visibility;
BEGIN
  -- Validate status
  IF p_status NOT IN ('going', 'maybe', 'declined') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  -- Lock the trip row and check it is joinable; capture visibility
  SELECT t.visibility INTO v_visibility
    FROM public.trips t
    WHERE t.id = p_trip_id
      AND t.status IN ('published', 'active')
      AND t.organiser_user_id <> p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot join: trip not found, not published/active, or you are the organiser';
  END IF;

  -- Private trips require an explicit invite. Unlisted can still be joined
  -- without an invite (link-based sharing).
  IF v_visibility = 'private' AND NOT EXISTS (
    SELECT 1 FROM public.trip_invites ti
    WHERE ti.trip_id = p_trip_id
      AND ti.invited_user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Not invited';
  END IF;

  -- Check capacity only for 'going' status
  IF p_status = 'going' THEN
    PERFORM 1 FROM public.trips
      WHERE id = p_trip_id
        AND participant_count >= max_riders;

    IF FOUND THEN
      RAISE EXCEPTION 'Cannot join: trip is full';
    END IF;
  END IF;

  -- Upsert participant (insert or update status)
  INSERT INTO public.trip_participants (trip_id, user_id, role, status, bike_id)
    VALUES (p_trip_id, p_user_id, 'rider', p_status, p_bike_id)
    ON CONFLICT (trip_id, user_id)
    DO UPDATE SET status = EXCLUDED.status, bike_id = EXCLUDED.bike_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- trip_participants_insert: enforce same visibility/invite check at RLS level
-- so direct PostgREST inserts cannot bypass join_trip. Also permit the
-- organiser to self-enrol regardless of trip status (L7), which is required
-- by the createTripWithWaypoints service path that writes the organiser as
-- a participant while the trip is still in 'draft'.
DROP POLICY IF EXISTS "trip_participants_insert" ON public.trip_participants;

CREATE POLICY "trip_participants_insert" ON public.trip_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      -- Organiser self-enrol, any status / visibility
      EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = trip_participants.trip_id
          AND t.organiser_user_id = (SELECT auth.uid())
      )
      -- Normal joiners: trip must be published/active and either
      -- public/unlisted OR caller holds an invite
      OR EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = trip_participants.trip_id
          AND t.status IN ('published', 'active')
          AND (
            t.visibility IN ('public', 'unlisted')
            OR EXISTS (
              SELECT 1 FROM public.trip_invites ti
              WHERE ti.trip_id = t.id
                AND ti.invited_user_id = (SELECT auth.uid())
            )
          )
      )
    )
  );

-- ==========================================
-- C5 — reorder_trip_waypoints organiser check
-- ==========================================

CREATE OR REPLACE FUNCTION public.reorder_trip_waypoints(
  p_trip_id UUID,
  p_waypoint_ids UUID[]
)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = p_trip_id
      AND organiser_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.trip_waypoints
  SET sort_order = t.idx - 1
  FROM unnest(p_waypoint_ids) WITH ORDINALITY AS t(wid, idx)
  WHERE public.trip_waypoints.id = t.wid
    AND public.trip_waypoints.trip_id = p_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- M1 — trip_invites immutable-columns trigger
-- ==========================================

CREATE OR REPLACE FUNCTION public.trip_invites_prevent_immutable_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.trip_id IS DISTINCT FROM NEW.trip_id THEN
    RAISE EXCEPTION 'trip_invites.trip_id is immutable';
  END IF;
  IF OLD.invited_by_user_id IS DISTINCT FROM NEW.invited_by_user_id THEN
    RAISE EXCEPTION 'trip_invites.invited_by_user_id is immutable';
  END IF;
  IF OLD.invited_user_id IS DISTINCT FROM NEW.invited_user_id THEN
    RAISE EXCEPTION 'trip_invites.invited_user_id is immutable';
  END IF;
  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'trip_invites.created_at is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_trip_invites_prevent_immutable_update ON public.trip_invites;

CREATE TRIGGER trg_trip_invites_prevent_immutable_update
  BEFORE UPDATE ON public.trip_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.trip_invites_prevent_immutable_update();

-- ==========================================
-- M2 — trip_invites accepted/declined mutual-exclusion CHECK
-- ==========================================

ALTER TABLE public.trip_invites
  DROP CONSTRAINT IF EXISTS chk_trip_invites_response_exclusive;

ALTER TABLE public.trip_invites
  ADD CONSTRAINT chk_trip_invites_response_exclusive
  CHECK (NOT (accepted_at IS NOT NULL AND declined_at IS NOT NULL));

-- ==========================================
-- M3 — trips_update explicit WITH CHECK + immutable-columns trigger
-- ==========================================

DROP POLICY IF EXISTS "trips_update" ON public.trips;

CREATE POLICY "trips_update" ON public.trips
  FOR UPDATE TO authenticated
  USING (organiser_user_id = (SELECT auth.uid()))
  WITH CHECK (organiser_user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.trips_prevent_immutable_update()
RETURNS TRIGGER AS $$
BEGIN
  -- organiser_user_id cannot be changed except by an admin. participant_count
  -- is intentionally NOT guarded here because update_trip_participant_count()
  -- (00073) legitimately UPDATEs trips.participant_count from the
  -- trip_participants trigger — blocking it would break joins.
  IF OLD.organiser_user_id IS DISTINCT FROM NEW.organiser_user_id
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'trips.organiser_user_id is immutable';
  END IF;
  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'trips.created_at is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_trips_prevent_immutable_update ON public.trips;

CREATE TRIGGER trg_trips_prevent_immutable_update
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trips_prevent_immutable_update();

-- ==========================================
-- L6 — trip_participants role self-promotion
-- ==========================================

CREATE OR REPLACE FUNCTION public.trip_participants_prevent_role_self_promotion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role
     AND NOT EXISTS (
       SELECT 1 FROM public.trips
       WHERE id = NEW.trip_id
         AND organiser_user_id = auth.uid()
     )
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the trip organiser can change a participant role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_trip_participants_prevent_role_self_promotion ON public.trip_participants;

CREATE TRIGGER trg_trip_participants_prevent_role_self_promotion
  BEFORE UPDATE ON public.trip_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.trip_participants_prevent_role_self_promotion();

-- ==========================================
-- L9 — trip_invites policies: add TO authenticated
-- ==========================================

DROP POLICY IF EXISTS "trip_invites_select" ON public.trip_invites;
DROP POLICY IF EXISTS "trip_invites_insert" ON public.trip_invites;
DROP POLICY IF EXISTS "trip_invites_update" ON public.trip_invites;
DROP POLICY IF EXISTS "trip_invites_delete" ON public.trip_invites;

CREATE POLICY "trip_invites_select" ON public.trip_invites
  FOR SELECT TO authenticated
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

CREATE POLICY "trip_invites_insert" ON public.trip_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_invites.trip_id
        AND trips.organiser_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "trip_invites_update" ON public.trip_invites
  FOR UPDATE TO authenticated
  USING (invited_user_id = (SELECT auth.uid()))
  WITH CHECK (invited_user_id = (SELECT auth.uid()));

CREATE POLICY "trip_invites_delete" ON public.trip_invites
  FOR DELETE TO authenticated
  USING (
    invited_by_user_id = (SELECT auth.uid())
    OR invited_user_id = (SELECT auth.uid())
  );

COMMIT;
