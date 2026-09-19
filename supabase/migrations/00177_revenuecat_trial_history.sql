-- RevenueCat trial history + grace-period semantics (docs/RevenueCat-Trial-Audit-2026-09-19.md)
--
-- Why: one customer took three free trials (two Apple IDs + Google) with zero
-- revenue and we could not even see it. The webhook audit table stored only
-- event_id/type/user/time, `users.trial_started_at` (00021) was never written,
-- and the rows were CASCADE-deleted with the user, so purchase history vanished
-- on account deletion. Separately, BILLING_ISSUE was mapped to `past_due` and
-- CANCELLATION to `cancelled`, both of which GqlAuthGuard treats as "not Pro"
-- immediately — but the store keeps the entitlement alive until the (grace)
-- expiry, so the client said Pro while the API said free.
--
-- 1. revenuecat_webhook_events: persist what the event said (period_type,
--    product, store, environment, trial conversion, purchase/expiry/grace dates,
--    redacted payload). Drop the FK cascade so purchase history survives account
--    deletion: rows keep a pseudonymous uuid + purchase facts only — the service
--    strips `subscriber_attributes` ($ip/$idfa/$email…) before storing.
-- 2. process_revenuecat_event: same event → tier/status mapping, plus
--    - INITIAL_PURCHASE with period_type TRIAL sets trial_started_at once,
--    - BILLING_ISSUE keeps Pro until grace_period_expiration_at (falls back to
--      expiration_at), which is when the store actually revokes access,
--    - TRANSFER downgrades every `transferred_from` user (they lost the
--      subscription) and, when the service resolved the receiver's state from
--      RC, upgrades the receiver. Previously TRANSFER hit the ELSE branch and
--      the losing account stayed Pro forever.
--    The old 5-argument signature is dropped first: PostgREST resolves RPCs by
--    argument names, and two overloads that both accept the 5 original names
--    would make the call ambiguous.

ALTER TABLE public.revenuecat_webhook_events
  ADD COLUMN IF NOT EXISTS period_type TEXT,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS store TEXT,
  ADD COLUMN IF NOT EXISTS environment TEXT,
  ADD COLUMN IF NOT EXISTS is_trial_conversion BOOLEAN,
  ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiration_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_period_expiration_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE public.revenuecat_webhook_events
  DROP CONSTRAINT IF EXISTS revenuecat_webhook_events_app_user_id_fkey;

COMMENT ON TABLE public.revenuecat_webhook_events IS
  'Every RevenueCat webhook delivery (idempotency key = event_id). Intentionally NOT cascaded from users: purchase/trial history must outlive account deletion so a re-signup cannot look brand new. payload is redacted (no subscriber_attributes).';

CREATE INDEX IF NOT EXISTS idx_rc_events_user_type
  ON public.revenuecat_webhook_events (app_user_id, event_type);

DROP FUNCTION IF EXISTS public.process_revenuecat_event(TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT);

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
    -- Lifetime (non-consumable) purchase — permanent Pro, no expiry (00165).
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

  -- Step 3: atomic user update. A lifetime purchase forces expiry to NULL, a
  -- resolved TRANSFER writes exactly what RC reported (NULL = lifetime), all
  -- other events keep the prior expiry when the event carries none.
  UPDATE users SET
    subscription_tier = v_tier,
    subscription_status = v_status,
    subscription_expires_at = CASE
      WHEN p_event_type = 'NON_RENEWING_PURCHASE' THEN NULL
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

-- SECURITY DEFINER runs as owner; keep execution restricted to service_role.
-- anon must be named: this database carries a default EXECUTE grant to anon
-- on every new function (see 00176).
REVOKE EXECUTE ON FUNCTION public.process_revenuecat_event(
  TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_revenuecat_event(
  TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], JSONB
) TO service_role;

-- No SQL backfill: period_type was never stored, so trial history for existing
-- users is backfilled from RevenueCat's per-customer event history (source of
-- truth) by a one-off script, not guessed from event timing.
