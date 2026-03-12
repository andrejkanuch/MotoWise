-- RevenueCat Webhook Processing
-- Idempotency table, RLS fixes, and atomic processing function

-- 1. Idempotency table for webhook event deduplication
CREATE TABLE public.revenuecat_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  app_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup queries and GDPR deletion
CREATE INDEX idx_rc_events_app_user_id ON public.revenuecat_webhook_events (app_user_id);
CREATE INDEX idx_rc_events_processed_at ON public.revenuecat_webhook_events (processed_at);

-- Intentionally no policies: only service-role (SUPABASE_ADMIN) accesses this table.
-- RLS enabled to ensure authenticated/anon clients cannot read webhook event data.
ALTER TABLE public.revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;

-- 2. Fix: add NOT NULL to subscription_status (was missing from migration 00023)
UPDATE public.users SET subscription_status = 'free' WHERE subscription_status IS NULL;
ALTER TABLE public.users ALTER COLUMN subscription_status SET NOT NULL;

-- 3. Fix: re-protect trial_started_at in RLS (dropped in migration 00023 regression)
-- Policy "Users update own profile" from 00023 omitted trial_started_at — drop and recreate.
DROP POLICY IF EXISTS "Users update own profile" ON public.users;

CREATE POLICY "Users update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM public.users WHERE id = auth.uid())
    AND subscription_tier IS NOT DISTINCT FROM (SELECT subscription_tier FROM public.users WHERE id = auth.uid())
    AND subscription_expires_at IS NOT DISTINCT FROM (SELECT subscription_expires_at FROM public.users WHERE id = auth.uid())
    AND trial_started_at IS NOT DISTINCT FROM (SELECT trial_started_at FROM public.users WHERE id = auth.uid())
    AND revenuecat_id IS NOT DISTINCT FROM (SELECT revenuecat_id FROM public.users WHERE id = auth.uid())
    AND role IS NOT DISTINCT FROM (SELECT role FROM public.users WHERE id = auth.uid())
    AND email IS NOT DISTINCT FROM (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- 4. Atomic webhook processing function (SECURITY DEFINER = runs as owner, not caller)
CREATE OR REPLACE FUNCTION public.process_revenuecat_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_app_user_id UUID,
  p_expiration_at TIMESTAMPTZ DEFAULT NULL,
  p_period_type TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
BEGIN
  -- Step 1: Idempotency check — atomic INSERT OR SKIP
  INSERT INTO revenuecat_webhook_events (event_id, event_type, app_user_id)
  VALUES (p_event_id, p_event_type, p_app_user_id)
  ON CONFLICT (event_id) DO NOTHING;

  -- Check if we actually inserted (= new event)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'already_processed';
  END IF;

  -- Step 2: Derive tier and status from event type
  CASE p_event_type
    WHEN 'INITIAL_PURCHASE' THEN
      v_tier := 'pro';
      v_status := CASE WHEN p_period_type = 'TRIAL' THEN 'trialing' ELSE 'active' END;
    WHEN 'RENEWAL' THEN
      v_tier := 'pro';
      v_status := 'active';
    WHEN 'CANCELLATION' THEN
      v_tier := 'pro';
      v_status := 'cancelled';
    WHEN 'UNCANCELLATION' THEN
      v_tier := 'pro';
      v_status := 'active';
    WHEN 'EXPIRATION' THEN
      v_tier := 'free';
      v_status := 'expired';
    WHEN 'BILLING_ISSUE' THEN
      v_tier := 'pro';
      v_status := 'past_due';
    ELSE
      RETURN;
  END CASE;

  -- Step 3: Atomic user update
  UPDATE users SET
    subscription_tier = v_tier,
    subscription_status = v_status,
    subscription_expires_at = COALESCE(p_expiration_at, subscription_expires_at),
    revenuecat_id = p_app_user_id::TEXT
  WHERE id = p_app_user_id;
END;
$$;
