-- Migration: 00190_feedback_messages
-- "Write to the developer".
--
-- A row is one message a rider sent from the in-app feedback form. The API
-- (feedback.service sendFeedback) INSERTS it through the USER client, then
-- emails the support inbox after the response, then records the outcome
-- (emailed_at or email_error) through the ADMIN client. A message whose email
-- failed is never lost: it stays here with emailed_at NULL.
--
-- IDEMPOTENT SENDS: the app generates client_id per draft and reuses it across
-- retries. UNIQUE (user_id, client_id) turns a retried insert into a 23505,
-- which the API treats as success and does not email again.
--
-- CONTEXT: platform, app_version, update_id and locale come from the app (it
-- sends no version headers); motorcycle_id is the rider's most recently updated
-- live bike, read by the API with the user client. contact_allowed and
-- contact_email record the contact opt-in AS SENT with this message
-- (contact_email is the effective address the developer may reply to, so it is
-- only set when contact_allowed).
--
-- WRITES: INSERT only, column-granted. emailed_at and email_error are NOT
-- granted to authenticated, so a rider can never mark their own message as
-- emailed; only service_role writes them. No SELECT/UPDATE/DELETE for riders:
-- the insert uses return=minimal (no .select()), and the GDPR data export reads
-- with the admin client.
--
-- ACCOUNT DELETION: user_id cascades from auth.users, so
-- hard_delete_expired_accounts() covers this table with no change. Deleting a
-- bike row keeps the message and clears motorcycle_id.
--
-- DEPLOY ORDER: apply BEFORE the API that exposes sendFeedback.
--
-- Unemailed messages:
--   select id, created_at, email_error from public.feedback_messages
--   where emailed_at is null order by created_at desc;

BEGIN;

CREATE TABLE public.feedback_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  -- char_length counts characters (code points); the API's Zod check counts the
  -- same way. The API trims, so a stored message is never blank.
  message text NOT NULL
    CHECK (char_length(message) <= 4000 AND char_length(btrim(message)) >= 1),
  quick_pick text CHECK (quick_pick IN ('love', 'wish', 'broken')),
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  app_version text NOT NULL CHECK (char_length(app_version) BETWEEN 1 AND 32),
  update_id text CHECK (char_length(update_id) BETWEEN 1 AND 64),
  locale text NOT NULL CHECK (char_length(locale) BETWEEN 2 AND 35),
  motorcycle_id uuid REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  contact_allowed boolean NOT NULL DEFAULT false,
  -- Becomes a Reply-To header: no CR/LF, RFC 5321 length.
  contact_email text
    CHECK (
      char_length(contact_email) <= 254
      AND position(E'\r' IN contact_email) = 0
      AND position(E'\n' IN contact_email) = 0
    ),
  emailed_at timestamptz,
  email_error text CHECK (char_length(email_error) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_messages_user_client_key UNIQUE (user_id, client_id),
  CONSTRAINT feedback_messages_contact_email_needs_consent
    CHECK (contact_email IS NULL OR contact_allowed)
);

COMMENT ON TABLE public.feedback_messages IS
  'Messages riders sent from the in-app "Write to the developer" form. Inserted by the rider (user client); emailed_at/email_error written by service_role after the support-inbox email.';
COMMENT ON COLUMN public.feedback_messages.client_id IS
  'Client-generated UUID per draft, reused across retries. UNIQUE with user_id so a retried send is a no-op.';
COMMENT ON COLUMN public.feedback_messages.contact_email IS
  'Effective address the developer may reply to, set only when contact_allowed.';
COMMENT ON COLUMN public.feedback_messages.emailed_at IS
  'When the support-inbox email was accepted by Resend. NULL = not emailed (see email_error).';

ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

-- A bike, when attached, must be the caller's own live bike: user_id alone would
-- let a caller attach a message to any motorcycle id they can guess.
CREATE POLICY "Users send own feedback" ON public.feedback_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      motorcycle_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.motorcycles m
        WHERE m.id = motorcycle_id
          AND m.user_id = (SELECT auth.uid())
          AND m.deleted_at IS NULL
      )
    )
  );

-- Supabase's default privileges grant ALL on new tables to anon and
-- authenticated. Clear them and grant back only the columns the rider supplies.
-- service_role keeps its default grant (it writes emailed_at / email_error and
-- reads rows for the data export).
REVOKE ALL ON TABLE public.feedback_messages FROM PUBLIC, anon, authenticated;
GRANT INSERT (
  user_id,
  client_id,
  message,
  quick_pick,
  platform,
  app_version,
  update_id,
  locale,
  motorcycle_id,
  contact_allowed,
  contact_email
) ON TABLE public.feedback_messages TO authenticated;

COMMIT;
