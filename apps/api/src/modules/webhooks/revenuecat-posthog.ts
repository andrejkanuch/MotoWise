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
 * The rider's decision as saved in each place, read separately because web
 * purchases weigh them differently. `account` is
 * `users.preferences.privacy.analyticsEnabled` (the in-app setting); `signup` is
 * `user_metadata.analytics_consent` (sent with sign-up, and kept in step with
 * the web cookie banner for signed-in visitors). NULL = nothing saved there.
 */
export interface StoredAnalyticsDecisions {
  account: AnalyticsDecision;
  signup: AnalyticsDecision;
}

/** Both places unreadable or refused: never identify. */
export const FAIL_CLOSED_DECISIONS: StoredAnalyticsDecisions = { account: false, signup: false };

/**
 * Countries where analytics needs prior opt-in: the EEA (EU-27 + Iceland,
 * Liechtenstein, Norway), the EU outermost regions that have their own codes
 * (RE, GP, MQ, GF, YT, MF, AX), the United Kingdom and Switzerland. ISO 3166-1
 * alpha-2. Mirrors `OPT_IN_REGIONS` in apps/mobile/src/lib/analytics-consent.ts
 * and `CONSENT_REQUIRED_COUNTRIES` in apps/web/src/proxy.ts — change all three
 * together. Everywhere else is opt-out.
 */
export const OPT_IN_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB',
  'CH',
  // EU outermost regions billed/geolocated under their own ISO codes (GDPR applies)
  'RE',
  'GP',
  'MQ',
  'GF',
  'YT',
  'MF',
  'AX',
] as const;

const OPT_IN_COUNTRY_SET: ReadonlySet<string> = new Set(OPT_IN_COUNTRIES);
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;

/**
 * The buyer's consent regime from RevenueCat's `country_code`: `opt_in` inside
 * the EEA/UK/CH, `opt_out` in any other known country, `unknown` when missing
 * or malformed.
 */
export function consentRegionForCountry(
  countryCode: string | null | undefined,
): 'opt_in' | 'opt_out' | 'unknown' {
  const code = countryCode?.trim().toUpperCase();
  if (!code || !COUNTRY_CODE_REGEX.test(code)) return 'unknown';
  return OPT_IN_COUNTRY_SET.has(code) ? 'opt_in' : 'opt_out';
}

/**
 * Whether this purchase may be sent identified.
 *
 * App-store purchases follow the signup sweep exactly: the account decision,
 * else the sign-up one (00184 order), with NULL = consent for now (apps before
 * 3.21.0 save no decision).
 *
 * Web Billing applies the owner's policy, the same as mobile: strict opt-in in
 * the EEA/UK/CH, opt-out elsewhere.
 * - A "no" in EITHER saved place wins, everywhere.
 * - An explicit yes (resolved in the 00184 order) identifies.
 * - With nothing saved, the buyer's RevenueCat `country_code` decides: a known
 *   country outside the EEA/UK/CH identifies (opt-out region); inside, or when
 *   the country is unknown, the purchase stays anonymous (fail closed).
 */
export function hasPurchaseAnalyticsConsent(
  event: RevenueCatEvent,
  decisions: StoredAnalyticsDecisions,
): boolean {
  const resolved = decisions.account ?? decisions.signup;
  if (purchaseSourceForStore(event.store) !== 'web') return hasAnalyticsConsent(resolved);

  if (decisions.account === false || decisions.signup === false) return false;
  if (resolved === true) return true;
  return consentRegionForCountry(event.country_code) === 'opt_out';
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
 * - `timestamp` is exact for consented riders. For a rider who declined it is
 *   cut to 00:00:00Z of the purchase day: an exact time plus product and price
 *   could be matched against RevenueCat data. The day keeps period buckets right.
 * - `revenue` is RevenueCat's USD `price`, only on types that take money.
 * - No email, name, or subscriber attributes: they are PII and are not needed.
 */
export function buildRevenueCatPostHogEvent(
  event: RevenueCatEvent,
  eventName: RcPostHogEventName,
  decisions: StoredAnalyticsDecisions,
): PostHogCaptureEvent {
  const consented = hasPurchaseAnalyticsConsent(event, decisions);
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
    timestamp: eventTimestamp(event.event_timestamp_ms, consented),
    uuid: consented && UUID_REGEX.test(event.id) ? event.id.toLowerCase() : undefined,
    properties,
  };
}

/**
 * ISO timestamp of the event: exact when consented, else the start of its UTC
 * day. Undefined (PostHog uses receipt time) when RevenueCat sent none.
 */
function eventTimestamp(ms: number | undefined, consented: boolean): string | undefined {
  if (!ms) return undefined;
  const iso = new Date(ms).toISOString();
  // toISOString is always UTC, so its date part is the UTC day.
  return consented ? iso : `${iso.slice(0, 10)}T00:00:00.000Z`;
}
