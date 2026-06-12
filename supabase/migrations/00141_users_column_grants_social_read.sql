-- Migration: users column-level grants + authenticated social read (audit C2, C7, H2)
--
-- Production `public.users` had ONLY own-row + admin SELECT policies, so every
-- authenticated `users!inner(...)` join in the social layer (feed, follows, kudos,
-- comments, trip organisers) silently returned nothing. The naive fix — a row policy
-- alone — would leak email/role/subscription columns through PostgREST column
-- selection, so read access is paired with COLUMN-LEVEL grants.
--
-- The previous "Users update own data" policy froze immutable columns via six
-- WITH CHECK self-subselects on non-granted columns; under the SELECT revoke those
-- subselects would fail with permission-denied on EVERY profile update. Column-level
-- UPDATE grants replace them (strictly stronger: covers all write paths).
--
-- ROLLBACK: re-run 00057's policy block + `GRANT SELECT, UPDATE ON public.users TO
-- authenticated, anon;` to restore table-wide grants.

BEGIN;

-- ============================================================
-- 1. Row policies: authenticated may read public, non-deleted profiles
-- ============================================================
DROP POLICY IF EXISTS "users_select_public_profiles" ON public.users;
CREATE POLICY "users_select_public_profiles" ON public.users
  FOR SELECT TO authenticated
  USING (is_public = true AND deleted_at IS NULL);
-- Own-row reads remain covered by "Users read own data" (00003).

-- Re-apply the anon-by-handle policy from 00097 (present in migrations, missing in
-- prod — drift), with a deleted_at guard so soft-deleted users stop being enumerable.
DROP POLICY IF EXISTS "Anon read public profile by handle" ON public.users;
CREATE POLICY "Anon read public profile by handle" ON public.users
  FOR SELECT TO anon
  USING (handle IS NOT NULL AND is_public = true AND deleted_at IS NULL);

-- ============================================================
-- 2. Column-level SELECT grants (the actual privacy boundary)
--    NEVER grant: email, full_name, role, preferences, currency,
--    measurement_system, subscription_*, trial_started_at, revenuecat_id,
--    deleted_at, deletion_scheduled_at, onboarding_completed_at.
--    API own-profile reads go through the service-role client.
-- ============================================================
REVOKE SELECT ON public.users FROM authenticated, anon;
GRANT SELECT (
  id, handle, public_username, display_name, bio, city, avatar_url,
  follower_count, following_count, is_public, show_saved_publicly, created_at
) ON public.users TO authenticated, anon;

-- ============================================================
-- 3. Column-level UPDATE grants replace the WITH CHECK column-freeze
-- ============================================================
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (
  full_name, avatar_url, years_riding, preferences, measurement_system, currency,
  display_name, bio, city, public_username, handle, is_public, show_saved_publicly
) ON public.users TO authenticated;

DROP POLICY IF EXISTS "Users update own data" ON public.users;
DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own data" ON public.users
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ============================================================
-- 4. share_links: close the anon table dump (audit C7)
--    00022 created `FOR SELECT TO anon USING (true)` — the public anon key could
--    dump every plaintext token + user→motorcycle mapping. resolve() uses the
--    service-role client; owner reads use the own-row policy. Nothing breaks.
-- ============================================================
DROP POLICY IF EXISTS "Anon read share links" ON public.share_links;
REVOKE SELECT ON public.share_links FROM anon;

-- ============================================================
-- 5. SECURITY DEFINER RPCs: forgeable p_user_id (audit H2)
--    Both had default EXECUTE-to-PUBLIC and no auth.uid() check — any JWT (or the
--    anon key) could act as any user directly via PostgREST.
-- ============================================================
-- mark_article_read: was LANGUAGE sql (no RAISE available) → convert to plpgsql.
CREATE OR REPLACE FUNCTION public.mark_article_read(p_user_id UUID, p_article_id UUID)
RETURNS SETOF public.learning_progress AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  INSERT INTO public.learning_progress (user_id, article_id, article_read, first_read_at, last_read_at)
  VALUES (p_user_id, p_article_id, true, NOW(), NOW())
  ON CONFLICT (user_id, article_id)
  DO UPDATE SET article_read = true, last_read_at = NOW()
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.mark_article_read(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_article_read(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_group_ride(p_group_ride_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM 1 FROM public.group_rides
    WHERE id = p_group_ride_id
      AND status = 'published'
      AND participant_count < max_riders
      AND date_time > now()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot join: ride is full, not published, or already started';
  END IF;

  INSERT INTO public.group_ride_participants (group_ride_id, user_id)
    VALUES (p_group_ride_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.join_group_ride(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group_ride(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Post-deploy verification:
--   SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'users';
--   -- expect: Users read own data (SELECT), Admins read all users (SELECT),
--   --         users_select_public_profiles (SELECT/authenticated),
--   --         Anon read public profile by handle (SELECT/anon),
--   --         Users update own data (UPDATE/authenticated) — and nothing else.
--   SELECT count(*) FROM information_schema.column_privileges
--   WHERE table_name = 'users' AND grantee = 'authenticated' AND privilege_type = 'SELECT';
--   -- expect: 12
--   -- As an authenticated user: SELECT email FROM users WHERE is_public; -- expect: permission denied
