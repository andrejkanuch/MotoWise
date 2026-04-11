-- Migration: Create trips + trip_waypoints + trip_participants tables
-- Part of NEXT Tier — Trip Itinerary feature

-- ==========================================
-- TABLE: trips
-- ==========================================
CREATE TABLE public.trips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organiser_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description         TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  difficulty          TEXT NOT NULL CHECK (difficulty IN ('easy', 'moderate', 'challenging', 'expert')),
  max_riders          INT NOT NULL CHECK (max_riders BETWEEN 2 AND 50) DEFAULT 10,
  participant_count   INT NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'completed', 'archived')),
  cover_image_url     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_trips_date_range CHECK (end_date >= start_date)
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TABLE: trip_waypoints
-- ==========================================
CREATE TABLE public.trip_waypoints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  sort_order  INT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('start', 'end', 'fuel', 'food', 'scenic', 'overnight', 'photo', 'mechanical', 'ferry', 'pass_summit', 'rally_point')),
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  notes       TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  lat         FLOAT NOT NULL,
  lng         FLOAT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_waypoints ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TABLE: trip_participants
-- ==========================================
CREATE TABLE public.trip_participants (
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'rider' CHECK (role IN ('organizer', 'rider')),
  status      TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('invited', 'going', 'maybe', 'declined')),
  bike_id     UUID REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (trip_id, user_id)
);

ALTER TABLE public.trip_participants ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES: trips
-- ==========================================

-- Browse published/active trips
CREATE INDEX idx_trips_status
  ON public.trips (status)
  WHERE status IN ('published', 'active');

-- Trips organised by a user
CREATE INDEX idx_trips_organiser
  ON public.trips (organiser_user_id);

-- ==========================================
-- INDEXES: trip_waypoints
-- ==========================================

-- Waypoints for a trip, ordered
CREATE INDEX idx_trip_waypoints_trip_sort
  ON public.trip_waypoints (trip_id, sort_order);

-- ==========================================
-- INDEXES: trip_participants
-- ==========================================

-- Participants for a trip
CREATE INDEX idx_trip_participants_trip
  ON public.trip_participants (trip_id);

-- Trips a user has joined
CREATE INDEX idx_trip_participants_user
  ON public.trip_participants (user_id);

-- ==========================================
-- FK: comments.trip_id -> trips
-- ==========================================
ALTER TABLE public.comments
  ADD COLUMN trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE;

CREATE INDEX idx_comments_trip_id
  ON public.comments (trip_id)
  WHERE trip_id IS NOT NULL;

-- ==========================================
-- FUNCTION: update_trip_participant_count()
-- Atomically maintains participant_count on trips
-- SECURITY DEFINER with pinned search_path (follows 00066 pattern)
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_trip_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.trips SET participant_count = participant_count + 1 WHERE id = NEW.trip_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.trips SET participant_count = GREATEST(participant_count - 1, 0) WHERE id = OLD.trip_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- TRIGGER: fire on join/leave
-- ==========================================
CREATE TRIGGER trg_update_trip_participant_count
  AFTER INSERT OR DELETE ON public.trip_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trip_participant_count();

-- ==========================================
-- RLS POLICIES: trips
-- ==========================================

-- Anyone can see published/active/completed trips + organiser can see own drafts
CREATE POLICY "trips_select" ON public.trips
  FOR SELECT
  USING (
    status IN ('published', 'active', 'completed')
    OR organiser_user_id = (select auth.uid())
  );

-- Authenticated users can create trips (organiser = self)
CREATE POLICY "trips_insert" ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (organiser_user_id = (select auth.uid()));

-- Only the organiser can update their trip
CREATE POLICY "trips_update" ON public.trips
  FOR UPDATE TO authenticated
  USING (organiser_user_id = (select auth.uid()));

-- Only the organiser can delete their trip
CREATE POLICY "trips_delete" ON public.trips
  FOR DELETE TO authenticated
  USING (organiser_user_id = (select auth.uid()));

-- ==========================================
-- RLS POLICIES: trip_waypoints
-- ==========================================

-- Anyone can see waypoints if the trip is visible
CREATE POLICY "trip_waypoints_select" ON public.trip_waypoints
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id
        AND (
          status IN ('published', 'active', 'completed')
          OR organiser_user_id = (select auth.uid())
        )
    )
  );

-- Only trip organiser can insert waypoints
CREATE POLICY "trip_waypoints_insert" ON public.trip_waypoints
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND organiser_user_id = (select auth.uid())
    )
  );

-- Only trip organiser can update waypoints
CREATE POLICY "trip_waypoints_update" ON public.trip_waypoints
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND organiser_user_id = (select auth.uid())
    )
  );

-- Only trip organiser can delete waypoints
CREATE POLICY "trip_waypoints_delete" ON public.trip_waypoints
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND organiser_user_id = (select auth.uid())
    )
  );

-- ==========================================
-- RLS POLICIES: trip_participants
-- ==========================================

-- Anyone can see participant lists
CREATE POLICY "trip_participants_select" ON public.trip_participants
  FOR SELECT
  USING (true);

-- Authenticated users can join published trips (user_id = self)
CREATE POLICY "trip_participants_insert" ON public.trip_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND status = 'published'
    )
  );

-- Users can update their own participation (status changes)
CREATE POLICY "trip_participants_update" ON public.trip_participants
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

-- Users can leave trips they joined
CREATE POLICY "trip_participants_delete" ON public.trip_participants
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));
