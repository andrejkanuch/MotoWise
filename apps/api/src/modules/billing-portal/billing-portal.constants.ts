import { registerEnumType } from '@nestjs/graphql';

export const STRIPE_API_BASE = 'https://api.stripe.com/v1';

/**
 * RevenueCat's Stripe app writes the RevenueCat customer id (= our Supabase user
 * id, the web SDK's appUserId) into this metadata key on every Stripe
 * subscription it creates. It is how we find the rider's Stripe customer.
 */
export const RC_CUSTOMER_ID_METADATA_KEY = 'rc_customer_id';

/** Where the portal sends the rider back to. */
export const BILLING_PORTAL_RETURN_PATH = '/profile';
export const DEFAULT_WEB_APP_URL = 'https://motovault.app';

/** Stripe search returns newest-first is NOT guaranteed, so we sort; this bounds the page. */
export const STRIPE_SEARCH_LIMIT = 10;

/** Keys equal values so the wire format stays lowercase (repo convention). */
export const BillingPortalStatusEnum = {
  ok: 'ok',
  /** STRIPE_BILLING_PORTAL_KEY is not set on this deploy — feature off. */
  not_configured: 'not_configured',
  /** No Stripe customer for this user: they never bought on the web. */
  no_customer: 'no_customer',
  /** Stripe rejected or failed the request. */
  unavailable: 'unavailable',
} as const;

export type BillingPortalStatus =
  (typeof BillingPortalStatusEnum)[keyof typeof BillingPortalStatusEnum];

registerEnumType(BillingPortalStatusEnum, {
  name: 'BillingPortalStatus',
  description: 'Outcome of creating a Stripe billing portal session for a web subscriber.',
});
