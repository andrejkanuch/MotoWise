-- Migration: 00188_claim_device_push_token
--
-- Lets a signed-in user take over a device push token that is still registered
-- to another account, through a SECURITY DEFINER RPC that pins the new owner to
-- auth.uid().
--
-- THE BUG THIS CLOSES
-- device_push_tokens.token is UNIQUE (00160): one row per device. Registration
-- was an upsert on that token through the user client, and the UPDATE policy is
--   USING (auth.uid() = user_id)
-- When the token already belonged to another account -- a rider who signed out
-- and signed up again, a shared or handed-down phone -- the conflicting row
-- failed that USING expression. PostgreSQL does not skip such a row in
-- INSERT ... ON CONFLICT DO UPDATE; it raises
--   42501 new row violates row-level security policy (USING expression)
-- The API assumed an empty result instead, so the "owned by another user"
-- branch never ran and every account switch on a device answered 500
-- (Sentry MOTO-VAULT-NODE-NESTJS-J, every occurrence since 2026-09-15).
--
-- Effect in production: the second account on a device never received a push,
-- and the first account's maintenance reminders (task titles included) kept
-- going to that device after it signed out.
--
-- WHY A TAKEOVER IS SAFE
-- A device has exactly one Expo push token and only ever shows one signed-in
-- account, so the token belongs to whoever registers it last. Claiming a token
-- can only redirect the CALLER's own notifications to that device and stop the
-- previous owner's; it reveals nothing about the previous owner. The token is
-- read on-device from Expo and is not exposed to other users by any API.
--
-- SHAPE
-- Same hardening as 00176: SET search_path = '', `auth.uid() IS NULL` refuses
-- everything (service_role included), and REVOKE names anon as well as PUBLIC
-- because this database's default privileges grant EXECUTE to anon explicitly.
-- The platform is validated by the table's existing CHECK constraint; the token
-- shape is validated in the function, because PostgREST exposes the RPC directly
-- and the API's Zod check is not on that path.
--
-- DEPLOY ORDER: apply this migration BEFORE the API that calls it. Render
-- deploys apps/api on merge to main; an API that calls a missing function makes
-- registerPushToken fail exactly as it fails today for the cross-account case,
-- but also for first-time registrations, so the window is a regression.

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_device_push_token(p_token text, p_platform text)
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

  -- The RPC is callable directly through PostgREST, so it enforces the same token
  -- shape the API's Zod schema does (EXPO_PUSH_TOKEN_REGEX, max 255): nothing that
  -- is not an Expo push token can be stored or used to take over a row.
  IF p_token IS NULL
     OR length(p_token) > 255
     OR p_token !~ '^Ex(ponent|po)PushToken\[[^]]+\]$' THEN
    RETURN false;
  END IF;

  INSERT INTO public.device_push_tokens (user_id, token, platform, last_seen_at)
  VALUES (v_uid, p_token, p_platform, NOW())
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = NOW();

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_device_push_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_device_push_token(text, text) TO authenticated;

COMMENT ON FUNCTION public.claim_device_push_token(text, text) IS
  'Registers a device push token to auth.uid(), taking it over from any previous owner. '
  'Returns false when there is no signed-in user or the token is not an Expo push token. '
  'See migration 00188.';

COMMIT;
