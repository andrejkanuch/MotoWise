-- Migration: account deletion RPC grants (audit C4)
--
-- 00033 revoked EXECUTE on soft_delete_user from `authenticated` while the function
-- body requires auth.uid() = p_user_id (NULL under service_role) — as migrated,
-- NOBODY could execute it: every deleteAccount call since 00033 has failed.
-- The internal auth.uid() check makes the grant safe: callers can only delete
-- themselves. cancel_account_deletion has the identical contradiction; granted now
-- so a future "restore account during grace period" flow doesn't hit the same wall.
-- hard_delete_expired_accounts stays service-role-only.
--
-- Ops follow-up (manual): mine Sentry/logs for failed deleteAccount calls since
-- 00033 shipped and complete those deletions — GDPR exposure compounds daily.

GRANT EXECUTE ON FUNCTION public.soft_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
