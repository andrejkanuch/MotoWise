-- Migration: Create group_rides + group_ride_participants tables
-- Part of NEXT Tier — Phase C: Group Rides

-- ==========================================
-- TABLE: group_rides
-- ==========================================
CREATE TABLE public.group_rides (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organiser_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description         TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 1000),
  date_time           TIMESTAMPTZ NOT NULL,
  meeting_point_lat   FLOAT NOT NULL,
  meeting_point_lng   FLOAT NOT NULL,
  meeting_point_name  TEXT,
  route_id            UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  route_description   TEXT,
  difficulty          TEXT NOT NULL CHECK (difficulty IN ('easy', 'moderate', 'challenging')),
  max_riders          INT NOT NULL CHECK (max_riders BETWEEN 2 AND 50) DEFAULT 10,
  participant_count   INT NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'full', 'completed', 'cancelled')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_rides ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TABLE: group_ride_participants
-- ==========================================
CREATE TABLE public.group_ride_participants (
  group_ride_id UUID NOT NULL REFERENCES public.group_rides(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (group_ride_id, user_id)
);

ALTER TABLE public.group_ride_participants ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES: group_rides
-- ==========================================

-- Browse published rides
CREATE INDEX idx_group_rides_status
  ON public.group_rides (status)
  WHERE status = 'published';

-- Rides organised by a user
CREATE INDEX idx_group_rides_organiser
  ON public.group_rides (organiser_user_id);

-- Browse by date (upcoming first)
CREATE INDEX idx_group_rides_date_time
  ON public.group_rides (date_time DESC);

-- Rides attached to a route
CREATE INDEX idx_group_rides_route
  ON public.group_rides (route_id)
  WHERE route_id IS NOT NULL;

-- ==========================================
-- INDEXES: group_ride_participants
-- ==========================================

-- Rides a user has joined
CREATE INDEX idx_group_ride_participants_user
  ON public.group_ride_participants (user_id);

-- ==========================================
-- FK: comments.group_ride_id -> group_rides
-- Deferred in 00063_comments.sql, now resolved
-- ==========================================
ALTER TABLE public.comments
  ADD CONSTRAINT fk_comments_group_ride
  FOREIGN KEY (group_ride_id) REFERENCES public.group_rides(id) ON DELETE CASCADE;

-- ==========================================
-- FUNCTION: update_group_ride_participant_count()
-- Atomically maintains participant_count on group_rides
-- SECURITY DEFINER with pinned search_path (follows 00060 pattern)
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_group_ride_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.group_rides SET participant_count = participant_count + 1 WHERE id = NEW.group_ride_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.group_rides SET participant_count = GREATEST(participant_count - 1, 0) WHERE id = OLD.group_ride_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- TRIGGER: fire on join/leave
-- ==========================================
CREATE TRIGGER trg_update_group_ride_participant_count
  AFTER INSERT OR DELETE ON public.group_ride_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_ride_participant_count();

-- ==========================================
-- FUNCTION: auto_update_group_ride_status()
-- When participant_count changes, auto-toggle
-- between 'published' and 'full'
-- ==========================================
CREATE OR REPLACE FUNCTION public.auto_update_group_ride_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.participant_count >= NEW.max_riders AND NEW.status = 'published' THEN
    NEW.status := 'full';
  ELSIF NEW.participant_count < NEW.max_riders AND NEW.status = 'full' THEN
    NEW.status := 'published';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- TRIGGER: fire before update on group_rides
-- (runs after participant_count is bumped)
-- ==========================================
CREATE TRIGGER trg_auto_update_group_ride_status
  BEFORE UPDATE ON public.group_rides
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_group_ride_status();

-- ==========================================
-- RLS POLICIES: group_rides
-- ==========================================

-- Anyone can browse published, full, or completed rides
CREATE POLICY "group_rides_select" ON public.group_rides
  FOR SELECT
  USING (status IN ('published', 'full', 'completed'));

-- Authenticated users can create rides (organiser = self)
CREATE POLICY "group_rides_insert" ON public.group_rides
  FOR INSERT TO authenticated
  WITH CHECK (organiser_user_id = (select auth.uid()));

-- Only the organiser can update their ride
CREATE POLICY "group_rides_update" ON public.group_rides
  FOR UPDATE TO authenticated
  USING (organiser_user_id = (select auth.uid()));

-- Only the organiser can delete their ride
CREATE POLICY "group_rides_delete" ON public.group_rides
  FOR DELETE TO authenticated
  USING (organiser_user_id = (select auth.uid()));

-- ==========================================
-- RLS POLICIES: group_ride_participants
-- ==========================================

-- Anyone can see participant lists
CREATE POLICY "group_ride_participants_select" ON public.group_ride_participants
  FOR SELECT
  USING (true);

-- Authenticated users can join published rides (user_id = self)
CREATE POLICY "group_ride_participants_insert" ON public.group_ride_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.group_rides
      WHERE id = group_ride_id AND status = 'published'
    )
  );

-- Users can leave rides they joined (only before the ride date)
CREATE POLICY "group_ride_participants_delete" ON public.group_ride_participants
  FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.group_rides
      WHERE id = group_ride_id AND date_time > now()
    )
  );

-- Explicit deny UPDATE
CREATE POLICY "group_ride_participants_no_update" ON public.group_ride_participants
  FOR UPDATE TO authenticated
  USING (false);
