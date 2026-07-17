-- Grant lifetime Pro on non-renewing (lifetime) purchases.
--
-- RevenueCat sends NON_RENEWING_PURCHASE webhooks for non-subscription
-- products. The only such products in this project are the "MotoVault Pro"
-- lifetime SKUs (motovault_lifetime_v3/v4), and there is exactly one
-- entitlement (MotoVault Pro) that every product grants. Previously
-- process_revenuecat_event() had no case for NON_RENEWING_PURCHASE, so it hit
-- the ELSE RETURN and never granted anything — lifetime buyers stayed on the
-- free tier (the webhook service also mis-routed the event into the legacy
-- free-health-report path, which crashed on bike_id NOT NULL:
-- MOTO-VAULT-NODE-NESTJS-5).
--
-- A lifetime purchase never expires, so it maps to tier=pro, status=active,
-- expires_at=NULL. GqlAuthGuard.resolveEffectiveTier already treats a NULL
-- expiry as "no expiration (lifetime / comped grants)".
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
    -- Lifetime (non-consumable) purchase — permanent Pro, no expiry.
    -- Safe to grant unconditionally: the only non-subscription products are the
    -- lifetime Pro SKUs. If a consumable that does NOT grant Pro is ever added,
    -- gate this on the event's entitlement_ids before granting.
    WHEN 'NON_RENEWING_PURCHASE' THEN
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

  -- Step 3: Atomic user update.
  -- A lifetime purchase forces expiry to NULL (never expires); all other event
  -- types keep the prior expiry when the event carries none.
  UPDATE users SET
    subscription_tier = v_tier,
    subscription_status = v_status,
    subscription_expires_at = CASE
      WHEN p_event_type = 'NON_RENEWING_PURCHASE' THEN NULL
      ELSE COALESCE(p_expiration_at, subscription_expires_at)
    END,
    revenuecat_id = p_app_user_id::TEXT
  WHERE id = p_app_user_id;
END;
$$;

-- SECURITY DEFINER runs as owner; keep execution restricted to service_role.
REVOKE EXECUTE ON FUNCTION public.process_revenuecat_event FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_revenuecat_event TO service_role;
