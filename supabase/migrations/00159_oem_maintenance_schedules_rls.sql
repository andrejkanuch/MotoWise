-- MOT-283: oem_maintenance_schedules is public reference content (OEM service
-- intervals) but shipped with RLS DISABLED, so the anon key could read AND WRITE
-- it. Enable RLS with public read + service-role-only writes.
--
-- Reads are preserved (this data is surfaced to all users and via @Public()
-- reads). Writes get no policy, so they are denied for the anon/authenticated
-- roles; the service role used by the generation/seed jobs bypasses RLS and can
-- still mutate. Reversible (DISABLE ROW LEVEL SECURITY) if needed.

ALTER TABLE public.oem_maintenance_schedules ENABLE ROW LEVEL SECURITY;

-- Public read: shared reference data, so a permissive SELECT policy keeps every
-- existing read working (anon + authenticated).
CREATE POLICY "public_read" ON public.oem_maintenance_schedules
  FOR SELECT USING (true);

-- Intentionally NO insert/update/delete policies: writes are denied for
-- anon/authenticated; only the service-role (generation + seed jobs) may mutate.

COMMENT ON TABLE public.oem_maintenance_schedules IS 'OEM service-interval reference data. Public-read via RLS (MOT-283); writes are service-role-only.';
