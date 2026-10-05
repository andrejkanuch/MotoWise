import {
  type AnalyticsDecision,
  hasAnalyticsConsent,
  NO_CONSENT_PROPERTIES,
} from '../analytics/analytics-consent';
import { type PostHogCaptureEvent, SERVER_EVENT_PROPERTIES } from '../analytics/posthog-capture';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';

/**
 * RevenueCat webhook type → PostHog event name.
 *
 * The first five are the names RevenueCat's own PostHog integration was
 * configured to send between 2026-04-28 and 2026-06-26, so old and new data line
 * up in one series. The rest follow the same `rc_<type>` shape. Types not listed
 * (TRANSFER, EXPERIMENT_ENROLLMENT, SUBSCRIPTION_PAUSED, …) are not sent.
 */
export const RC_POSTHOG_EVENT_NAMES = {
  INITIAL_PURCHASE: 'rc_initial_purchase',
  RENEWAL: 'rc_renewal',
  CANCELLATION: 'rc_cancellation',
  EXPIRATION: 'rc_expiration',
  BILLING_ISSUE: 'rc_billing_issue',
  UNCANCELLATION: 'rc_uncancellation',
  PRODUCT_CHANGE: 'rc_product_change',
  NON_RENEWING_PURCHASE: 'rc_non_renewing_purchase',
} as const;

type RcPostHogEventType = keyof typeof RC_POSTHOG_EVENT_NAMES;
export type RcPostHogEventName = (typeof RC_POSTHOG_EVENT_NAMES)[RcPostHogEventType];

/** Only live purchases are sent; sandbox (TestFlight, test cards) never is. */
export const RC_ENVIRONMENT_PRODUCTION = 'PRODUCTION' as const;

/**
 * Single constant bucket for riders who declined analytics. Not an identifier:
 * it is the same string for everyone, so it aggregates to a count only.
 */
export const RC_NO_CONSENT_DISTINCT_ID = 'revenuecat-no-consent';

const PERIOD_TRIAL = 'TRIAL' as const;

/** Types whose `price` is money taken now, so it is reported as `revenue`. */
const REVENUE_EVENT_TYPES: ReadonlySet<string> = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'NON_RENEWING_PURCHASE',
]);

/** A Supabase user id / RevenueCat event id. */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PurchaseSource = 'ios' | 'android' | 'web' | 'unknown';

const PURCHASE_SOURCE_BY_STORE: Record<string, PurchaseSource> = {
  APP_STORE: 'ios',
  PLAY_STORE: 'android',
  // RevenueCat Web Billing (web checkout) reports as either.
  STRIPE: 'web',
  RC_BILLING: 'web',
};

/** Map a RevenueCat store identifier to the platform the rider paid on. */
export function purchaseSourceForStore(store: string | undefined): PurchaseSource {
  return (store && PURCHASE_SOURCE_BY_STORE[store.toUpperCase()]) || 'unknown';
}

/** A trial starting: no money taken yet. */
export function isTrialStart(event: RevenueCatEvent): boolean {
  return event.type === 'INITIAL_PURCHASE' && event.period_type === PERIOD_TRIAL;
}

/**
 * The first paid conversion ONLY — a direct purchase, a lifetime (non-renewing)
 * purchase, or the single RENEWAL that converts a trial. Plain renewals are not
 * conversions, or every billing cycle counts as a new subscriber.
 */
export function isPaidConversion(event: RevenueCatEvent): boolean {
  return (
    (event.type === 'INITIAL_PURCHASE' && event.period_type !== PERIOD_TRIAL) ||
    event.type === 'NON_RENEWING_PURCHASE' ||
    (event.type === 'RENEWAL' && event.is_trial_conversion === true)
  );
}

/**
 * Whether this purchase may be sent identified.
 *
 * Mobile stores follow the shared rule (NULL = consent for now: apps before
 * 3.21.0 save no decision). Web Billing does NOT: the web never saved a decision
 * before this change, so NULL there is a visitor who may well have declined the
 * cookie banner. Only an explicit TRUE identifies a web purchase.
 */
export function hasPurchaseAnalyticsConsent(
  event: RevenueCatEvent,
  decision: AnalyticsDecision,
): boolean {
  return purchaseSourceForStore(event.store) === 'web'
    ? decision === true
    : hasAnalyticsConsent(decision);
}

/** The PostHog event name for a webhook type, or null when it is not sent. */
export function revenueCatPostHogEventName(type: string): RcPostHogEventName | null {
  return Object.hasOwn(RC_POSTHOG_EVENT_NAMES, type)
    ? RC_POSTHOG_EVENT_NAMES[type as RcPostHogEventType]
    : null;
}

/**
 * Build the PostHog event for one webhook delivery.
 *
 * - `distinct_id` is the Supabase user id (= RevenueCat app user id, the same id
 *   the apps `identify()` with) when the rider consented, else the constant
 *   bucket with person processing off — the signup sweep's rule, stricter for
 *   web purchases (see `hasPurchaseAnalyticsConsent`).
 * - `uuid` and `rc_event_id` are the RevenueCat event id, so a re-sent copy
 *   collapses in PostHog — consented riders only: for a rider who declined the
 *   id would join the anonymous event back to their account outside PostHog.
 * - `revenue` is RevenueCat's USD `price`, only on types that take money.
 * - No email, name, or subscriber attributes: they are PII and are not needed.
 */
export function buildRevenueCatPostHogEvent(
  event: RevenueCatEvent,
  eventName: RcPostHogEventName,
  decision: AnalyticsDecision,
): PostHogCaptureEvent {
  const consented = hasPurchaseAnalyticsConsent(event, decision);
  const takesMoney = REVENUE_EVENT_TYPES.has(event.type) && typeof event.price === 'number';
  const properties: Record<string, unknown> = {
    rc_event_id: consented ? event.id : undefined,
    rc_event_type: event.type,
    product_id: event.product_id,
    new_product_id: event.new_product_id,
    store: event.store,
    purchase_source: purchaseSourceForStore(event.store),
    environment: event.environment,
    period_type: event.period_type,
    is_trial: event.period_type === PERIOD_TRIAL,
    is_trial_conversion: event.is_trial_conversion ?? false,
    is_paid_conversion: isPaidConversion(event),
    price_usd: event.price ?? undefined,
    price_in_purchased_currency: event.price_in_purchased_currency ?? undefined,
    purchased_currency: event.currency ?? undefined,
    presented_offering_id: event.presented_offering_id ?? undefined,
    renewal_number: event.renewal_number ?? undefined,
    cancel_reason: event.cancel_reason,
    expiration_reason: event.expiration_reason,
    emitted_by: 'revenuecat_webhook',
    ...SERVER_EVENT_PROPERTIES,
  };
  if (takesMoney) {
    properties.revenue = event.price;
    properties.currency = 'USD';
  }
  if (!consented) Object.assign(properties, NO_CONSENT_PROPERTIES);

  return {
    event: eventName,
    distinct_id: consented ? event.app_user_id : RC_NO_CONSENT_DISTINCT_ID,
    timestamp: event.event_timestamp_ms
      ? new Date(event.event_timestamp_ms).toISOString()
      : undefined,
    uuid: consented && UUID_REGEX.test(event.id) ? event.id.toLowerCase() : undefined,
    properties,
  };
}
