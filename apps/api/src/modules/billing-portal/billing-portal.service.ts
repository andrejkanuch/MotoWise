import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import {
  BILLING_PORTAL_RETURN_PATH,
  BillingPortalStatusEnum,
  DEFAULT_WEB_APP_URL,
  RC_CUSTOMER_ID_METADATA_KEY,
  STRIPE_API_BASE,
  STRIPE_REQUEST_TIMEOUT_MS,
  STRIPE_SEARCH_LIMIT,
} from './billing-portal.constants';
import type { BillingPortalSession } from './models/billing-portal-session.model';

/** Supabase user ids are UUIDs; anything else must never reach a Stripe query string. */
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StripeSearchResult<T> {
  data: T[];
}

interface StripeSubscription {
  customer: string;
  created: number;
}

interface StripeCustomer {
  id: string;
  created: number;
}

interface StripePortalSession {
  url: string;
}

class StripeRequestError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`Stripe ${path} returned ${status}`);
  }
}

/**
 * Lets a web (Stripe) subscriber manage or cancel without leaving the app.
 *
 * Why this exists: RevenueCat returns `managementURL: null` for Stripe-app
 * subscriptions unless a Stripe Customer Portal URL is configured on the
 * RevenueCat Stripe app (confirmed for sandbox sub subStrb0ced0100bfbe5367e5ba07d0f511680),
 * so /profile had no cancel path for web subscribers — an EU consumer-law risk.
 * A portal *session* (rather than the generic portal login link) drops the rider
 * straight into their own subscription, with no email round-trip.
 *
 * Needs STRIPE_BILLING_PORTAL_KEY: a RESTRICTED Stripe key with only
 * "Customer portal: Write", "Customers: Read" and "Subscriptions: Read". When it
 * is absent the feature reports `not_configured` and the web falls back to
 * support-email guidance. The key never leaves the API.
 */
@Injectable()
export class BillingPortalService {
  private readonly logger = new Logger(BillingPortalService.name);

  constructor(private readonly config: ConfigService) {}

  async createSession(userId: string): Promise<BillingPortalSession> {
    const key = this.config.get<string>('STRIPE_BILLING_PORTAL_KEY');
    if (!key) return { status: BillingPortalStatusEnum.not_configured, url: null };
    if (!UUID_RX.test(userId)) return { status: BillingPortalStatusEnum.no_customer, url: null };

    try {
      const customerId = await this.findCustomerId(key, userId);
      if (!customerId) return { status: BillingPortalStatusEnum.no_customer, url: null };

      const returnUrl = `${this.webAppUrl()}${BILLING_PORTAL_RETURN_PATH}`;
      const session = await this.stripe<StripePortalSession>(key, '/billing_portal/sessions', {
        method: 'POST',
        body: new URLSearchParams({ customer: customerId, return_url: returnUrl }),
      });
      return { status: BillingPortalStatusEnum.ok, url: session.url };
    } catch (err) {
      this.logger.error(`Billing portal session failed for ${userId}: ${err}`);
      Sentry.captureException(err, { tags: { area: 'billing', op: 'createBillingPortalSession' } });
      return { status: BillingPortalStatusEnum.unavailable, url: null };
    }
  }

  /**
   * The newest Stripe subscription tagged with this user's RevenueCat id names the
   * customer; a customer tagged directly is the fallback (e.g. all subscriptions
   * already deleted). Stripe search has no ordering guarantee, so sort by created.
   */
  private async findCustomerId(key: string, userId: string): Promise<string | null> {
    const query = `metadata['${RC_CUSTOMER_ID_METADATA_KEY}']:'${userId}'`;
    const params = new URLSearchParams({ query, limit: String(STRIPE_SEARCH_LIMIT) });

    const subs = await this.stripe<StripeSearchResult<StripeSubscription>>(
      key,
      `/subscriptions/search?${params}`,
    );
    const newestSub = [...subs.data].sort((a, b) => b.created - a.created)[0];
    if (newestSub?.customer) return newestSub.customer;

    const customers = await this.stripe<StripeSearchResult<StripeCustomer>>(
      key,
      `/customers/search?${params}`,
    );
    return [...customers.data].sort((a, b) => b.created - a.created)[0]?.id ?? null;
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
      signal: AbortSignal.timeout(STRIPE_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new StripeRequestError(response.status, path.split('?')[0]);
    return (await response.json()) as T;
  }

  private webAppUrl(): string {
    // `||`, not `??`: ConfigService.get falls through to process.env, where an
    // empty `WEB_APP_URL=` (as in .env.example) is '' — that would send Stripe a
    // relative return_url and fail every session.
    return (this.config.get<string>('WEB_APP_URL') || DEFAULT_WEB_APP_URL).replace(/\/+$/, '');
  }
}
