-- Revoke execute on rollup RPCs from non-service roles.
-- These functions are SECURITY DEFINER and must only be callable by service_role
-- (used by SUPABASE_ADMIN in NestJS). Without this, any authenticated user could
-- call record_ride_analytics(any_ride_id, any_user_id, ...) and corrupt rollup data.

REVOKE ALL ON FUNCTION public.record_ride_analytics(UUID, UUID, UUID, TIMESTAMPTZ, JSONB) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public._upsert_rollup(UUID, UUID, public.ride_rollup_period, DATE, JSONB) FROM public, anon, authenticated;

-- Add explicit deny-all write policies on ride_rollups and ride_records
-- as defense-in-depth (writes should only happen via service_role RPCs)

CREATE POLICY "rollups_deny_insert" ON public.ride_rollups
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "rollups_deny_update" ON public.ride_rollups
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "rollups_deny_delete" ON public.ride_rollups
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "records_deny_insert" ON public.ride_records
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "records_deny_update" ON public.ride_records
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "records_deny_delete" ON public.ride_records
  FOR DELETE TO authenticated
  USING (false);
