-- Migration: P5.1 — co-planning roles + async waypoint suggestions
--
-- 1. Extend trip_participants.role to support 'co_planner' (keeps the existing
--    check-constraint-as-enum pattern — see 00072_trips.sql line 50).
-- 2. Create trip_suggestions: async "hey, stop at X?" proposals with an
--    accept/reject workflow. Keeps real-time co-cursor complexity out of scope.
-- 3. RLS: organiser + co_planners can manage suggestions / accept them;
--    any participant can propose; authors can withdraw their own.

BEGIN;

-- ==========================================
-- 1. trip_participants role: add co_planner
-- ==========================================
ALTER TABLE public.trip_participants
  DROP CONSTRAINT IF EXISTS trip_participants_role_check;

ALTER TABLE public.trip_participants
  ADD CONSTRAINT trip_participants_role_check
  CHECK (role IN ('organizer', 'co_planner', 'rider'));

-- ==========================================
-- 2. trip_suggestions
-- ==========================================
CREATE TABLE public.trip_suggestions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  author_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- The proposed change. `waypoint` is the first-class case; keep the shape
  -- extensible without boiling the ocean.
  kind             TEXT NOT NULL DEFAULT 'waypoint'
                     CHECK (kind IN ('waypoint', 'note')),

  -- Waypoint proposals carry coordinates + name + optional day/period.
  name             TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  notes            TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  day_index        INT,
  period_of_day    TEXT CHECK (period_of_day IS NULL OR period_of_day IN ('morning', 'afternoon', 'evening')),

  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  decided_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at       TIMESTAMPTZ,
  decided_note     TEXT CHECK (decided_note IS NULL OR char_length(decided_note) <= 500),

  -- If accepted, which waypoint did it become? Lets clients link back.
  waypoint_id      UUID REFERENCES public.trip_waypoints(id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_suggestions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_trip_suggestions_trip
  ON public.trip_suggestions (trip_id, status);

CREATE INDEX idx_trip_suggestions_author
  ON public.trip_suggestions (author_user_id);

-- Keep updated_at fresh on any status change.
CREATE OR REPLACE FUNCTION public.trip_suggestions_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trip_suggestions_updated_at
  BEFORE UPDATE ON public.trip_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.trip_suggestions_touch_updated_at();

-- ==========================================
-- 3. RLS policies
-- ==========================================

-- SELECT: anyone who can see the trip can see its suggestions. Simpler than
-- re-auditing via trip participants; mirrors existing comments-style access.
CREATE POLICY "trip_suggestions_select" ON public.trip_suggestions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_suggestions.trip_id
        AND (
          t.status IN ('published', 'active', 'completed')
          OR t.organiser_user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.trip_participants tp
            WHERE tp.trip_id = t.id AND tp.user_id = (select auth.uid())
          )
        )
    )
  );

-- INSERT: any participant (including the organiser) can propose.
CREATE POLICY "trip_suggestions_insert" ON public.trip_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = (select auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = trip_id AND t.organiser_user_id = (select auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.trip_participants tp
        WHERE tp.trip_id = trip_id AND tp.user_id = (select auth.uid())
      )
    )
  );

-- UPDATE: organiser or co_planners can accept/reject; the author can withdraw
-- their own pending suggestions. Narrower than a blanket update policy.
CREATE POLICY "trip_suggestions_update" ON public.trip_suggestions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_id AND t.organiser_user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.trip_participants tp
      WHERE tp.trip_id = trip_id
        AND tp.user_id = (select auth.uid())
        AND tp.role = 'co_planner'
    )
    OR (author_user_id = (select auth.uid()) AND status = 'pending')
  );

-- DELETE: organiser or author. (Co-planners shouldn't be able to silently
-- nuke a record — they should reject instead.)
CREATE POLICY "trip_suggestions_delete" ON public.trip_suggestions
  FOR DELETE TO authenticated
  USING (
    author_user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_id AND t.organiser_user_id = (select auth.uid())
    )
  );

COMMIT;
