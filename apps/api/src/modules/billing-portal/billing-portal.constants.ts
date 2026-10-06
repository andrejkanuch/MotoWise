import { registerEnumType } from '@nestjs/graphql';

export const STRIPE_API_BASE = 'https://api.stripe.com/v1';
export const REVENUECAT_API_V2_BASE = 'https://api.revenuecat.com/v2';

/**
 * RevenueCat writes the RevenueCat customer id (= our Supabase user id, the web
 * SDK's appUserId) into this metadata key on the Stripe *subscriptions* it
 * creates, server-side. Only subscription metadata is trusted: metadata on the
 * Stripe *customer* can be set from the browser through purchases-js checkout
 * metadata, so a customer search on this key is spoofable and is never used.
 */
export const RC_CUSTOMER_ID_METADATA_KEY = 'rc_customer_id';

/** The RevenueCat v2 `store` value for subscriptions sold through the Stripe app. */
export const RC_STORE_STRIPE = 'stripe';

/** RevenueCat v2 `environment` values, matched to the Stripe key's mode. */
export const RC_ENVIRONMENT = {
  production: 'production',
  sandbox: 'sandbox',
} as const;

/** Stripe test-mode keys carry this marker (sk_test_…, rk_test_…). */
export const STRIPE_TEST_KEY_MARKER = '_test_';

/** A Stripe subscription id; anything else never reaches a Stripe URL path. */
export const STRIPE_SUBSCRIPTION_ID_RX = /^sub_[A-Za-z0-9]+$/;

/** Where the portal sends the rider back to. */
export const BILLING_PORTAL_RETURN_PATH = '/profile';
export const DEFAULT_WEB_APP_URL = 'https://motovault.app';

/** Stripe search has no ordering guarantee, so we sort; this bounds the page. */
export const STRIPE_SEARCH_LIMIT = 10;

/** RevenueCat v2 clamps limit to 1..100; one page covers any real rider. */
export const RC_SUBSCRIPTIONS_LIMIT = 100;

/** Per outbound request; a hung Stripe or RevenueCat call must not hold the resolver open. */
export const BILLING_REQUEST_TIMEOUT_MS = 8_000;

/** Keys equal values so the wire format stays lowercase (repo convention). */
export const BillingPortalStatusEnum = {
  ok: 'ok',
  /** STRIPE_BILLING_PORTAL_KEY is not set on this deploy — feature off. */
  not_configured: 'not_configured',
  /** No Stripe subscription for this user: they never bought on the web. */
  not_found: 'not_found',
  /** Stripe rejected or failed the request. */
  unavailable: 'unavailable',
} as const;

export type BillingPortalStatus =
  (typeof BillingPortalStatusEnum)[keyof typeof BillingPortalStatusEnum];

registerEnumType(BillingPortalStatusEnum, {
  name: 'BillingPortalStatus',
  description: 'Outcome of creating a Stripe billing portal session for a web subscriber.',
});
