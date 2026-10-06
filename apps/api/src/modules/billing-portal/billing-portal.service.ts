import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import {
  BILLING_PORTAL_RETURN_PATH,
  BILLING_REQUEST_TIMEOUT_MS,
  BillingPortalStatusEnum,
  DEFAULT_WEB_APP_URL,
  RC_CUSTOMER_ID_METADATA_KEY,
  RC_ENVIRONMENT,
  RC_STORE_STRIPE,
  RC_SUBSCRIPTIONS_LIMIT,
  REVENUECAT_API_V2_BASE,
  STRIPE_API_BASE,
  STRIPE_SEARCH_LIMIT,
  STRIPE_SUBSCRIPTION_ID_RX,
  STRIPE_TEST_KEY_MARKER,
} from './billing-portal.constants';
import type { BillingPortalSession } from './models/billing-portal-session.model';

/** Supabase user ids are UUIDs; anything else must never reach a query or URL path. */
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HTTP_NOT_FOUND = 404;

interface StripeSearchResult<T> {
  data: T[];
}

interface StripeSubscription {
  customer: string;
  created: number;
}

interface StripePortalSession {
  url: string;
}

interface RcSubscription {
  customer_id: string;
  store: string;
  store_subscription_identifier?: string | null;
  environment: string;
  starts_at: number;
}

interface RcList<T> {
  items: T[];
}

class BillingRequestError extends Error {
  constructor(
    readonly service: 'Stripe' | 'RevenueCat',
    readonly status: number,
    readonly path: string,
  ) {
    super(`${service} ${path} returned ${status}`);
  }
}

/**
 * Lets a web (Stripe) subscriber manage or cancel without leaving the app.
 *
 * Why this exists: RevenueCat returns `managementURL: null` for Stripe-app
 * subscriptions unless a Stripe Customer Portal URL is configured on the
 * RevenueCat Stripe app, so /profile had no cancel path for web subscribers — an
 * EU consumer-law risk. A portal *session* drops the rider straight into their
 * own subscription, with no email round-trip.
 *
 * Finding the rider's Stripe customer — only from a *subscription*, never from
 * customer metadata (the browser can write that through checkout metadata):
 *   1. Primary, when REVENUECAT_PROJECT_ID + REVENUECAT_V2_API_KEY are set: ask
 *      RevenueCat (authoritative) for the user's `stripe` subscriptions, then
 *      read the customer off the Stripe subscription it names.
 *   2. Secondary: Stripe subscription search on the `rc_customer_id` metadata
 *      RevenueCat writes server-side.
 * No match → `not_found`, and the web shows the receipt-email / support fallback.
 *
 * Needs STRIPE_BILLING_PORTAL_KEY: a RESTRICTED Stripe key with only
 * "Customer portal: Write" and "Subscriptions: Read". When it is absent the
 * feature reports `not_configured`. The keys never leave the API.
 */
@Injectable()
export class BillingPortalService {
  private readonly logger = new Logger(BillingPortalService.name);

  constructor(private readonly config: ConfigService) {}

  async createSession(userId: string): Promise<BillingPortalSession> {
    const key = this.config.get<string>('STRIPE_BILLING_PORTAL_KEY');
    if (!key) return { status: BillingPortalStatusEnum.not_configured, url: null };
    if (!UUID_RX.test(userId)) return { status: BillingPortalStatusEnum.not_found, url: null };

    try {
      const customerId =
        (await this.customerFromRevenueCat(key, userId)) ??
        (await this.customerFromSubscriptionMetadata(key, userId));
      if (!customerId) return { status: BillingPortalStatusEnum.not_found, url: null };

      const returnUrl = `${this.webAppUrl()}${BILLING_PORTAL_RETURN_PATH}`;
      const session = await this.stripe<StripePortalSession>(key, '/billing_portal/sessions', {
        method: 'POST',
        body: new URLSearchParams({ customer: customerId, return_url: returnUrl }),
      });
      return { status: BillingPortalStatusEnum.ok, url: session.url };
    } catch (err) {
      this.report(userId, err, 'createBillingPortalSession');
      return { status: BillingPortalStatusEnum.unavailable, url: null };
    }
  }

  /**
   * RevenueCat knows which Stripe subscriptions belong to this app user. Returns
   * null when RevenueCat is not configured, has no Stripe subscription for the
   * user, or fails — a RevenueCat outage falls through to the secondary path
   * instead of blocking the cancel path.
   */
  private async customerFromRevenueCat(stripeKey: string, userId: string): Promise<string | null> {
    const projectId = this.config.get<string>('REVENUECAT_PROJECT_ID');
    const rcKey = this.config.get<string>('REVENUECAT_V2_API_KEY');
    if (!projectId || !rcKey) return null;

    let subscriptionIds: string[];
    try {
      subscriptionIds = await this.revenueCatStripeSubscriptionIds(
        rcKey,
        projectId,
        userId,
        this.environmentFor(stripeKey),
      );
    } catch (err) {
      this.report(userId, err, 'revenueCatSubscriptions');
      return null;
    }

    for (const subscriptionId of subscriptionIds) {
      const customer = await this.customerOfSubscription(stripeKey, subscriptionId);
      if (customer) return customer;
    }
    return null;
  }

  private async revenueCatStripeSubscriptionIds(
    rcKey: string,
    projectId: string,
    userId: string,
    environment: string,
  ): Promise<string[]> {
    const params = new URLSearchParams({ environment, limit: String(RC_SUBSCRIPTIONS_LIMIT) });
    const path = `/projects/${encodeURIComponent(projectId)}/customers/${userId}/subscriptions`;
    const response = await fetch(`${REVENUECAT_API_V2_BASE}${path}?${params}`, {
      headers: { Authorization: `Bearer ${rcKey}` },
      signal: AbortSignal.timeout(BILLING_REQUEST_TIMEOUT_MS),
    });
    if (response.status === HTTP_NOT_FOUND) return [];
    if (!response.ok) {
      throw new BillingRequestError('RevenueCat', response.status, '/customers/:id/subscriptions');
    }
    const { items } = (await response.json()) as RcList<RcSubscription>;
    return items
      .filter(
        (sub) =>
          sub.store === RC_STORE_STRIPE &&
          sub.customer_id === userId &&
          STRIPE_SUBSCRIPTION_ID_RX.test(sub.store_subscription_identifier ?? ''),
      )
      .sort((a, b) => b.starts_at - a.starts_at)
      .map((sub) => sub.store_subscription_identifier as string);
  }

  /** The customer on a Stripe subscription; null when Stripe does not know it (e.g. other mode). */
  private async customerOfSubscription(
    key: string,
    subscriptionId: string,
  ): Promise<string | null> {
    try {
      const sub = await this.stripe<StripeSubscription>(key, `/subscriptions/${subscriptionId}`);
      return sub.customer || null;
    } catch (err) {
      if (err instanceof BillingRequestError && err.status === HTTP_NOT_FOUND) return null;
      throw err;
    }
  }

  /**
   * Secondary path: the newest Stripe subscription whose `rc_customer_id`
   * metadata (written by RevenueCat, server-side) is this user. Stripe search
   * has no ordering guarantee, so sort by created. There is deliberately no
   * customer-metadata fallback — that metadata is browser-writable.
   */
  private async customerFromSubscriptionMetadata(
    key: string,
    userId: string,
  ): Promise<string | null> {
    const query = `metadata['${RC_CUSTOMER_ID_METADATA_KEY}']:'${userId}'`;
    const params = new URLSearchParams({ query, limit: String(STRIPE_SEARCH_LIMIT) });
    const subs = await this.stripe<StripeSearchResult<StripeSubscription>>(
      key,
      `/subscriptions/search?${params}`,
    );
    return [...subs.data].sort((a, b) => b.created - a.created)[0]?.customer || null;
  }

  private async stripe<T>(
    key: string,
    path: string,
    init: { method?: 'GET' | 'POST'; body?: URLSearchParams } = {},
  ): Promise<T> {
    const response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: init.body,
      signal: AbortSignal.timeout(BILLING_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new BillingRequestError('Stripe', response.status, path.split('?')[0]);
    return (await response.json()) as T;
  }

  /** A test-mode Stripe key only sees sandbox subscriptions, a live key only production ones. */
  private environmentFor(stripeKey: string): string {
    return stripeKey.includes(STRIPE_TEST_KEY_MARKER)
      ? RC_ENVIRONMENT.sandbox
      : RC_ENVIRONMENT.production;
  }

  private report(userId: string, err: unknown, op: string): void {
    this.logger.error(`Billing portal ${op} failed for ${userId}: ${err}`);
    Sentry.captureException(err, { tags: { area: 'billing', op } });
  }

  private webAppUrl(): string {
    // `||`, not `??`: ConfigService.get falls through to process.env, where an
    // empty `WEB_APP_URL=` (as in .env.example) is '' — that would send Stripe a
    // relative return_url and fail every session.
    return (this.config.get<string>('WEB_APP_URL') || DEFAULT_WEB_APP_URL).replace(/\/+$/, '');
  }
}
