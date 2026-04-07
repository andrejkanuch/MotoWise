-- Migration: Add public profile columns to users + create public_profiles view
-- Part of Community Layer — Phase 2: Social Foundation

-- ==========================================
-- ALTER: users table — add public profile columns
-- ==========================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS public_username TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follower_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INT NOT NULL DEFAULT 0;

-- Username format: lowercase alphanumeric + underscore, 3-20 chars
ALTER TABLE public.users
  ADD CONSTRAINT chk_users_public_username
  CHECK (public_username ~ '^[a-z0-9_]{3,20}$');

-- Partial unique index — only enforce uniqueness on non-null usernames
CREATE UNIQUE INDEX idx_users_public_username
  ON public.users (public_username)
  WHERE public_username IS NOT NULL;

-- ==========================================
-- VIEW: public_profiles — safe column whitelist for public/anon access
-- Prevents email, role, preferences from leaking
-- ==========================================
CREATE VIEW public.public_profiles AS
SELECT
  id,
  public_username,
  display_name,
  bio,
  city,
  avatar_url,
  follower_count,
  following_count,
  is_public
FROM public.users
WHERE is_public = true;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ==========================================
-- RLS: Extend users UPDATE WITH CHECK to lock counter columns
-- Replaces policy from migration 00021 (which locked role, email, subscription fields)
-- ==========================================
DROP POLICY IF EXISTS "Users update own data" ON public.users;

CREATE POLICY "Users update own data" ON public.users
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK (
    (select auth.uid()) = id
    AND role = (SELECT role FROM public.users WHERE id = (select auth.uid()))
    AND email = (SELECT email FROM public.users WHERE id = (select auth.uid()))
    AND subscription_tier = (SELECT subscription_tier FROM public.users WHERE id = (select auth.uid()))
    AND subscription_expires_at IS NOT DISTINCT FROM
        (SELECT subscription_expires_at FROM public.users WHERE id = (select auth.uid()))
    AND trial_started_at IS NOT DISTINCT FROM
        (SELECT trial_started_at FROM public.users WHERE id = (select auth.uid()))
    AND follower_count = (SELECT follower_count FROM public.users WHERE id = (select auth.uid()))
    AND following_count = (SELECT following_count FROM public.users WHERE id = (select auth.uid()))
  );
