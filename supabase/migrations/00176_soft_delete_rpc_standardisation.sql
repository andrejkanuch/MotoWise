-- Migration: 00176_soft_delete_rpc_standardisation
--
-- Standardises every user-facing soft delete on one pattern: a SECURITY DEFINER
-- RPC that checks ownership in the database.
--
-- THE BUG THIS CLOSES
-- Every table here has a SELECT policy shaped
--   USING (auth.uid() = user_id AND deleted_at IS NULL)
-- and PostgreSQL applies SELECT policies to the NEW row of an UPDATE whenever
-- the statement needs read access to table columns -- a WHERE clause, a
-- RETURNING clause, or a Supabase `.select()`, which every real soft delete has.
-- Stamping deleted_at therefore makes the row invisible to that policy and the
-- statement is rejected outright:
--   42501 new row violates row-level security policy for table "<t>"
-- The table's own UPDATE policy passes; it is the SELECT policy doing the
-- rejecting, which is why 00053's attempt to fix expenses by relaxing the UPDATE
-- WITH CHECK changed nothing. Expense deletion was broken for every rider from
-- the day it shipped (Sentry MOTO-VAULT-REACT-NATIVE-1M).
--
-- WHY AN RPC AND NOT THE ADMIN CLIENT
-- Both work. The service-role client bypasses RLS entirely, which moves the
-- ownership check into application code and leaves the database with no say.
-- SECURITY DEFINER runs as the table owner (so the SELECT policy does not apply)
-- while still pinning `user_id = auth.uid()` inside the function, so ownership
-- stays enforced where it cannot be refactored away. Root CLAUDE.md's standing
-- rule is "NEVER use service-role for user-scoped writes"; this keeps that rule
-- intact instead of widening its exception list.
--
-- ONE SHAPE, ONE MEANING
-- Before this migration the codebase solved the same defect three ways
-- (admin client for rides, RPC for motorcycles/maintenance_tasks, and expenses
-- simply broken), and the two RPCs returned "we flipped a live row" — so
-- deleting something already deleted raised NotFound. Every function here now
-- returns the same thing:
--
--   true  -> the row is soft-deleted AND belongs to the caller
--   false -> no such row for this caller (missing, or owned by someone else)
--
-- Deleting an already-deleted row returns true. That is what a caller means by
-- "delete this": duplicate taps, offline sync retries and stale lists all
-- converge on the same answer instead of surfacing an error for work that is
-- already done. `false` deliberately does not distinguish "missing" from "not
-- yours" — that distinction is an existence oracle for other users' ids.
--
-- SET search_path = '' on all four: a SECURITY DEFINER function without a pinned
-- search_path can be hijacked via a shadowing schema. The two functions from
-- 00027 predate that hardening and are re-created here to pick it up; every
-- reference inside is already schema-qualified, so pinning it changes nothing
-- else.
--
-- REVOKE ... FROM PUBLIC, anon on all four. Two separate default grants have to
-- go, and revoking only the first is the trap:
--   1. PostgreSQL grants EXECUTE to PUBLIC on every new function, and privileges
--      are additive, so GRANT ... TO authenticated does not take it away.
--   2. This database also carries `ALTER DEFAULT PRIVILEGES ... IN SCHEMA public
--      GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role` (the
--      Supabase default, visible in pg_default_acl). That is an *explicit* anon
--      grant, so `REVOKE ... FROM PUBLIC` alone does not remove it -- verified
--      against this database: a probe function revoked only FROM PUBLIC is still
--      executable after `SET LOCAL role anon`, and stops being executable once
--      anon is named in the REVOKE.
-- Naming anon is therefore what actually closes the grant, and it also clears the
-- one 00027 left on the two re-created functions (CREATE OR REPLACE keeps a
-- function's existing ACL, so replacing them does not reset it).
--
-- This is defence in depth rather than a live hole: the `auth.uid() IS NULL`
-- guard already makes an anon call return false and delete nothing. service_role
-- keeps its grant -- the same guard makes the function refuse it, and RLS-bypass
-- roles gain nothing from it. REVOKE and GRANT sit in the same transaction as the
-- functions, so there is no window where they are executable by everyone.
--
-- DEPLOY ORDER: apply this migration BEFORE the API that calls the two new
-- functions. Render auto-deploys apps/api on merge to main, so that window opens
-- by itself and only a human closes it.
--
-- The two sides of the window are NOT symmetric, and the asymmetry is the reason
-- to care:
--   expenses -- deletion is already 100% broken in production, so an API that
--     cannot find soft_delete_expense yet is no worse than today. No regression.
--   rides    -- deletion currently WORKS. It goes through supabaseAdmin, and
--     service_role bypasses RLS, so the direct UPDATE lands. An API deployed
--     ahead of this migration calls a function that does not exist, PostgREST
--     answers with an error, and deleteRide raises a 500. Ride deletion
--     regresses from working to broken for the length of the window.
-- So: `npx supabase db push` first, then merge. Not the other way around.

BEGIN;

-- Expenses -- new. The table this whole migration exists for.
CREATE OR REPLACE FUNCTION public.soft_delete_expense(expense_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.expenses
  SET deleted_at = NOW()
  WHERE id = expense_id
    AND user_id = v_uid
    AND deleted_at IS NULL;

  IF FOUND THEN
    RETURN true;
  END IF;

  -- Already deleted and still the caller's row -> idempotent success.
  RETURN EXISTS (
    SELECT 1 FROM public.expenses
    WHERE id = expense_id AND user_id = v_uid
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_expense(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_expense(uuid) TO authenticated;

-- Rides -- new. Replaces the supabaseAdmin bypass in rides.deleteRide, including
-- its second round trip that counted already-deleted rows through the admin
-- client; the EXISTS below answers that in the same statement.
CREATE OR REPLACE FUNCTION public.soft_delete_ride(ride_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.rides
  SET deleted_at = NOW()
  WHERE id = ride_id
    AND user_id = v_uid
    AND deleted_at IS NULL;

  IF FOUND THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.rides
    WHERE id = ride_id AND user_id = v_uid
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_ride(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_ride(uuid) TO authenticated;

-- Motorcycles -- re-created from 00027 for the pinned search_path and the
-- idempotent already-deleted answer.
CREATE OR REPLACE FUNCTION public.soft_delete_motorcycle(motorcycle_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.motorcycles
  SET deleted_at = NOW()
  WHERE id = motorcycle_id
    AND user_id = v_uid
    AND deleted_at IS NULL;

  IF FOUND THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.motorcycles
    WHERE id = motorcycle_id AND user_id = v_uid
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_motorcycle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_motorcycle(uuid) TO authenticated;

-- Maintenance tasks -- same treatment.
CREATE OR REPLACE FUNCTION public.soft_delete_maintenance_task(task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.maintenance_tasks
  SET deleted_at = NOW()
  WHERE id = task_id
    AND user_id = v_uid
    AND deleted_at IS NULL;

  IF FOUND THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.maintenance_tasks
    WHERE id = task_id AND user_id = v_uid
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_maintenance_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_maintenance_task(uuid) TO authenticated;

COMMENT ON FUNCTION public.soft_delete_expense(uuid) IS
  'Soft-deletes the caller''s expense. Returns true when the row is deleted and owned by the caller (idempotent), false when no such row exists for them. SECURITY DEFINER because a deleted_at IS NULL SELECT policy rejects the UPDATE that sets deleted_at.';
COMMENT ON FUNCTION public.soft_delete_ride(uuid) IS
  'Soft-deletes the caller''s ride. Same contract as soft_delete_expense.';
COMMENT ON FUNCTION public.soft_delete_motorcycle(uuid) IS
  'Soft-deletes the caller''s motorcycle. Same contract as soft_delete_expense.';
COMMENT ON FUNCTION public.soft_delete_maintenance_task(uuid) IS
  'Soft-deletes the caller''s maintenance task. Same contract as soft_delete_expense.';

COMMIT;
