-- NON_RENEWING_PURCHASE is not always lifetime Pro.
--
-- RevenueCat sends NON_RENEWING_PURCHASE for every non-subscription product:
-- the lifetime SKUs, but also consumables and any time-limited product (e.g. a
-- season pass whose entitlement has a duration). 00165/00177 forced
-- subscription_expires_at to NULL for every such event, so any non-lifetime
-- non-renewing product would silently have granted Pro forever.
--
-- The API now decides (apps/api/src/modules/webhooks/revenuecat-products.ts):
--   - known lifetime SKU            → p_expiration_at = NULL (lifetime, unchanged),
--   - other product with an expiry  → p_expiration_at = that expiry,
--   - other product, no expiry      → RPC not called, nothing granted.
-- This function now honours the expiry it is given instead of discarding it,
-- and a time-limited grant never shortens Pro the user already holds.
--
-- Deploy order is free: the pre-change API already passed NULL for lifetime
-- purchases (RC sends no expiration_at_ms for a non-consumable), and until this
-- is applied a time-limited product would still be stored as lifetime — so
-- apply this BEFORE any time-limited non-renewing product goes on sale.
--
-- Same signature as 00177; CREATE OR REPLACE keeps its ACL (service_role
-- only), and the REVOKE/GRANT below restate it.
-- 00180-00182 are reserved by an unmerged branch.

CREATE OR REPLACE FUNCTION public.process_revenuecat_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_app_user_id UUID,
  p_expiration_at TIMESTAMPTZ DEFAULT NULL,
  p_period_type TEXT DEFAULT NULL,
  p_product_id TEXT DEFAULT NULL,
  p_store TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT NULL,
  p_is_trial_conversion BOOLEAN DEFAULT NULL,
  p_purchased_at TIMESTAMPTZ DEFAULT NULL,
  p_grace_period_expiration_at TIMESTAMPTZ DEFAULT NULL,
  p_transferred_from UUID[] DEFAULT NULL,
  p_payload JSONB DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
  v_expiration TIMESTAMPTZ := p_expiration_at;
  v_is_trial_start BOOLEAN := FALSE;
BEGIN
  -- Step 1: idempotency — atomic INSERT OR SKIP, logs every event type.
  INSERT INTO revenuecat_webhook_events (
    event_id, event_type, app_user_id, period_type, product_id, store, environment,
    is_trial_conversion, purchased_at, expiration_at, grace_period_expiration_at, payload
  )
  VALUES (
    p_event_id, p_event_type, p_app_user_id, p_period_type, p_product_id, p_store, p_environment,
    p_is_trial_conversion, p_purchased_at, p_expiration_at, p_grace_period_expiration_at, p_payload
  )
  ON CONFLICT (event_id) DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'already_processed';
  END IF;

  -- Step 2: derive tier and status from event type.
  CASE p_event_type
    WHEN 'INITIAL_PURCHASE' THEN
      v_tier := 'pro';
      v_status := CASE WHEN p_period_type = 'TRIAL' THEN 'trialing' ELSE 'active' END;
      v_is_trial_start := (p_period_type = 'TRIAL');
    WHEN 'RENEWAL' THEN
      v_tier := 'pro';
      v_status := 'active';
    -- Non-subscription purchase. The service passes a NULL expiry ONLY for a
    -- known lifetime SKU (lifetime Pro, 00165) and the product's expiry for a
    -- time-limited one; anything else never reaches this function (00185).
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
      -- The store keeps access alive through the grace period; Apple (16 days,
      -- all renewals since 2026-09-19) and Google (7/14 days) both send the
      -- grace end here. Without a grace period this is null and the EXPIRATION
      -- that follows in the same second downgrades the user.
      v_tier := 'pro';
      v_status := 'past_due';
      v_expiration := COALESCE(p_grace_period_expiration_at, p_expiration_at);
    WHEN 'TRANSFER' THEN
      -- Sent only for the destination user; the sources lost everything.
      IF p_transferred_from IS NOT NULL THEN
        UPDATE users SET
          subscription_tier = 'free',
          subscription_status = 'expired',
          subscription_expires_at = now()
        WHERE id = ANY (p_transferred_from)
          AND id <> p_app_user_id
          AND subscription_tier = 'pro';
      END IF;
      -- The event carries no product/expiry; the service resolves the
      -- receiver's live state from RC and passes it in (product_id set; a NULL
      -- expiry then means lifetime). Nothing resolved → leave the receiver
      -- untouched (the next RENEWAL will sync them).
      IF p_product_id IS NULL THEN
        RETURN;
      END IF;
      v_tier := 'pro';
      v_status := CASE WHEN p_period_type = 'TRIAL' THEN 'trialing' ELSE 'active' END;
    ELSE
      RETURN;
  END CASE;

  -- Step 3: atomic user update. A lifetime purchase (NULL expiry) writes NULL;
  -- a time-limited one never shortens Pro the user already holds (lifetime or a
  -- later-expiring subscription); a resolved TRANSFER writes exactly what RC
  -- reported (NULL = lifetime); all other events keep the prior expiry when the
  -- event carries none.
  UPDATE users SET
    subscription_tier = v_tier,
    subscription_status = v_status,
    subscription_expires_at = CASE
      WHEN p_event_type = 'NON_RENEWING_PURCHASE' AND v_expiration IS NULL THEN NULL
      WHEN p_event_type = 'NON_RENEWING_PURCHASE'
        AND subscription_tier = 'pro'
        AND subscription_status NOT IN ('free', 'expired')
        AND (subscription_expires_at IS NULL OR subscription_expires_at > v_expiration)
        THEN subscription_expires_at
      WHEN p_event_type = 'NON_RENEWING_PURCHASE' THEN v_expiration
      WHEN p_event_type = 'TRANSFER' THEN v_expiration
      ELSE COALESCE(v_expiration, subscription_expires_at)
    END,
    -- First trial ever, on any store. Never overwritten: this is the
    -- "has this person already had a free trial" fact the paywall needs.
    trial_started_at = CASE
      WHEN v_is_trial_start THEN COALESCE(trial_started_at, p_purchased_at, now())
      ELSE trial_started_at
    END,
    revenuecat_id = p_app_user_id::TEXT
  WHERE id = p_app_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_revenuecat_event(
  TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_revenuecat_event(
  TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], JSONB
) TO service_role;
