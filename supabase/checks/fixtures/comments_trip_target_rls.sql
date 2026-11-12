-- Fixture for checks/comments_trip_target_rls.sql in the DISPOSABLE
-- container that run.sh starts. Never run this anywhere else: it creates a
-- stand-in `auth` schema and minimal public tables, then applies 00202.
--
-- On a real Supabase database (local stack or prod) skip this file: those
-- already have the full schema, and 00202 is applied by the normal migration
-- path.
--
-- What it reproduces from Supabase and earlier migrations, because the check
-- depends on it:
--   * the anon / authenticated / service_role roles and the default privileges
--     that GRANT ALL on new public tables to them;
--   * auth.uid() reading the `sub` of request.jwt.claims;
--   * public.trips with trips_select as of 00123 (public non-draft, organiser,
--     private/unlisted participants, admin), which the comments policies'
--     EXISTS subqueries run under;
--   * public.comments as of 00063 + 00072 (trip_id), with comments_select
--     (00063) and comments_insert (00196) as they stand before 00202.

\set ON_ERROR_STOP on
\set QUIET on

DO $$
BEGIN
  IF to_regclass('public.comments') IS NOT NULL OR to_regnamespace('auth') IS NOT NULL THEN
    RAISE EXCEPTION 'comments/auth already exist: this fixture only runs on an empty throwaway database';
  END IF;
END $$;

BEGIN;

DO $$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  aud text,
  role text
);

-- Supabase's definition.
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user'
);

-- 00007.
CREATE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Targets other than trips: only the columns comments_insert reads. No RLS,
-- they are not under test here.
CREATE TABLE public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visibility text NOT NULL DEFAULT 'public',
  deleted_at timestamptz
);
CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'published'
);
CREATE TABLE public.group_rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'published'
);

CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organiser_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  visibility text NOT NULL,
  status text NOT NULL
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trip_participants (
  trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  PRIMARY KEY (trip_id, user_id)
);

-- 00089.
CREATE FUNCTION public.user_is_trip_participant(p_trip_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_participants tp
    WHERE tp.trip_id = p_trip_id AND tp.user_id = p_user_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.user_is_trip_participant(uuid, uuid) TO authenticated, anon;

-- 00123.
CREATE POLICY "trips_select" ON public.trips
  FOR SELECT
  USING (
    (
      visibility = 'public'
      AND (
        status <> 'draft'
        OR organiser_user_id = (SELECT auth.uid())
        OR public.is_admin()
      )
    )
    OR organiser_user_id = (SELECT auth.uid())
    OR (
      visibility = 'private'
      AND public.user_is_trip_participant(trips.id, (SELECT auth.uid()))
    )
    OR (
      visibility = 'unlisted'
      AND public.user_is_trip_participant(trips.id, (SELECT auth.uid()))
    )
    OR public.is_admin()
  );

-- 00063 + 00064/00065 FKs + 00072 trip_id.
CREATE TABLE public.comments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  ride_id           uuid REFERENCES public.rides (id) ON DELETE CASCADE,
  route_id          uuid REFERENCES public.routes (id) ON DELETE CASCADE,
  group_ride_id     uuid REFERENCES public.group_rides (id) ON DELETE CASCADE,
  trip_id           uuid REFERENCES public.trips (id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.comments (id) ON DELETE CASCADE,
  text              text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comments_single_target CHECK (
    (ride_id IS NOT NULL)::int +
    (route_id IS NOT NULL)::int +
    (group_ride_id IS NOT NULL)::int = 1
  )
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 00063.
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT
  USING (true);

-- 00196.
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
      OR EXISTS (SELECT 1 FROM public.routes WHERE id = route_id AND status = 'published')
    )
    AND (
      group_ride_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.group_rides
        WHERE id = group_ride_id AND status IN ('published', 'full')
      )
    )
  );

COMMIT;

\ir ../../migrations/00202_comments_trip_target.sql
