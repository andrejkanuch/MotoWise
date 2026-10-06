import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BillingPortalStatusEnum,
  REVENUECAT_API_V2_BASE,
  STRIPE_API_BASE,
} from './billing-portal.constants';
import { BillingPortalService } from './billing-portal.service';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

const USER_ID = '0b7c6f9e-3c1a-4c8e-9a51-2d1f6c0e8a11';
const KEY = 'rk_live_restricted';
const TEST_KEY = 'rk_test_restricted';
const RC_KEY = 'sk_rc_v2_secret';
const PROJECT_ID = 'proj1ab2c3d4';
const RC_PATH = `/projects/${PROJECT_ID}/customers/${USER_ID}/subscriptions`;
const PORTAL_URL = 'https://billing.stripe.com/p/session/x';
const RC_ENV = { REVENUECAT_PROJECT_ID: PROJECT_ID, REVENUECAT_V2_API_KEY: RC_KEY };

function makeService(env: Record<string, string | undefined>): BillingPortalService {
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  return new BillingPortalService(config);
}

type Route = { status?: number; body: unknown };
/** Keyed by `stripe:<path>` / `rc:<path>` (query string stripped). */
let routes: Record<string, Route>;
let calls: Array<{ url: string; init: RequestInit }>;

function routeKey(url: string): string {
  const [base, prefix] = url.startsWith(REVENUECAT_API_V2_BASE)
    ? [REVENUECAT_API_V2_BASE, 'rc']
    : [STRIPE_API_BASE, 'stripe'];
  return `${prefix}:${url.replace(base, '').split('?')[0]}`;
}

function rcSub(id: string | null, overrides: Record<string, unknown> = {}) {
  return {
    customer_id: USER_ID,
    store: 'stripe',
    store_subscription_identifier: id,
    environment: 'production',
    starts_at: 1,
    ...overrides,
  };
}

beforeEach(() => {
  routes = {};
  calls = [];
  vi.mocked(Sentry.captureException).mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const route = routes[routeKey(url)];
      if (!route) throw new Error(`unexpected fetch ${url}`);
      return {
        ok: (route.status ?? 200) < 400,
        status: route.status ?? 200,
        json: async () => route.body,
      };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const portalPosts = () => calls.filter((c) => c.url.endsWith('/billing_portal/sessions'));
const portalCustomer = () => (portalPosts()[0]?.init.body as URLSearchParams).get('customer');

describe('BillingPortalService', () => {
  it('is off, without calling Stripe, when no key is configured', async () => {
    const result = await makeService({}).createSession(USER_ID);
    expect(result).toEqual({ status: BillingPortalStatusEnum.not_configured, url: null });
    expect(calls).toHaveLength(0);
  });

  it('refuses a non-UUID user id before it reaches a query or URL', async () => {
    const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY, ...RC_ENV }).createSession(
      "x' OR metadata['a']:'b",
    );
    expect(result.status).toBe(BillingPortalStatusEnum.not_found);
    expect(calls).toHaveLength(0);
  });

  describe('primary path: RevenueCat v2', () => {
    it("opens the portal for the customer on the user's newest RevenueCat Stripe subscription", async () => {
      routes[`rc:${RC_PATH}`] = {
        body: {
          items: [
            rcSub('sub_old', { starts_at: 100 }),
            rcSub('sub_new', { starts_at: 200 }),
            rcSub('GPA.1234', { store: 'play_store', starts_at: 300 }),
          ],
        },
      };
      routes['stripe:/subscriptions/sub_new'] = { body: { customer: 'cus_rc', created: 1 } };
      routes['stripe:/billing_portal/sessions'] = { body: { url: PORTAL_URL } };

      const result = await makeService({
        STRIPE_BILLING_PORTAL_KEY: KEY,
        ...RC_ENV,
        WEB_APP_URL: 'https://motovault.app/',
      }).createSession(USER_ID);

      expect(result).toEqual({ status: BillingPortalStatusEnum.ok, url: PORTAL_URL });
      const rcCall = new URL(calls[0].url);
      expect(rcCall.searchParams.get('environment')).toBe('production');
      expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${RC_KEY}`,
      );
      expect(portalCustomer()).toBe('cus_rc');
      expect((portalPosts()[0].init.body as URLSearchParams).get('return_url')).toBe(
        'https://motovault.app/profile',
      );
      // RevenueCat answered, so Stripe search is never consulted.
      expect(calls.some((c) => c.url.includes('/search'))).toBe(false);
    });

    it('asks RevenueCat for sandbox subscriptions when the Stripe key is test-mode', async () => {
      routes[`rc:${RC_PATH}`] = { body: { items: [] } };
      routes['stripe:/subscriptions/search'] = { body: { data: [] } };
      await makeService({ STRIPE_BILLING_PORTAL_KEY: TEST_KEY, ...RC_ENV }).createSession(USER_ID);
      expect(new URL(calls[0].url).searchParams.get('environment')).toBe('sandbox');
    });

    it('ignores subscriptions RevenueCat attributes to another customer or a non-Stripe id', async () => {
      routes[`rc:${RC_PATH}`] = {
        body: {
          items: [
            rcSub('sub_other', { customer_id: 'someone-else' }),
            rcSub('sub_x/../../customers', { starts_at: 5 }),
            rcSub(null),
          ],
        },
      };
      routes['stripe:/subscriptions/search'] = { body: { data: [] } };
      const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY, ...RC_ENV }).createSession(
        USER_ID,
      );
      expect(result.status).toBe(BillingPortalStatusEnum.not_found);
      expect(calls.some((c) => c.url.includes('/subscriptions/sub_'))).toBe(false);
    });

    it('falls back to subscription metadata search when RevenueCat fails, and reports it', async () => {
      routes[`rc:${RC_PATH}`] = { status: 500, body: {} };
      routes['stripe:/subscriptions/search'] = {
        body: { data: [{ customer: 'cus_meta', created: 1 }] },
      };
      routes['stripe:/billing_portal/sessions'] = { body: { url: PORTAL_URL } };
      const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY, ...RC_ENV }).createSession(
        USER_ID,
      );
      expect(result.status).toBe(BillingPortalStatusEnum.ok);
      expect(portalCustomer()).toBe('cus_meta');
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });

    it('skips a RevenueCat subscription Stripe does not know (other mode) and falls through', async () => {
      routes[`rc:${RC_PATH}`] = { body: { items: [rcSub('sub_gone')] } };
      routes['stripe:/subscriptions/sub_gone'] = { status: 404, body: {} };
      routes['stripe:/subscriptions/search'] = { body: { data: [] } };
      const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY, ...RC_ENV }).createSession(
        USER_ID,
      );
      expect(result).toEqual({ status: BillingPortalStatusEnum.not_found, url: null });
    });
  });

  describe('secondary path: Stripe subscription metadata', () => {
    it("opens a portal session for the newest subscription's customer", async () => {
      routes['stripe:/subscriptions/search'] = {
        body: {
          data: [
            { customer: 'cus_old', created: 100 },
            { customer: 'cus_new', created: 200 },
          ],
        },
      };
      routes['stripe:/billing_portal/sessions'] = { body: { url: PORTAL_URL } };

      const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY }).createSession(USER_ID);

      expect(result).toEqual({ status: BillingPortalStatusEnum.ok, url: PORTAL_URL });
      const search = new URL(calls[0].url);
      expect(search.searchParams.get('query')).toBe(`metadata['rc_customer_id']:'${USER_ID}'`);
      expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
      expect(calls[1].init.method).toBe('POST');
      expect(portalCustomer()).toBe('cus_new');
    });

    it('never yields a portal from customer metadata alone (browser-writable)', async () => {
      // A Stripe customer tagged with this user's id exists, e.g. planted through
      // purchases-js checkout metadata — but no subscription names the user.
      routes['stripe:/subscriptions/search'] = { body: { data: [] } };
      routes['stripe:/customers/search'] = { body: { data: [{ id: 'cus_planted', created: 9 }] } };
      routes['stripe:/billing_portal/sessions'] = { body: { url: PORTAL_URL } };

      const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY }).createSession(USER_ID);

      expect(result).toEqual({ status: BillingPortalStatusEnum.not_found, url: null });
      expect(calls.some((c) => c.url.includes('/customers'))).toBe(false);
      expect(portalPosts()).toHaveLength(0);
    });

    it('reports not_found for someone who never bought on the web', async () => {
      routes['stripe:/subscriptions/search'] = { body: { data: [] } };
      const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY }).createSession(USER_ID);
      expect(result).toEqual({ status: BillingPortalStatusEnum.not_found, url: null });
    });
  });

  it('treats an empty WEB_APP_URL as unset, so the return_url stays absolute', async () => {
    routes['stripe:/subscriptions/search'] = {
      body: { data: [{ customer: 'cus_1', created: 1 }] },
    };
    routes['stripe:/billing_portal/sessions'] = { body: { url: PORTAL_URL } };

    await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY, WEB_APP_URL: '' }).createSession(USER_ID);
    expect((portalPosts()[0].init.body as URLSearchParams).get('return_url')).toBe(
      'https://motovault.app/profile',
    );
  });

  it('bounds every outbound request with a timeout signal', async () => {
    routes[`rc:${RC_PATH}`] = { body: { items: [rcSub('sub_1')] } };
    routes['stripe:/subscriptions/sub_1'] = { body: { customer: 'cus_1', created: 1 } };
    routes['stripe:/billing_portal/sessions'] = { body: { url: PORTAL_URL } };
    await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY, ...RC_ENV }).createSession(USER_ID);
    expect(calls).toHaveLength(3);
    for (const call of calls) expect(call.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('degrades to unavailable when Stripe rejects the key or the request', async () => {
    routes['stripe:/subscriptions/search'] = { status: 403, body: {} };
    const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY }).createSession(USER_ID);
    expect(result).toEqual({ status: BillingPortalStatusEnum.unavailable, url: null });
  });

  it('degrades to unavailable, and reports without the keys, when Stripe times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      }),
    );
    const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY, ...RC_ENV }).createSession(
      USER_ID,
    );
    expect(result).toEqual({ status: BillingPortalStatusEnum.unavailable, url: null });
    const reported = JSON.stringify(vi.mocked(Sentry.captureException).mock.calls);
    expect(reported).not.toContain(KEY);
    expect(reported).not.toContain(RC_KEY);
  });
});
