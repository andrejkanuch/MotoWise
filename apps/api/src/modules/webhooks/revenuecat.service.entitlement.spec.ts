import * as Sentry from '@sentry/nestjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';
import { RC_REQUEST_TIMEOUT_MS, RevenueCatService } from './revenuecat.service';
import type { RcSubscriberResponse } from './revenuecat-entitlement';

vi.mock('@sentry/nestjs', () => ({ captureMessage: vi.fn(), addBreadcrumb: vi.fn() }));

/**
 * Issue #273: RevenueCat is the source of truth. On every webhook the service
 * reads the subscriber's live "MotoWise Pro" entitlement and hands the
 * resulting tier/status/expiry to process_revenuecat_event (p_rc_*), which then
 * writes it regardless of the event type (00187; the row-level outcome is
 * checked in supabase/checks/process_revenuecat_event.sql).
 *
 * Behaviour table:
 *  - lifetime + old subscription CANCELLATION/EXPIRATION (either order) → stays pro, lifetime
 *  - lifetime refund → revoked
 *  - subscription refund → revoked
 *  - RevenueCat API down (timeout, network, 408, 429, 5xx) on EXPIRATION /
 *    CANCELLATION / BILLING_ISSUE / TRANSFER → deferred: throws before the RPC, so
 *    RevenueCat redelivers it; on any other event → event-type fallback
 *  - permanent lookup failure (key unset, other 4xx, bad body) → event-type
 *    fallback (no p_rc_*), reported to Sentry
 */
const USER = '11111111-1111-1111-1111-111111111111';
const ALLOWED_SANDBOX_USER = '22222222-2222-2222-2222-222222222222';
const MONTHLY = 'motovault_pro_monthly_v4';
const LIFETIME = 'motovault_lifetime_v4';
const PAST_MS = Date.now() - 5 * 60_000;
const PAST_ISO = new Date(PAST_MS).toISOString();

const lifetimeSubscriber: RcSubscriberResponse = {
  subscriber: {
    entitlements: { 'MotoWise Pro': { expires_date: null, product_identifier: LIFETIME } },
    subscriptions: {
      [MONTHLY]: { expires_date: PAST_ISO, unsubscribe_detected_at: PAST_ISO, is_sandbox: false },
    } as never,
    non_subscriptions: { [LIFETIME]: [{ is_sandbox: false, store: 'app_store' }] },
  },
};

/** After a lifetime refund RevenueCat no longer lists the entitlement. */
const refundedLifetimeSubscriber: RcSubscriberResponse = {
  subscriber: { entitlements: {}, subscriptions: {}, non_subscriptions: {} },
};

/** After a subscription refund the entitlement expires at the refund time. */
const refundedSubscriptionSubscriber: RcSubscriberResponse = {
  subscriber: {
    entitlements: { 'MotoWise Pro': { expires_date: PAST_ISO, product_identifier: MONTHLY } },
    subscriptions: { [MONTHLY]: { period_type: 'normal', store: 'app_store', is_sandbox: false } },
  },
};

const event = (overrides: Partial<RevenueCatEvent>): RevenueCatEvent => ({
  id: 'evt',
  type: 'RENEWAL',
  app_user_id: USER,
  store: 'APP_STORE',
  environment: 'PRODUCTION',
  ...overrides,
});

const okResponse = (body: RcSubscriberResponse) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

describe('RevenueCatService: RevenueCat entitlement is the source of truth (#273)', () => {
  let service: RevenueCatService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let rpc: ReturnType<typeof vi.fn>;
  let secretKey: string | undefined;

  const rpcArgs = (call = 0) => rpc.mock.calls[call][1] as Record<string, unknown>;
  const subscriberLookups = () =>
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith(`/subscribers/${USER}`));

  beforeEach(() => {
    vi.clearAllMocks();
    secretKey = 'sk_test';
    fetchMock = vi.fn().mockResolvedValue(okResponse(lifetimeSubscriber));
    vi.stubGlobal('fetch', fetchMock);
    rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const usersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { email: 'rider@example.com' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    service = new RevenueCatService(
      {
        get: vi.fn((key: string) => {
          if (key === 'REVENUECAT_SECRET_API_KEY') return secretKey;
          if (key === 'REVENUECAT_SANDBOX_ALLOWED_USER_IDS') return [ALLOWED_SANDBOX_USER];
          return undefined;
        }),
      } as never,
      { rpc, from: vi.fn().mockReturnValue(usersChain) } as never,
      { sendAppEvent: vi.fn().mockResolvedValue(undefined) } as never,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('looks the subscriber up with the v1 secret key and a request timeout', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    await service.processEvent(event({}));
    expect(subscriberLookups()).toHaveLength(1);
    const [url, init] = subscriberLookups()[0];
    expect(url).toBe(`https://api.revenuecat.com/v1/subscribers/${USER}`);
    expect(init.headers).toEqual({ Authorization: 'Bearer sk_test' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutSpy).toHaveBeenCalledWith(RC_REQUEST_TIMEOUT_MS);
    timeoutSpy.mockRestore();
  });

  describe('lifetime user + CANCELLATION/EXPIRATION of an older subscription → stays Pro (lifetime)', () => {
    const cancellation = event({
      id: 'old-cancel',
      type: 'CANCELLATION',
      product_id: MONTHLY,
      cancel_reason: 'UNSUBSCRIBE',
      expiration_at_ms: PAST_MS,
    });
    const expiration = event({
      id: 'old-expire',
      type: 'EXPIRATION',
      product_id: MONTHLY,
      expiration_reason: 'UNSUBSCRIBE',
      expiration_at_ms: PAST_MS,
    });

    it.each([
      ['EXPIRATION then CANCELLATION', [expiration, cancellation]],
      ['CANCELLATION then EXPIRATION', [cancellation, expiration]],
    ])('%s', async (_label, events) => {
      for (const e of events) await service.processEvent(e);
      expect(rpc).toHaveBeenCalledTimes(2);
      events.forEach((e, i) => {
        expect(rpcArgs(i)).toMatchObject({
          p_event_id: e.id,
          p_event_type: e.type,
          // The event's own data is still logged as-is.
          p_product_id: MONTHLY,
          p_expiration_at: PAST_ISO,
          // ...but the row is written from the entitlement.
          p_rc_tier: 'pro',
          p_rc_status: 'active',
          p_rc_expires_at: null,
        });
      });
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  it('lifetime refund (CANCELLATION, cancel_reason CUSTOMER_SUPPORT) → revoked', async () => {
    fetchMock.mockResolvedValue(okResponse(refundedLifetimeSubscriber));
    await service.processEvent(
      event({
        id: 'lifetime-refund',
        type: 'CANCELLATION',
        product_id: LIFETIME,
        cancel_reason: 'CUSTOMER_SUPPORT',
        expiration_at_ms: null,
      }),
    );
    expect(rpcArgs()).toMatchObject({
      p_event_type: 'CANCELLATION',
      p_rc_tier: 'free',
      p_rc_status: 'expired',
      p_rc_expires_at: null,
    });
  });

  it('subscription refund (CANCELLATION, cancel_reason CUSTOMER_SUPPORT) → revoked', async () => {
    fetchMock.mockResolvedValue(okResponse(refundedSubscriptionSubscriber));
    await service.processEvent(
      event({
        id: 'sub-refund',
        type: 'CANCELLATION',
        product_id: MONTHLY,
        cancel_reason: 'CUSTOMER_SUPPORT',
        expiration_at_ms: PAST_MS,
      }),
    );
    expect(rpcArgs()).toMatchObject({
      p_rc_tier: 'free',
      p_rc_status: 'expired',
      p_rc_expires_at: PAST_ISO,
    });
  });

  it('lifetime purchase while a subscription is live → lifetime (entitlement points at it)', async () => {
    await service.processEvent(
      event({ id: 'buy-lifetime', type: 'NON_RENEWING_PURCHASE', product_id: LIFETIME }),
    );
    expect(rpcArgs()).toMatchObject({
      p_event_type: 'NON_RENEWING_PURCHASE',
      p_expiration_at: null,
      p_rc_tier: 'pro',
      p_rc_status: 'active',
      p_rc_expires_at: null,
    });
  });

  it('records the resolved entitlement in the logged payload', async () => {
    await service.processEvent(event({ id: 'logged' }));
    expect(rpcArgs().p_payload).toMatchObject({
      id: 'logged',
      motovault_rc_entitlement: { tier: 'pro', status: 'active', expiresAt: null },
    });
  });

  const transientFailures: [string, () => void][] = [
    ['network error', () => fetchMock.mockRejectedValue(new Error('ECONNRESET'))],
    ['timeout', () => fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'))],
    ['HTTP 500', () => fetchMock.mockResolvedValue({ ok: false, status: 500 })],
    ['HTTP 503', () => fetchMock.mockResolvedValue({ ok: false, status: 503 })],
    ['HTTP 429 (rate limited)', () => fetchMock.mockResolvedValue({ ok: false, status: 429 })],
    ['HTTP 408 (request timeout)', () => fetchMock.mockResolvedValue({ ok: false, status: 408 })],
    [
      'timeout while reading the body',
      () =>
        fetchMock.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new DOMException('timed out', 'TimeoutError');
          },
        }),
    ],
  ];

  describe('transient RevenueCat failure on a downgrade-capable event → deferred, RevenueCat redelivers', () => {
    const downgrades = ['EXPIRATION', 'CANCELLATION', 'BILLING_ISSUE', 'TRANSFER'] as const;
    for (const type of downgrades) {
      it.each(transientFailures)(`${type}: %s`, async (_label, arrange) => {
        arrange();
        await expect(
          service.processEvent(
            event({ id: 'deferred', type, product_id: MONTHLY, expiration_at_ms: PAST_MS }),
          ),
        ).rejects.toThrow('deferring so RevenueCat redelivers it');
        // No RPC call → no event row → the redelivery is processed, not already_processed.
        expect(rpc).not.toHaveBeenCalled();
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
          expect.stringContaining('deferring'),
          expect.objectContaining({
            tags: expect.objectContaining({ webhook: 'revenuecat', rc_entitlement: 'deferred' }),
            extra: expect.objectContaining({ eventId: 'deferred', appUserId: USER }),
          }),
        );
      });
    }

    it('the redelivery after RevenueCat recovers keeps a lifetime owner Pro', async () => {
      const expiration = event({
        id: 'old-expire',
        type: 'EXPIRATION',
        product_id: MONTHLY,
        expiration_at_ms: PAST_MS,
      });
      fetchMock.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'));
      await expect(service.processEvent(expiration)).rejects.toThrow();
      await service.processEvent(expiration);
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpcArgs()).toMatchObject({
        p_event_id: 'old-expire',
        p_rc_tier: 'pro',
        p_rc_status: 'active',
        p_rc_expires_at: null,
      });
    });
  });

  describe('transient RevenueCat failure on an event that cannot take Pro away → fallback', () => {
    it.each(transientFailures)('RENEWAL: %s', async (_label, arrange) => {
      arrange();
      await service.processEvent(event({ id: 'renewal-fallback', type: 'RENEWAL' }));
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpcArgs()).not.toHaveProperty('p_rc_tier');
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('falling back to event-type state'),
        expect.objectContaining({
          tags: expect.objectContaining({ rc_entitlement: 'fallback' }),
        }),
      );
    });
  });

  describe('permanent RevenueCat failure → event-type fallback, reported to Sentry', () => {
    it.each([
      ['HTTP 401 (bad key)', () => fetchMock.mockResolvedValue({ ok: false, status: 401 })],
      ['HTTP 404', () => fetchMock.mockResolvedValue({ ok: false, status: 404 })],
      [
        'malformed body',
        () => fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
      ],
      [
        'unparseable body',
        () =>
          fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => {
              throw new SyntaxError('Unexpected token <');
            },
          }),
      ],
      [
        'secret key unset',
        () => {
          secretKey = undefined;
        },
      ],
    ])('%s', async (_label, arrange) => {
      arrange();
      await service.processEvent(
        event({ id: 'fallback', type: 'EXPIRATION', expiration_at_ms: PAST_MS }),
      );
      expect(rpc).toHaveBeenCalledTimes(1);
      const args = rpcArgs();
      expect(args).toMatchObject({ p_event_type: 'EXPIRATION', p_expiration_at: PAST_ISO });
      expect(args).not.toHaveProperty('p_rc_tier');
      expect(args).not.toHaveProperty('p_rc_status');
      expect(args).not.toHaveProperty('p_rc_expires_at');
      expect(args.p_payload).not.toHaveProperty('motovault_rc_entitlement');
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('falling back to event-type state'),
        expect.objectContaining({
          level: 'warning',
          tags: expect.objectContaining({ webhook: 'revenuecat', rc_entitlement: 'fallback' }),
          extra: expect.objectContaining({ eventId: 'fallback', appUserId: USER }),
        }),
      );
    });
  });

  describe('non-entitlement events never write the entitlement (never-paid riders stay free)', () => {
    it.each([
      'EXPERIMENT_ENROLLMENT',
      'SUBSCRIBER_ALIAS',
      'TEST',
      'INVOICE_ISSUANCE',
      'VIRTUAL_CURRENCY_TRANSACTION',
      'SOME_FUTURE_EVENT',
    ])('%s: logged without a lookup or p_rc_*', async (type) => {
      fetchMock.mockResolvedValue(okResponse(refundedLifetimeSubscriber));
      await service.processEvent(event({ id: `non-lifecycle-${type}`, type }));
      expect(subscriberLookups()).toHaveLength(0);
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpcArgs()).toMatchObject({ p_event_id: `non-lifecycle-${type}`, p_event_type: type });
      expect(rpcArgs()).not.toHaveProperty('p_rc_tier');
      expect(rpcArgs().p_payload).not.toHaveProperty('motovault_rc_entitlement');
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    it.each([
      'INITIAL_PURCHASE',
      'RENEWAL',
      'NON_RENEWING_PURCHASE',
      'PRODUCT_CHANGE',
      'CANCELLATION',
      'UNCANCELLATION',
      'BILLING_ISSUE',
      'EXPIRATION',
      'SUBSCRIPTION_PAUSED',
      'SUBSCRIPTION_EXTENDED',
      'TEMPORARY_ENTITLEMENT_GRANT',
      'REFUND_REVERSED',
      'TRANSFER',
    ])('%s: resolves the entitlement', async (type) => {
      await service.processEvent(
        event({ id: `lifecycle-${type}`, type, product_id: LIFETIME, transferred_from: [] }),
      );
      expect(subscriberLookups()).toHaveLength(1);
      expect(rpcArgs()).toMatchObject({ p_rc_tier: 'pro', p_rc_expires_at: null });
    });

    it('TRANSFER of nothing to a never-paid rider passes free/expired + NULL expiry (00187 keeps free/free)', async () => {
      fetchMock.mockResolvedValue(okResponse({ subscriber: { entitlements: {} } }));
      await service.processEvent(
        event({ id: 'empty-transfer', type: 'TRANSFER', transferred_from: [] }),
      );
      expect(rpcArgs()).toMatchObject({
        p_rc_tier: 'free',
        p_rc_status: 'expired',
        p_rc_expires_at: null,
      });
    });
  });

  describe('entitlement renamed in RevenueCat → missing_entitlement warning, permanent fallback', () => {
    it.each<[string, RcSubscriberResponse]>([
      [
        'entitlements present but none is "MotoWise Pro"',
        {
          subscriber: {
            entitlements: {
              'MotoVault Pro': { expires_date: null, product_identifier: LIFETIME },
            },
            non_subscriptions: { [LIFETIME]: [{ is_sandbox: false, store: 'app_store' }] },
          },
        },
      ],
      [
        'a live subscription with no entitlement',
        {
          subscriber: {
            entitlements: {},
            subscriptions: { [MONTHLY]: { expires_date: '2999-01-01T00:00:00Z' } },
          },
        },
      ],
    ])('%s', async (_label, body) => {
      fetchMock.mockResolvedValue(okResponse(body));
      await service.processEvent(
        event({
          id: 'renamed',
          type: 'EXPIRATION',
          product_id: MONTHLY,
          expiration_at_ms: PAST_MS,
        }),
      );
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpcArgs()).not.toHaveProperty('p_rc_tier');
      expect(rpcArgs()).toMatchObject({ p_event_type: 'EXPIRATION', p_expiration_at: PAST_ISO });
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      const [, context] = vi.mocked(Sentry.captureMessage).mock.calls[0] as [
        string,
        { tags: Record<string, string>; extra: Record<string, unknown> },
      ];
      expect(context.tags).toEqual({
        webhook: 'revenuecat',
        rc_event_type: 'EXPIRATION',
        rc_entitlement: 'missing_entitlement',
      });
      expect(context.extra).toMatchObject({ eventId: 'renamed', appUserId: USER });
      expect(context.extra.productIds).toEqual(expect.arrayContaining([expect.any(String)]));
      // No PII beyond the user id: the subscriber body is never attached.
      expect(context.extra).not.toHaveProperty('subscriber');
    });
  });

  it('database without 00187 (PGRST202) → retries once with the legacy arguments and reports it', async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function' },
      })
      .mockResolvedValueOnce({ data: null, error: null });
    await expect(service.processEvent(event({ id: 'old-db' }))).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpcArgs(0)).toHaveProperty('p_rc_tier', 'pro');
    expect(rpcArgs(1)).not.toHaveProperty('p_rc_tier');
    expect(rpcArgs(1)).toMatchObject({ p_event_id: 'old-db' });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('00187 not applied'),
      expect.anything(),
    );
  });

  it('keeps idempotency: an already_processed duplicate is swallowed', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'already_processed' } });
    await expect(service.processEvent(event({ id: 'dup' }))).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('propagates any other RPC error so RevenueCat retries the delivery', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(service.processEvent(event({ id: 'boom' }))).rejects.toMatchObject({
      message: 'denied',
    });
  });

  describe('sandbox guard', () => {
    it('ignores a non-allowlisted SANDBOX event before any RevenueCat lookup', async () => {
      await service.processEvent(event({ environment: 'SANDBOX' }));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    });

    it('never lets a sandbox-backed entitlement grant Pro to a non-allowlisted user', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          subscriber: {
            entitlements: {
              'MotoWise Pro': { expires_date: null, product_identifier: 'lifetime' },
            },
            non_subscriptions: { lifetime: [{ is_sandbox: true }] },
          },
        }),
      );
      await service.processEvent(event({ id: 'prod-evt', type: 'EXPIRATION' }));
      expect(rpcArgs()).not.toHaveProperty('p_rc_tier');
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('sandbox'),
        expect.anything(),
      );
    });

    it('trusts a sandbox-backed entitlement for an allowlisted user', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          subscriber: {
            entitlements: {
              'MotoWise Pro': { expires_date: null, product_identifier: 'lifetime' },
            },
            non_subscriptions: { lifetime: [{ is_sandbox: true }] },
          },
        }),
      );
      await service.processEvent(
        event({ app_user_id: ALLOWED_SANDBOX_USER, environment: 'SANDBOX' }),
      );
      expect(rpcArgs()).toMatchObject({ p_rc_tier: 'pro', p_rc_expires_at: null });
    });
  });
});
