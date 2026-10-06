-- RevenueCat is the source of truth for Pro (issue #273).
--
-- Before: the users row was derived from the event TYPE alone. users stores no
-- product id, so a late CANCELLATION/EXPIRATION of an old monthly subscription
-- downgraded a rider who had since bought Lifetime, and nothing defined what a
-- lifetime refund does.
--
-- Now (RevenueCat's own recommendation: "call the GET /subscribers REST API
-- endpoint after receiving any webhook"): the API fetches the subscriber's
-- live "MotoWise Pro" entitlement on every event and passes the resulting state
-- in three new parameters. When p_rc_tier is set, the row is written from them
-- and the event type no longer decides tier/status/expiry:
--   lifetime + old sub CANCELLATION/EXPIRATION → entitlement still active, no
--     expiry → stays pro/active, NULL expiry;
--   lifetime refund → RC removes the entitlement → free/expired;
--   subscription refund → RC expires the entitlement at the refund → free/expired.
-- When p_rc_tier is NULL (RevenueCat unreachable, or a pre-00187 API) the
-- 00185 event-type logic below runs unchanged — that is the fallback.
--
-- Unchanged in both paths: the event log insert + idempotency (already_processed),
-- trial_started_at (first trial ever), revenuecat_id, and the TRANSFER source
-- downgrade.
--
-- Signature: the new parameters are appended with DEFAULT NULL, so the
-- pre-00187 API (13 named arguments) keeps working against this function. The
-- 13-argument version is DROPPED first: leaving both would make PostgREST's
-- named-argument resolution ambiguous (PGRST203) for every legacy call.
--
-- Deploy order: apply this migration, then deploy the API. (The new API also
-- retries without the new parameters if the RPC does not exist yet — PGRST202 —
-- and reports that to Sentry, so the reverse order degrades to the old
-- behaviour instead of failing webhooks.)
-- The DROP and CREATE must land together: the Supabase CLI applies each
-- migration file in one transaction (as 00177 relied on for the same function).
-- 00180-00182 are reserved by an unmerged branch.

DROP FUNCTION IF EXISTS public.process_revenuecat_event(
  TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], JSONB
);

CREATE FUNCTION public.process_revenuecat_event(
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
  p_payload JSONB DEFAULT NULL,
  -- RevenueCat's live entitlement state, resolved by the API. p_rc_tier NULL =
  -- not resolved (fallback to the event type). A NULL p_rc_expires_at with
  -- tier 'pro' means lifetime.
  p_rc_tier TEXT DEFAULT NULL,
  p_rc_status TEXT DEFAULT NULL,
  p_rc_expires_at TIMESTAMPTZ DEFAULT NULL
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
  v_resolved BOOLEAN := p_rc_tier IS NOT NULL;
BEGIN
  IF v_resolved AND (p_rc_tier NOT IN ('free', 'pro') OR p_rc_status IS NULL) THEN
    RAISE EXCEPTION 'invalid resolved state: tier=% status=%', p_rc_tier, p_rc_status;
  END IF;

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

  -- TRANSFER is sent only for the destination user; the sources lost
  -- everything. Independent of how the receiver is resolved.
  IF p_event_type = 'TRANSFER' AND p_transferred_from IS NOT NULL THEN
    UPDATE users SET
      subscription_tier = 'free',
      subscription_status = 'expired',
      subscription_expires_at = now()
    WHERE id = ANY (p_transferred_from)
      AND id <> p_app_user_id
      AND subscription_tier = 'pro';
  END IF;

  IF v_resolved THEN
    -- Step 2a: RevenueCat's entitlement decides, for every event type.
    v_tier := p_rc_tier;
    v_status := p_rc_status;
    v_expiration := p_rc_expires_at;
    v_is_trial_start := (p_event_type = 'INITIAL_PURCHASE' AND p_period_type = 'TRIAL');
  ELSE
    -- Step 2b (fallback, = 00185): derive tier and status from event type.
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
        -- A cancelled subscription keeps Pro until its expiry. When that expiry
        -- has already passed the access is gone, so record it as expired.
        IF v_expiration IS NOT NULL AND v_expiration <= now() THEN
          v_tier := 'free';
          v_status := 'expired';
        ELSE
          v_tier := 'pro';
          v_status := 'cancelled';
        END IF;
      WHEN 'UNCANCELLATION' THEN
        v_tier := 'pro';
        v_status := 'active';
      WHEN 'EXPIRATION' THEN
        v_tier := 'free';
        v_status := 'expired';
      WHEN 'BILLING_ISSUE' THEN
        -- The store keeps access alive through the grace period.
        v_tier := 'pro';
        v_status := 'past_due';
        v_expiration := COALESCE(p_grace_period_expiration_at, p_expiration_at);
      WHEN 'TRANSFER' THEN
        -- The event carries no product/expiry; without a resolved state the
        -- receiver is left untouched (the next event will sync them).
        IF p_product_id IS NULL THEN
          RETURN;
        END IF;
        v_tier := 'pro';
        v_status := CASE WHEN p_period_type = 'TRIAL' THEN 'trialing' ELSE 'active' END;
      ELSE
        RETURN;
    END CASE;
  END IF;

  -- Step 3: atomic user update.
  UPDATE users SET
    subscription_tier = v_tier,
    subscription_status = v_status,
    subscription_expires_at = CASE
      -- Resolved: exactly what RevenueCat reports (NULL on pro = lifetime). A
      -- free row with no reported expiry (entitlement gone, e.g. a lifetime
      -- refund) keeps its last expiry for the record.
      WHEN v_resolved AND v_tier = 'pro' THEN v_expiration
      WHEN v_resolved THEN COALESCE(v_expiration, subscription_expires_at)
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
    -- First trial ever, on any store. Never overwritten.
    trial_started_at = CASE
      WHEN v_is_trial_start THEN COALESCE(trial_started_at, p_purchased_at, now())
      ELSE trial_started_at
    END,
    revenuecat_id = p_app_user_id::TEXT
  WHERE id = p_app_user_id
    -- Fallback only: a CANCELLATION processed after its EXPIRATION must not
    -- pull the row back out of 'expired'. A resolved state is RevenueCat's
    -- current answer and is written as-is.
    AND NOT (
      NOT v_resolved AND p_event_type = 'CANCELLATION' AND subscription_status = 'expired'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_revenuecat_event(
  TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], JSONB,
  TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_revenuecat_event(
  TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], JSONB,
  TEXT, TEXT, TIMESTAMPTZ
) TO service_role;
