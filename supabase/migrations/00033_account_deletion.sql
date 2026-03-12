-- MOT-121: Account deletion with 30-day grace period
-- Adds soft delete column to users and a hard delete RPC

-- Add soft delete columns to users table
alter table public.users
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz;

-- Index for cron job to find accounts pending hard deletion
create index if not exists idx_users_deletion_scheduled
  on public.users(deletion_scheduled_at)
  where deletion_scheduled_at is not null and deleted_at is null;

-- RPC: Soft delete user account (marks for deletion in 30 days)
create or replace function public.soft_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify the caller is the user being deleted
  if auth.uid() is distinct from p_user_id then
    raise exception 'Unauthorized: can only delete own account';
  end if;

  -- Mark user as soft-deleted
  update public.users
  set
    deleted_at = now(),
    deletion_scheduled_at = now() + interval '30 days',
    updated_at = now()
  where id = p_user_id
    and deleted_at is null;

  if not found then
    raise exception 'User not found or already deleted';
  end if;
end;
$$;

-- RPC: Cancel account deletion (restore within grace period)
create or replace function public.cancel_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Unauthorized: can only restore own account';
  end if;

  update public.users
  set
    deleted_at = null,
    deletion_scheduled_at = null,
    updated_at = now()
  where id = p_user_id
    and deleted_at is not null
    and deletion_scheduled_at > now();

  if not found then
    raise exception 'Account not found or grace period expired';
  end if;
end;
$$;

-- RPC: Hard delete user account (called by cron or admin)
-- Deletes auth user which cascades to public.users and all related data
create or replace function public.hard_delete_expired_accounts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
  user_record record;
begin
  for user_record in
    select id from public.users
    where deletion_scheduled_at is not null
      and deletion_scheduled_at <= now()
      and deleted_at is not null
  loop
    -- Delete storage files for this user
    -- (bike photos, diagnostic photos, export files)
    delete from storage.objects
    where bucket_id in ('bike-photos', 'diagnostic-photos', 'user-exports')
      and (storage.foldername(name))[1] = user_record.id::text;

    -- Delete the auth user (cascades to public.users and all FK-dependent tables)
    delete from auth.users where id = user_record.id;

    deleted_count := deleted_count + 1;
  end loop;

  return deleted_count;
end;
$$;

comment on function public.soft_delete_user is 'MOT-121: Soft-deletes user account with 30-day grace period';
comment on function public.cancel_account_deletion is 'MOT-121: Cancels pending account deletion during grace period';
comment on function public.hard_delete_expired_accounts is 'MOT-121: Permanently deletes accounts past grace period (cron)';
