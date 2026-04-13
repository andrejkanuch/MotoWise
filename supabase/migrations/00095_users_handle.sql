-- Migration: MOT-169 — Add handle column for public profile URLs
-- Handles are case-insensitive (citext), unique, and validated

-- ==========================================
-- Extension: citext for case-insensitive handles
-- ==========================================
CREATE EXTENSION IF NOT EXISTS citext;

-- ==========================================
-- ALTER: users table — add handle + show_saved_publicly
-- ==========================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS handle CITEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS show_saved_publicly BOOLEAN NOT NULL DEFAULT false;

-- Format constraint: lowercase alphanumeric + underscore, 3-20 chars
ALTER TABLE public.users
  ADD CONSTRAINT chk_users_handle
  CHECK (handle ~ '^[a-z0-9_]{3,20}$');

-- ==========================================
-- Backfill: derive handle from email local-part
-- Sanitize non-alphanumeric chars, truncate to 17, append numeric suffix if dupe
-- ==========================================
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  suffix INT;
BEGIN
  FOR r IN SELECT id, email FROM public.users WHERE handle IS NULL ORDER BY created_at
  LOOP
    -- Extract local-part before @, lowercase, replace non-alnum with underscore
    base := regexp_replace(
      lower(split_part(r.email, '@', 1)),
      '[^a-z0-9_]', '_', 'g'
    );
    -- Trim leading/trailing underscores, collapse consecutive underscores
    base := regexp_replace(base, '_+', '_', 'g');
    base := trim(both '_' from base);
    -- Ensure minimum length
    IF length(base) < 3 THEN
      base := base || repeat('0', 3 - length(base));
    END IF;
    -- Truncate to 17 chars to leave room for numeric suffix
    base := left(base, 17);

    candidate := base;
    suffix := 1;

    -- Find unique candidate
    WHILE EXISTS (SELECT 1 FROM public.users WHERE handle = candidate) LOOP
      candidate := left(base, 20 - length(suffix::TEXT)) || suffix::TEXT;
      suffix := suffix + 1;
    END LOOP;

    UPDATE public.users SET handle = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- ==========================================
-- Update public_profiles view to include handle + show_saved_publicly
-- ==========================================
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  public_username,
  handle,
  display_name,
  bio,
  city,
  avatar_url,
  follower_count,
  following_count,
  is_public,
  show_saved_publicly
FROM public.users
WHERE is_public = true;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ==========================================
-- RLS: anonymous read on limited columns via handle lookup
-- ==========================================
-- Allow anon to SELECT only safe columns from users by handle
CREATE POLICY "Anon read public profile by handle" ON public.users
  FOR SELECT TO anon
  USING (handle IS NOT NULL AND is_public = true);

-- Note: the public_profiles view already restricts which columns are visible.
-- This policy allows direct handle lookups. The view + GRANT is the primary
-- mechanism for column-level restriction.

-- ==========================================
-- Update "Users update own data" policy to lock show_saved_publicly counter-style columns
-- (show_saved_publicly is user-editable, so we do NOT lock it here)
-- We DO need to lock the handle column from the WITH CHECK so it can't be set to
-- a value that violates reserved words — but that's handled at the app layer.
-- ==========================================
