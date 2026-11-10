-- Migration: re-apply 00139 (rollup RPC ACLs) and the schema half of 00143 (rides
-- visibility canonicalization). Both are recorded as applied in
-- supabase_migrations.schema_migrations but their effects are absent from production
-- (same failure as 00141, which 00178 re-applied).
--
-- Verified 2026-11-09 against prod (Management API, read-only catalog queries):
--   * record_ride_analytics, _upsert_rollup, purge_soft_deleted_rides: SECURITY DEFINER,
--     owner postgres, ACL `=X/postgres, postgres=X, anon=X, authenticated=X,
--     service_role=X`. Anyone with the anon key can call record_ride_analytics(any_ride,
--     any_user, ...) through PostgREST to inflate any rider's rollups and stamp
--     `metadata` on any ride, and can run the GDPR purge on demand.
--   * The 00139 deny-write policies on ride_rollups / ride_records are missing.
--   * rides_public_read (00058, gates on is_public) still exists; summaries_public_read,
--     kudos_insert and comments_insert still gate on rides.is_public;
--     idx_rides_feed_user_visibility is missing.
--   * is_public/visibility drift: 0 rows, so 00143's snapshot + restrictive merge has
--     nothing to do and is NOT repeated here; the 00143 policy/index end state is.
--
-- Callers after this migration:
--   * record_ride_analytics: API RideRollupAggregator via SUPABASE_ADMIN (service_role),
--     which keeps EXECUTE. _upsert_rollup is only called from inside it (as owner).
--   * purge_soft_deleted_rides: pg_cron job `purge-soft-deleted-rides`, run as postgres.
--
-- DEPLOY ORDER: the API change in the same PR (KudosService reads `visibility`, not
-- `is_public`) should deploy first or together; the API already dual-writes both
-- columns, so either order is safe today (drift 0), but deploy-first is the rule 00143 set.
--
-- Idempotent: safe to re-run, and safe on a database where 00139/00143 did land.
-- Apply as ONE statement batch (one Management API call) with this leading comment
-- block stripped, then record version 00196 in supabase_migrations.schema_migrations.
--
-- ROLLBACK (restores the pre-migration, insecure state; prefer fixing forward):
--   GRANT EXECUTE ON FUNCTION public.record_ride_analytics(UUID, UUID, UUID, TIMESTAMPTZ, JSONB),
--     public._upsert_rollup(UUID, UUID, public.ride_rollup_period, DATE, JSONB),
--     public.purge_soft_deleted_rides() TO PUBLIC, anon, authenticated;
--   DROP the six rollups_deny_* / records_deny_* policies;
--   re-create rides_public_read from 00058 and the is_public bodies of
--   summaries_public_read (00058), kudos_insert (00060) and comments_insert (00070);
--   DROP INDEX IF EXISTS public.idx_rides_feed_user_visibility; and redeploy the
--   previous KudosService if `is_public` is ever reintroduced as the gate.

BEGIN;

-- Fail fast instead of queueing rides traffic behind a long-running query: the
-- policy changes below take ACCESS EXCLUSIVE locks held until COMMIT.
SET LOCAL lock_timeout = '5s';

-- rides_public_read is dropped below; rides_select_with_visibility (00084) must be
-- the SELECT policy left in its place, or every signed-in rides read returns no rows.
-- Earlier migrations were recorded as applied without landing, so check, don't assume.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rides'
      AND policyname = 'rides_select_with_visibility' AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION '00196: rides_select_with_visibility (00084) is missing; refusing to drop rides_public_read';
  END IF;
END $$;

-- ============================================================
-- 1. 00139: SECURITY DEFINER rollup/purge RPCs are service-role only.
--    `anon` and `authenticated` must be named: Supabase's default privileges grant
--    EXECUTE to them explicitly, so REVOKE ... FROM PUBLIC alone leaves them callable.
-- ============================================================
REVOKE ALL ON FUNCTION public.record_ride_analytics(UUID, UUID, UUID, TIMESTAMPTZ, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._upsert_rollup(UUID, UUID, public.ride_rollup_period, DATE, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_soft_deleted_rides()
  FROM PUBLIC, anon, authenticated;

-- Keep (re-assert) the grants the API and cron rely on.
GRANT EXECUTE ON FUNCTION public.record_ride_analytics(UUID, UUID, UUID, TIMESTAMPTZ, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public._upsert_rollup(UUID, UUID, public.ride_rollup_period, DATE, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted_rides() TO service_role;

-- ============================================================
-- 2. 00139: explicit deny-all write policies (defense in depth; writes happen only
--    through the service-role RPCs above).
-- ============================================================
DROP POLICY IF EXISTS "rollups_deny_insert" ON public.ride_rollups;
CREATE POLICY "rollups_deny_insert" ON public.ride_rollups
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "rollups_deny_update" ON public.ride_rollups;
CREATE POLICY "rollups_deny_update" ON public.ride_rollups
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "rollups_deny_delete" ON public.ride_rollups;
CREATE POLICY "rollups_deny_delete" ON public.ride_rollups
  FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "records_deny_insert" ON public.ride_records;
CREATE POLICY "records_deny_insert" ON public.ride_records
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "records_deny_update" ON public.ride_records;
CREATE POLICY "records_deny_update" ON public.ride_records
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "records_deny_delete" ON public.ride_records;
CREATE POLICY "records_deny_delete" ON public.ride_records
  FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- 3. 00143 (c): drop the stale is_public world-read policy. Owner/admin/shared/public
--    reads are covered by rides_select_with_visibility (00084).
-- ============================================================
DROP POLICY IF EXISTS "rides_public_read" ON public.rides;

-- ============================================================
-- 4. 00143 (d): SQL consumers of rides.is_public -> visibility (bodies verbatim from 00143)
-- ============================================================
DROP POLICY IF EXISTS "summaries_public_read" ON public.ride_summaries;
CREATE POLICY "summaries_public_read" ON public.ride_summaries
  FOR SELECT TO authenticated
  USING (
    ride_id IN (
      SELECT id FROM public.rides WHERE visibility = 'public' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "kudos_insert" ON public.ride_kudos;
CREATE POLICY "kudos_insert" ON public.ride_kudos
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.rides
      WHERE id = ride_id AND visibility = 'public' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
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
      OR EXISTS (
        SELECT 1 FROM public.routes
        WHERE id = route_id AND status = 'published'
      )
    )
    AND (
      group_ride_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.group_rides
        WHERE id = group_ride_id AND status IN ('published', 'full')
      )
    )
  );

-- Feed index on the canonical column. idx_rides_feed_user (is_public) stays until the
-- later is_public cleanup migration, so feed queries never lose index coverage.
CREATE INDEX IF NOT EXISTS idx_rides_feed_user_visibility
  ON public.rides (user_id, started_at DESC)
  WHERE visibility = 'public' AND deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Post-apply verification (read-only):
--   SELECT p.proname,
--     array(SELECT CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END
--           FROM aclexplode(p.proacl) a WHERE a.privilege_type = 'EXECUTE' ORDER BY 1) AS executors,
--     has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
--     has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
--     has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('record_ride_analytics', '_upsert_rollup', 'purge_soft_deleted_rides');
--   -- expect for each: executors = {postgres,service_role} (no PUBLIC),
--   --   anon = false, authenticated = false, service_role = true
--
--   SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('rides', 'ride_summaries', 'ride_kudos', 'comments',
--                       'ride_rollups', 'ride_records')
--   ORDER BY 1, 2;
--   -- expect: rides_public_read ABSENT; rides_select_with_visibility present;
--   --   summaries_public_read / kudos_insert / comments_insert reference
--   --   `visibility = 'public'` and NOT `is_public`;
--   --   rollups_deny_{insert,update,delete} and records_deny_{insert,update,delete} present
--
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE schemaname = 'public' AND tablename = 'rides' AND indexname LIKE 'idx_rides_feed_user%';
--   -- expect: idx_rides_feed_user_visibility (WHERE visibility = 'public' AND deleted_at IS NULL)
--   --   and the legacy idx_rides_feed_user
--
--   SELECT count(*) FROM public.rides
--   WHERE (is_public AND visibility <> 'public') OR (NOT is_public AND visibility = 'public');
--   -- expect: 0
