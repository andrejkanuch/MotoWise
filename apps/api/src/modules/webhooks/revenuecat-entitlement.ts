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
        expires_date?: string | null;
        refunded_at?: string | null;
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

/**
 * Why a lookup could not be resolved, when the caller must report it with its
 * own Sentry tag. Absent = a generic unresolved lookup (`rc_entitlement: fallback`).
 */
export const RESOLUTION_FAILURE = {
  /**
   * The subscriber holds purchases (other entitlements, or a live
   * subscription) but no "MotoWise Pro" entitlement: the entitlement was most
   * likely renamed or detached in the RevenueCat dashboard. Writing "no
   * entitlement" would downgrade every paying rider, so it is reported and
   * handled as a permanent failure instead.
   */
  MISSING_ENTITLEMENT: 'missing_entitlement',
} as const;
export type ResolutionFailure = (typeof RESOLUTION_FAILURE)[keyof typeof RESOLUTION_FAILURE];

export type ProResolution =
  | { resolved: true; state: ResolvedProState }
  | {
      resolved: false;
      reason: string;
      failure?: ResolutionFailure;
      /** Product ids the subscriber holds (no PII), for the missing-entitlement report. */
      productIds?: string[];
    };

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

type RcSubscriber = NonNullable<RcSubscriberResponse['subscriber']>;

/**
 * Subscriptions that still grant access: not refunded and not expired (a NULL
 * expiry never expires). Non-subscriptions are deliberately NOT counted: v1
 * carries no refund marker on them, so a refunded lifetime purchase may still
 * be listed after RevenueCat removed the entitlement — counting it would turn
 * every lifetime refund into a missing-entitlement fallback that keeps Pro.
 */
function liveSubscriptionIds(subscriber: RcSubscriber, nowMs: number): string[] {
  return Object.entries(subscriber.subscriptions ?? {})
    .filter(([, sub]) => {
      if (sub.refunded_at) return false;
      const expiresMs = toMs(sub.expires_date);
      return expiresMs === null || expiresMs > nowMs;
    })
    .map(([productId]) => productId);
}

/**
 * The Pro entitlement is absent although the subscriber clearly paid for
 * something: other entitlements exist, or a subscription is still live.
 * Null when "no entitlement" is a genuine answer (never bought, or refunded).
 */
function missingEntitlement(subscriber: RcSubscriber, nowMs: number): ProResolution | null {
  // Only entitlements that still grant access: v1 also lists expired ones, and
  // a long-gone second entitlement must not turn a lifetime refund into a
  // fallback that keeps Pro.
  const otherEntitlements = Object.entries(subscriber.entitlements ?? {})
    .filter(([, e]) => {
      const expiresMs = toMs(e.expires_date);
      return expiresMs === null || expiresMs > nowMs;
    })
    .map(([id]) => id);
  const liveSubscriptions = liveSubscriptionIds(subscriber, nowMs);
  if (otherEntitlements.length === 0 && liveSubscriptions.length === 0) return null;
  const productIds = [
    ...new Set([
      ...otherEntitlements
        .map((id) => subscriber.entitlements?.[id]?.product_identifier)
        .filter((id): id is string => Boolean(id)),
      ...liveSubscriptions,
      ...Object.keys(subscriber.non_subscriptions ?? {}),
    ]),
  ];
  return {
    resolved: false,
    failure: RESOLUTION_FAILURE.MISSING_ENTITLEMENT,
    reason: `no "${REVENUECAT_ENTITLEMENT_PRO}" entitlement although the subscriber has ${
      otherEntitlements.length > 0
        ? `entitlements [${otherEntitlements.join(', ')}]`
        : 'a live subscription'
    }`,
    productIds,
  };
}

/**
 * Map the subscriber's "MotoWise Pro" entitlement to tier/status/expiry:
 *  - no entitlement (never bought, or a refunded lifetime purchase) → free/expired
 *    (00187 keeps a never-Pro free/free row as free/free)
 *  - no Pro entitlement while other entitlements or a live subscription exist
 *    → unresolved, RESOLUTION_FAILURE.MISSING_ENTITLEMENT (renamed entitlement)
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
  if (!entitlement) {
    return (
      missingEntitlement(subscriber, options.nowMs) ?? { resolved: true, state: NO_ENTITLEMENT }
    );
  }

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
