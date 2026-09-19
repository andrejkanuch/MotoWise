-- Migration: re-apply 00141 (users column grants, social read policies, share_links
-- anon revoke, RPC caller checks) — recorded as applied, but absent from production.
--
-- Verified 2026-09-19 against prod (Management API, read-only):
--   * public.users: table-wide ALL grants for anon + authenticated; none of 00141's
--     column-level SELECT/UPDATE grants; the pre-00141 "Users update own profile"
--     (00031) and WITH CHECK-frozen "Users update own data" (00057) policies both
--     exist; "users_select_public_profiles" and "Anon read public profile by handle"
--     are missing.
--   * share_links: "Anon read share links" (00022) still present.
--   * mark_article_read / join_group_ride: SECURITY DEFINER, no auth.uid() check,
--     EXECUTE granted to PUBLIC/anon — any anon-key holder can act as any user.
--   * supabase_migrations.schema_migrations lists 00141 as applied.
-- Most likely 00141 was rolled back by hand (its own ROLLBACK note) and the record
-- kept; the RC trial audit (docs/RevenueCat-Trial-Audit-2026-09-19.md) found it.
--
-- Code prerequisite (deploy BEFORE applying): every own-row read of a column
-- outside the SELECT grant below must use the service-role client. As of this
-- migration the only user-client offender was BlogService.assertAdmin (`role`),
-- fixed in the same PR. `select('*')` on users via the user client fails after this.
--
-- Idempotent: safe to run on a database where 00141 did land.
-- ROLLBACK: `GRANT SELECT, UPDATE ON public.users TO authenticated, anon;` and
-- re-run 00057's policy block.

BEGIN;

-- ============================================================
-- 1. Row policies: authenticated may read public, non-deleted profiles
-- ============================================================
DROP POLICY IF EXISTS "users_select_public_profiles" ON public.users;
CREATE POLICY "users_select_public_profiles" ON public.users
  FOR SELECT TO authenticated
  USING (is_public = true AND deleted_at IS NULL);
-- Own-row reads remain covered by "Users read own data" (00003).

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
REVOKE ALL ON public.users FROM authenticated, anon;
GRANT SELECT (
  id, handle, public_username, display_name, bio, city, avatar_url,
  follower_count, following_count, is_public, show_saved_publicly, created_at
) ON public.users TO authenticated, anon;

-- ============================================================
-- 3. Column-level UPDATE grants replace the WITH CHECK column-freeze
-- ============================================================
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
-- ============================================================
DROP POLICY IF EXISTS "Anon read share links" ON public.share_links;
REVOKE SELECT ON public.share_links FROM anon;

-- ============================================================
-- 5. SECURITY DEFINER RPCs: forgeable p_user_id (audit H2)
-- ============================================================
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

-- CREATE OR REPLACE keeps the existing ACL, and the project's default privileges
-- grant EXECUTE to anon explicitly, so both PUBLIC and anon must be named.
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

-- Post-deploy verification (see 00141 footer):
--   SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'users';
--   -- expect exactly: Users read own data, Admins read all users,
--   --   users_select_public_profiles (authenticated), Anon read public profile by
--   --   handle (anon), Users update own data (authenticated)
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name = 'users' AND grantee IN ('anon','authenticated');
--   -- expect: no rows (column grants only)
--   SELECT proacl FROM pg_proc WHERE proname IN ('mark_article_read','join_group_ride');
--   -- expect: no `=X` (PUBLIC) and no `anon=X` entry
