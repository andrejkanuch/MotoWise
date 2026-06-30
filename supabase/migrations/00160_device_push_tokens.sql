-- MOT-278: store per-user Expo push tokens so the server can send maintenance-due
-- push notifications. Owner-only RLS (a user reads/writes only their own tokens);
-- the maintenance-due send job reads across users via the service role, which
-- bypasses RLS. A device's token is unique; re-registration upserts on it.

CREATE TABLE public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Owner-only access. Writes go through the user client; the send job uses the
-- service role (RLS-exempt) with explicit user_id filters as defense-in-depth.
CREATE POLICY "Users read own push tokens" ON public.device_push_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own push tokens" ON public.device_push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own push tokens" ON public.device_push_tokens
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own push tokens" ON public.device_push_tokens
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_device_push_tokens_user_id ON public.device_push_tokens (user_id);

CREATE TRIGGER set_device_push_tokens_updated_at
  BEFORE UPDATE ON public.device_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.device_push_tokens IS 'Per-user Expo push tokens for server-sent notifications (MOT-278). Owner-only RLS; service-role reads for the send job.';
