import { REVENUECAT_ENTITLEMENT_PRO, SubscriptionStatus, SubscriptionTier } from '@motovault/types';

/**
 * RevenueCat as the source of truth for Pro (issue #273).
 *
 * RevenueCat recommends "calling the GET /subscribers REST API endpoint after
 * receiving any webhook" instead of deriving state from the event type
 * (https://www.revenuecat.com/docs/integrations/webhooks). The users row stores
 * no product, so an event-type state machine cannot tell a late EXPIRATION of
 * an old monthly subscription from the end of the rider's only access — the
 * entitlement can: it stays active (no expiry) while a lifetime purchase backs
 * it, and RevenueCat removes it when that purchase is refunded.
 */

/** Subset of RC v1 `GET /subscribers/{id}` that the resolver reads. */
export interface RcSubscriberResponse {
  subscriber?: {
    entitlements?: Record<
      string,
      {
        expires_date?: string | null;
        grace_period_expires_date?: string | null;
        product_identifier?: string;
      }
    >;
    subscriptions?: Record<
      string,
      {
        period_type?: string;
        store?: string;
        is_sandbox?: boolean;
        unsubscribe_detected_at?: string | null;
        billing_issues_detected_at?: string | null;
        grace_period_expires_date?: string | null;
      }
    >;
    non_subscriptions?: Record<string, Array<{ is_sandbox?: boolean; store?: string }>>;
  };
}

/** The users-row state RevenueCat's entitlement implies (passed as p_rc_*). */
export interface ResolvedProState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  /** NULL with tier 'pro' = lifetime; NULL with tier 'free' = no entitlement left. */
  expiresAt: string | null;
  /** Product backing the entitlement, for the event log (TRANSFER carries none). */
  productId: string | null;
  periodType: string | null;
  store: string | null;
}

export type ProResolution =
  | { resolved: true; state: ResolvedProState }
  | { resolved: false; reason: string };

const RC_PERIOD_TRIAL = 'trial' as const;

const NO_ENTITLEMENT: ResolvedProState = {
  tier: SubscriptionTier.FREE,
  status: SubscriptionStatus.EXPIRED,
  expiresAt: null,
  productId: null,
  periodType: null,
  store: null,
};

const toMs = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Map the subscriber's "MotoWise Pro" entitlement to tier/status/expiry:
 *  - no entitlement (never bought, or a refunded lifetime purchase) → free/expired
 *  - expires_date null → lifetime → pro/active, NULL expiry
 *  - access (expiry or grace end) in the past (expired, refunded sub) → free/expired
 *  - otherwise pro, with past_due (billing issue, in grace) > cancelled
 *    (auto-renew off) > trialing > active, until the later of expiry and grace end.
 *
 * Unresolved (caller falls back to the event-type logic) when the response has
 * no subscriber, or when the entitlement is backed by a SANDBOX purchase and
 * the user is not on the sandbox allowlist — v1 mixes sandbox and production
 * purchases, and a free test purchase must never grant real Pro.
 */
export function resolveProEntitlement(
  body: RcSubscriberResponse,
  options: { nowMs: number; sandboxAllowed: boolean },
): ProResolution {
  const subscriber = body.subscriber;
  if (!subscriber) return { resolved: false, reason: 'response has no subscriber' };

  const entitlement = subscriber.entitlements?.[REVENUECAT_ENTITLEMENT_PRO];
  if (!entitlement) return { resolved: true, state: NO_ENTITLEMENT };

  const productId = entitlement.product_identifier ?? null;
  const subscription = productId ? subscriber.subscriptions?.[productId] : undefined;
  const purchases = productId ? subscriber.non_subscriptions?.[productId] : undefined;
  const latestPurchase = purchases?.[purchases.length - 1];
  const isSandbox = subscription?.is_sandbox ?? latestPurchase?.is_sandbox ?? false;
  if (isSandbox && !options.sandboxAllowed) {
    return { resolved: false, reason: `entitlement backed by sandbox product "${productId}"` };
  }

  const base = {
    productId,
    periodType: subscription?.period_type?.toUpperCase() ?? null,
    store: (subscription?.store ?? latestPurchase?.store)?.toUpperCase() ?? null,
  };

  const expiresMs = toMs(entitlement.expires_date);
  if (expiresMs === null) {
    if (entitlement.expires_date) {
      return { resolved: false, reason: `unparseable expires_date "${entitlement.expires_date}"` };
    }
    return {
      resolved: true,
      state: {
        ...base,
        tier: SubscriptionTier.PRO,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: null,
      },
    };
  }

  const graceMs = toMs(
    entitlement.grace_period_expires_date ?? subscription?.grace_period_expires_date,
  );
  const accessUntilMs = Math.max(expiresMs, graceMs ?? 0);
  const expiresAt = new Date(accessUntilMs).toISOString();

  if (accessUntilMs <= options.nowMs) {
    return {
      resolved: true,
      state: {
        ...base,
        tier: SubscriptionTier.FREE,
        status: SubscriptionStatus.EXPIRED,
        expiresAt,
      },
    };
  }

  const status = subscription?.billing_issues_detected_at
    ? SubscriptionStatus.PAST_DUE
    : subscription?.unsubscribe_detected_at
      ? SubscriptionStatus.CANCELLED
      : subscription?.period_type === RC_PERIOD_TRIAL
        ? SubscriptionStatus.TRIALING
        : SubscriptionStatus.ACTIVE;

  return { resolved: true, state: { ...base, tier: SubscriptionTier.PRO, status, expiresAt } };
}
