-- MOT-134: Setup daily cron job for hard-deleting expired accounts
-- MOT-120: Create user-exports storage bucket for GDPR data exports

-- =============================================================================
-- 1. Enable pg_cron extension (available on all Supabase hosted projects)
-- =============================================================================
create extension if not exists pg_cron with schema pg_catalog;

-- Grant usage so the cron job can call our RPC
grant usage on schema cron to postgres;

-- =============================================================================
-- 2. Schedule daily hard-delete at 03:00 UTC (off-peak hours)
-- =============================================================================
select cron.schedule(
  'hard-delete-expired-accounts',       -- unique job name
  '0 3 * * *',                          -- every day at 03:00 UTC
  $$select public.hard_delete_expired_accounts()$$
);

-- =============================================================================
-- 3. Create user-exports storage bucket for GDPR data exports
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-exports',
  'user-exports',
  false,                                -- private bucket
  52428800,                             -- 50 MB max file size
  array['application/zip', 'application/json']
)
on conflict (id) do nothing;

-- RLS policy: users can only read their own exports
do $$ begin
  create policy "Users can read own exports"
    on storage.objects for select
    using (
      bucket_id = 'user-exports'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null;
end $$;

-- Service role can insert/delete (used by the API for generating + cleanup)
do $$ begin
  create policy "Service role can manage exports"
    on storage.objects for all
    using (
      bucket_id = 'user-exports'
      and auth.role() = 'service_role'
    );
exception when duplicate_object then null;
end $$;
