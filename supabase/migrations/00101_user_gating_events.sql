-- Track quota-gated feature usage (GPX exports, future gated features)
create table if not exists public.user_gating_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  route_id uuid references public.routes(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Index for monthly quota lookups
create index idx_user_gating_events_user_feature_created
  on public.user_gating_events (user_id, feature, created_at desc);

-- RLS
alter table public.user_gating_events enable row level security;

-- Users can read their own events
create policy "Users can read own gating events"
  on public.user_gating_events for select
  using (auth.uid() = user_id);

-- Only service role inserts (API server) — no authenticated user insert policy
-- Inserts are done via SUPABASE_ADMIN (service-role), which bypasses RLS.
-- No insert policy for authenticated role prevents quota poisoning attacks.

comment on table public.user_gating_events is 'Tracks quota-gated feature usage for entitlement enforcement';
