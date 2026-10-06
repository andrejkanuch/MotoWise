import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingPortalStatusEnum, STRIPE_API_BASE } from './billing-portal.constants';
import { BillingPortalService } from './billing-portal.service';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

const USER_ID = '0b7c6f9e-3c1a-4c8e-9a51-2d1f6c0e8a11';
const KEY = 'rk_test_restricted';

function makeService(env: Record<string, string | undefined>): BillingPortalService {
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  return new BillingPortalService(config);
}

type Route = { status?: number; body: unknown };
let routes: Record<string, Route>;
let calls: Array<{ url: string; init: RequestInit }>;

beforeEach(() => {
  routes = {};
  calls = [];
  vi.mocked(Sentry.captureException).mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const path = url.replace(STRIPE_API_BASE, '').split('?')[0];
      const route = routes[path];
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

describe('BillingPortalService', () => {
  it('is off, without calling Stripe, when no key is configured', async () => {
    const result = await makeService({}).createSession(USER_ID);
    expect(result).toEqual({ status: BillingPortalStatusEnum.not_configured, url: null });
    expect(calls).toHaveLength(0);
  });

  it('refuses a non-UUID user id before it reaches a Stripe query', async () => {
    const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY }).createSession(
      "x' OR metadata['a']:'b",
    );
    expect(result.status).toBe(BillingPortalStatusEnum.no_customer);
    expect(calls).toHaveLength(0);
  });

  it("opens a portal session for the newest subscription's customer", async () => {
    routes['/subscriptions/search'] = {
      body: {
        data: [
          { customer: 'cus_old', created: 100 },
          { customer: 'cus_new', created: 200 },
        ],
      },
    };
    routes['/billing_portal/sessions'] = {
      body: { url: 'https://billing.stripe.com/p/session/x' },
    };

    const result = await makeService({
      STRIPE_BILLING_PORTAL_KEY: KEY,
      WEB_APP_URL: 'https://motovault.app/',
    }).createSession(USER_ID);

    expect(result).toEqual({
      status: BillingPortalStatusEnum.ok,
      url: 'https://billing.stripe.com/p/session/x',
    });
    const search = new URL(calls[0].url);
    expect(search.searchParams.get('query')).toBe(`metadata['rc_customer_id']:'${USER_ID}'`);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = calls[1].init.body as URLSearchParams;
    expect(calls[1].init.method).toBe('POST');
    expect(body.get('customer')).toBe('cus_new');
    expect(body.get('return_url')).toBe('https://motovault.app/profile');
  });

  it('falls back to a customer tagged directly', async () => {
    routes['/subscriptions/search'] = { body: { data: [] } };
    routes['/customers/search'] = { body: { data: [{ id: 'cus_direct', created: 1 }] } };
    routes['/billing_portal/sessions'] = {
      body: { url: 'https://billing.stripe.com/p/session/y' },
    };

    const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY }).createSession(USER_ID);
    expect(result.status).toBe(BillingPortalStatusEnum.ok);
    expect(new URL(calls[1].url).searchParams.get('query')).toBe(
      `metadata['rc_customer_id']:'${USER_ID}'`,
    );
    expect((calls[2].init.body as URLSearchParams).get('customer')).toBe('cus_direct');
    expect((calls[2].init.body as URLSearchParams).get('return_url')).toBe(
      'https://motovault.app/profile',
    );
  });

  it('treats an empty WEB_APP_URL as unset, so the return_url stays absolute', async () => {
    routes['/subscriptions/search'] = { body: { data: [{ customer: 'cus_1', created: 1 }] } };
    routes['/billing_portal/sessions'] = {
      body: { url: 'https://billing.stripe.com/p/session/z' },
    };

    await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY, WEB_APP_URL: '' }).createSession(USER_ID);
    expect((calls[1].init.body as URLSearchParams).get('return_url')).toBe(
      'https://motovault.app/profile',
    );
  });

  it('bounds every Stripe request with a timeout signal', async () => {
    routes['/subscriptions/search'] = { body: { data: [] } };
    routes['/customers/search'] = { body: { data: [] } };
    await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY }).createSession(USER_ID);
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('degrades to unavailable, and reports without the key, when Stripe times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      }),
    );
    const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY }).createSession(USER_ID);
    expect(result).toEqual({ status: BillingPortalStatusEnum.unavailable, url: null });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)).not.toContain(KEY);
  });

  it('reports no_customer for someone who never bought on the web', async () => {
    routes['/subscriptions/search'] = { body: { data: [] } };
    routes['/customers/search'] = { body: { data: [] } };
    const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY }).createSession(USER_ID);
    expect(result).toEqual({ status: BillingPortalStatusEnum.no_customer, url: null });
  });

  it('degrades to unavailable when Stripe rejects the key or the request', async () => {
    routes['/subscriptions/search'] = { status: 403, body: {} };
    const result = await makeService({ STRIPE_BILLING_PORTAL_KEY: KEY }).createSession(USER_ID);
    expect(result).toEqual({ status: BillingPortalStatusEnum.unavailable, url: null });
  });
});
