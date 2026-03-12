-- MOT-120: GDPR data export requests table
-- Tracks user data export requests with rate limiting (1 per 24h)

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  download_url text,
  expires_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

-- Index for rate-limit lookups
create index idx_data_export_requests_user_id_requested_at
  on public.data_export_requests(user_id, requested_at desc);

-- RLS
alter table public.data_export_requests enable row level security;

-- Users can only see their own export requests
create policy "Users can view own export requests"
  on public.data_export_requests for select
  using (auth.uid() = user_id);

-- Users can insert their own export requests
create policy "Users can request own data export"
  on public.data_export_requests for insert
  with check (auth.uid() = user_id);

-- No UPDATE policy needed: service_role bypasses RLS,
-- and regular users should not update export requests.

comment on table public.data_export_requests is 'GDPR data export request audit trail';
