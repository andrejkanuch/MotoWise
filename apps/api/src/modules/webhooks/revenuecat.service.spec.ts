import * as Sentry from '@sentry/nestjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';
import { RevenueCatService } from './revenuecat.service';
import { LIFETIME_PRODUCT_IDS } from './revenuecat-products';

vi.mock('@sentry/nestjs', () => ({ captureMessage: vi.fn(), addBreadcrumb: vi.fn() }));

/**
 * RevenueCat webhook processing (audit: ad-attribution + idempotency guards).
 *
 * Covers the event-handling invariants that, if regressed, double-count ad spend or
 * make RevenueCat retry a permanently-failing delivery forever:
 *  - NON_RENEWING_PURCHASE → lifetime Pro ONLY for a known lifetime SKU; a
 *    product with an expiry is time-limited; anything else grants nothing
 *  - plain RENEWAL → NO Meta 'Subscribe' (only trial-converting renewals fire it)
 *  - first INITIAL_PURCHASE (non-trial) → fires 'Subscribe' exactly once
 */
const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const LIFETIME_V4 = 'motovault_lifetime_v4';
const ALLOWED_SANDBOX_UUID = '22222222-2222-2222-2222-222222222222';

function baseEvent(overrides: Partial<RevenueCatEvent> = {}): RevenueCatEvent {
  return {
    id: 'evt-1',
    type: 'INITIAL_PURCHASE',
    app_user_id: VALID_UUID,
    store: 'APP_STORE',
    ...overrides,
  };
}

describe('RevenueCatService.processEvent', () => {
  let service: RevenueCatService;
  let meta: { sendAppEvent: ReturnType<typeof vi.fn> };
  let adminClient: {
    rpc: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // No real network: by default the RevenueCat lookup fails permanently (401),
    // so these tests exercise the event-type fallback for every event type. (A
    // transient failure would defer EXPIRATION/CANCELLATION/BILLING_ISSUE.) The
    // source-of-truth and deferral paths are covered in
    // revenuecat.service.entitlement.spec.ts.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    meta = { sendAppEvent: vi.fn().mockResolvedValue(undefined) };

    // from('users').select().eq().single() → resolves user email for Meta lookups.
    const usersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { email: 'rider@example.com' }, error: null }),
    };
    adminClient = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn().mockReturnValue(usersChain),
    };

    service = new RevenueCatService(
      {
        get: vi.fn((key: string) => {
          if (key === 'REVENUECAT_SECRET_API_KEY') return 'sk_test';
          if (key === 'REVENUECAT_SANDBOX_ALLOWED_USER_IDS') return [ALLOWED_SANDBOX_UUID];
          return undefined;
        }),
      } as never,
      adminClient as never,
      meta as never,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Drains the fire-and-forget promise chains (Meta CAPI, RC attributes). */
  const flush = async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  };

  it('skips events whose app_user_id is not a UUID (anonymous RC ids)', async () => {
    await service.processEvent(baseEvent({ app_user_id: '$RCAnonymousID:abc' }));
    expect(adminClient.rpc).not.toHaveBeenCalled();
  });

  describe('SANDBOX events (Stripe test mode, App Store sandbox / TestFlight, Play testers)', () => {
    it.each([
      ['Stripe test card', 'STRIPE'],
      ['TestFlight / App Store sandbox', 'APP_STORE'],
      ['Play license tester', 'PLAY_STORE'],
    ])('ignores a %s purchase by a user not on the allowlist (no entitlement write, 200)', async (_label, store) => {
      await expect(
        service.processEvent(
          baseEvent({ environment: 'SANDBOX', store, product_id: 'motovault_pro_monthly_v4' }),
        ),
      ).resolves.toBeUndefined();
      await flush();
      expect(adminClient.rpc).not.toHaveBeenCalled();
      expect(meta.sendAppEvent).not.toHaveBeenCalled();
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'revenuecat.webhook',
          data: expect.objectContaining({ eventId: 'evt-1', appUserId: VALID_UUID, store }),
        }),
      );
    });

    it('ignores every sandbox event type, not just purchases (e.g. a sandbox lifetime SKU)', async () => {
      await service.processEvent(
        baseEvent({
          type: 'NON_RENEWING_PURCHASE',
          environment: 'SANDBOX',
          product_id: LIFETIME_V4,
        }),
      );
      expect(adminClient.rpc).not.toHaveBeenCalled();
    });

    it('processes a sandbox event for an allowlisted user', async () => {
      await service.processEvent(
        baseEvent({
          app_user_id: ALLOWED_SANDBOX_UUID,
          environment: 'SANDBOX',
          store: 'APP_STORE',
        }),
      );
      expect(adminClient.rpc).toHaveBeenCalledWith(
        'process_revenuecat_event',
        expect.objectContaining({ p_app_user_id: ALLOWED_SANDBOX_UUID, p_environment: 'SANDBOX' }),
      );
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    });

    it('processes PRODUCTION events as before', async () => {
      await service.processEvent(baseEvent({ environment: 'PRODUCTION' }));
      expect(adminClient.rpc).toHaveBeenCalledTimes(1);
    });
  });

  describe('CANCELLATION + EXPIRATION delivered together: RPC pass-through only', () => {
    // RPC pass-through only: the RPC is mocked, so this proves nothing about the
    // resulting row. The order-independent state machine lives in
    // process_revenuecat_event (00185) and is checked by
    // supabase/checks/process_revenuecat_event.sql (run supabase/checks/run.sh).
    // Here the service must hand both events to the RPC with the event's own
    // (past) expiry, in whichever order they land.
    const pastMs = Date.UTC(2026, 9, 6, 6, 54, 7);
    const cancellation = baseEvent({
      id: 'evt-cancel',
      type: 'CANCELLATION',
      expiration_at_ms: pastMs,
    });
    const expiration = baseEvent({
      id: 'evt-expire',
      type: 'EXPIRATION',
      expiration_at_ms: pastMs,
    });

    it.each([
      ['EXPIRATION then CANCELLATION', [expiration, cancellation]],
      ['CANCELLATION then EXPIRATION', [cancellation, expiration]],
    ])('%s: both reach the RPC with the past expiry', async (_label, events) => {
      for (const event of events) await service.processEvent(event);
      expect(adminClient.rpc.mock.calls.map(([, args]) => args.p_event_type)).toEqual(
        events.map((event) => event.type),
      );
      for (const [, args] of adminClient.rpc.mock.calls) {
        expect(args.p_expiration_at).toBe(new Date(pastMs).toISOString());
      }
    });
  });

  describe('NON_RENEWING_PURCHASE (lifetime Pro)', () => {
    it.each(
      LIFETIME_PRODUCT_IDS,
    )('grants lifetime (NULL expiry) for lifetime SKU %s', async (productId) => {
      await service.processEvent(
        baseEvent({
          type: 'NON_RENEWING_PURCHASE',
          id: `txn-${productId}`,
          product_id: productId,
          // Even if RC ever sent an expiry, a lifetime SKU stays lifetime.
          expiration_at_ms: Date.UTC(2027, 0, 1),
        }),
      );
      expect(adminClient.rpc).toHaveBeenCalledWith(
        'process_revenuecat_event',
        expect.objectContaining({
          p_event_type: 'NON_RENEWING_PURCHASE',
          p_product_id: productId,
          p_expiration_at: null,
        }),
      );
      expect(Sentry.captureMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('no Pro granted'),
        expect.anything(),
      );
    });

    it('grants a time-limited Pro (event expiry) for a non-lifetime product that carries one', async () => {
      const expiresMs = Date.UTC(2027, 1, 1);
      await service.processEvent(
        baseEvent({
          type: 'NON_RENEWING_PURCHASE',
          id: 'txn-season',
          product_id: 'motovault_season_pass',
          expiration_at_ms: expiresMs,
        }),
      );
      expect(adminClient.rpc).toHaveBeenCalledWith(
        'process_revenuecat_event',
        expect.objectContaining({
          p_event_type: 'NON_RENEWING_PURCHASE',
          p_product_id: 'motovault_season_pass',
          p_expiration_at: new Date(expiresMs).toISOString(),
        }),
      );
    });

    it.each([
      ['an unknown product', 'motovault_tip_jar'],
      ['a missing product id', undefined],
    ])('grants nothing and reports %s with no expiry (never lifetime)', async (_label, productId) => {
      await expect(
        service.processEvent(
          baseEvent({
            type: 'NON_RENEWING_PURCHASE',
            id: 'txn-unknown',
            product_id: productId,
            expiration_at_ms: null,
            price: 2.99,
            currency: 'USD',
          }),
        ),
      ).resolves.toBeUndefined();
      await flush();
      expect(adminClient.rpc).not.toHaveBeenCalled();
      expect(meta.sendAppEvent).not.toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('no Pro granted'),
        expect.objectContaining({
          level: 'warning',
          extra: expect.objectContaining({ eventId: 'txn-unknown', productId: productId ?? null }),
        }),
      );
    });

    it('routes the lifetime purchase through the entitlement RPC (grants Pro, no health report)', async () => {
      await service.processEvent(
        baseEvent({ type: 'NON_RENEWING_PURCHASE', id: 'txn-1', product_id: LIFETIME_V4 }),
      );
      expect(adminClient.rpc).toHaveBeenCalledWith(
        'process_revenuecat_event',
        expect.objectContaining({
          p_event_id: 'txn-1',
          p_event_type: 'NON_RENEWING_PURCHASE',
          p_app_user_id: VALID_UUID,
        }),
      );
    });

    it('swallows an already_processed duplicate delivery and returns → HTTP 200', async () => {
      adminClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'event already_processed' },
      });
      await expect(
        service.processEvent(
          baseEvent({ type: 'NON_RENEWING_PURCHASE', id: 'txn-1', product_id: LIFETIME_V4 }),
        ),
      ).resolves.toBeUndefined();
    });

    it('fires Meta Subscribe for a lifetime purchase (paid conversion)', async () => {
      await service.processEvent(
        baseEvent({
          type: 'NON_RENEWING_PURCHASE',
          id: 'txn-1',
          product_id: LIFETIME_V4,
          price: 99.99,
          currency: 'USD',
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
      expect(meta.sendAppEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'Subscribe', userEmail: 'rider@example.com' }),
      );
    });
  });

  describe('Meta ad-attribution events', () => {
    it('does NOT fire Subscribe on a plain RENEWAL (avoids counting every billing cycle)', async () => {
      await service.processEvent(baseEvent({ type: 'RENEWAL', period_type: 'NORMAL' }));
      // flush the fire-and-forget fireMetaEvent promise chain
      await Promise.resolve();
      expect(meta.sendAppEvent).not.toHaveBeenCalled();
    });

    it('fires Subscribe ONCE on a first INITIAL_PURCHASE (non-trial)', async () => {
      await service.processEvent(
        baseEvent({
          type: 'INITIAL_PURCHASE',
          period_type: 'NORMAL',
          price: 49.99,
          currency: 'USD',
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
      expect(meta.sendAppEvent).toHaveBeenCalledTimes(1);
      expect(meta.sendAppEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'Subscribe', userEmail: 'rider@example.com' }),
      );
    });

    it('fires Subscribe on a trial-converting RENEWAL (is_trial_conversion=true)', async () => {
      await service.processEvent(
        baseEvent({ type: 'RENEWAL', period_type: 'NORMAL', is_trial_conversion: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
      expect(meta.sendAppEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'Subscribe' }),
      );
    });

    it('fires StartTrial (not Subscribe) on a TRIAL INITIAL_PURCHASE', async () => {
      await service.processEvent(baseEvent({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL' }));
      await Promise.resolve();
      await Promise.resolve();
      expect(meta.sendAppEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'StartTrial' }),
      );
    });
  });

  describe('idempotent RPC processing', () => {
    it('swallows the already_processed RPC error (duplicate webhook delivery)', async () => {
      adminClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'event already_processed' },
      });
      await expect(
        service.processEvent(baseEvent({ type: 'RENEWAL', period_type: 'NORMAL' })),
      ).resolves.toBeUndefined();
      await Promise.resolve();
      expect(meta.sendAppEvent).not.toHaveBeenCalled();
    });
  });

  // Trial history + grace period (docs/RevenueCat-Trial-Audit-2026-09-19.md):
  // the RPC is the only writer of users.trial_started_at and of the grace
  // expiry, so the event fields it needs must reach it, and PII must not.
  describe('event persistence', () => {
    it('passes purchase/expiry/grace fields and a redacted payload to the RPC', async () => {
      await service.processEvent(
        baseEvent({
          type: 'BILLING_ISSUE',
          period_type: 'TRIAL',
          product_id: 'motovault_pro_annual_v4',
          environment: 'PRODUCTION',
          purchased_at_ms: 1_700_000_000_000,
          expiration_at_ms: 1_700_600_000_000,
          grace_period_expiration_at_ms: 1_702_000_000_000,
          subscriber_attributes: { $ip: { value: '1.2.3.4' } },
        }),
      );
      const args = adminClient.rpc.mock.calls[0][1];
      expect(args).toMatchObject({
        p_product_id: 'motovault_pro_annual_v4',
        p_store: 'APP_STORE',
        p_environment: 'PRODUCTION',
        p_period_type: 'TRIAL',
        p_purchased_at: new Date(1_700_000_000_000).toISOString(),
        p_expiration_at: new Date(1_700_600_000_000).toISOString(),
        p_grace_period_expiration_at: new Date(1_702_000_000_000).toISOString(),
        p_transferred_from: null,
      });
      expect(args.p_payload).not.toHaveProperty('subscriber_attributes');
      expect(args.p_payload).toMatchObject({ id: 'evt-1', type: 'BILLING_ISSUE' });
    });
  });

  describe('has_had_trial customer attribute', () => {
    it('flags the RC customer on a TRIAL INITIAL_PURCHASE (any store)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', fetchMock);
      await service.processEvent(
        baseEvent({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL', store: 'PLAY_STORE' }),
      );
      await flush();
      const call = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith(`/subscribers/${VALID_UUID}/attributes`),
      );
      expect(call).toBeDefined();
      expect(JSON.parse(call?.[1].body)).toEqual({
        attributes: { has_had_trial: { value: 'true' } },
      });
    });

    it('does not touch attributes on a paid INITIAL_PURCHASE or a RENEWAL', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', fetchMock);
      await service.processEvent(baseEvent({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL' }));
      await service.processEvent(
        baseEvent({ id: 'evt-2', type: 'RENEWAL', is_trial_conversion: true }),
      );
      await flush();
      expect(
        fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/attributes')),
      ).toHaveLength(0);
    });
  });

  describe('TRANSFER', () => {
    const RECEIVER = '22222222-2222-2222-2222-222222222222';
    const LOSER = '33333333-3333-3333-3333-333333333333';

    it("resolves the receiver's live state from RC and passes the losing uuids", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          subscriber: {
            entitlements: {
              'MotoWise Pro': {
                expires_date: '2027-01-01T00:00:00Z',
                product_identifier: 'motovault_pro_annual_v4',
              },
            },
            subscriptions: {
              motovault_pro_annual_v4: { period_type: 'normal', store: 'app_store' },
            },
          },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);
      await service.processEvent(
        baseEvent({
          id: 'tr-1',
          type: 'TRANSFER',
          app_user_id: RECEIVER,
          store: undefined,
          transferred_from: [LOSER, '$RCAnonymousID:abc'],
          transferred_to: [RECEIVER],
        }),
      );
      expect(adminClient.rpc).toHaveBeenCalledWith(
        'process_revenuecat_event',
        expect.objectContaining({
          p_event_type: 'TRANSFER',
          p_app_user_id: RECEIVER,
          p_expiration_at: '2027-01-01T00:00:00.000Z',
          p_period_type: 'NORMAL',
          p_product_id: 'motovault_pro_annual_v4',
          p_store: 'APP_STORE',
          p_transferred_from: [LOSER],
          p_rc_tier: 'pro',
          p_rc_status: 'active',
          p_rc_expires_at: '2027-01-01T00:00:00.000Z',
        }),
      );
    });

    it('defers on a transient RC failure so the redelivery can sync the receiver', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
      await expect(
        service.processEvent(
          baseEvent({
            id: 'tr-3',
            type: 'TRANSFER',
            app_user_id: RECEIVER,
            transferred_from: [LOSER],
          }),
        ),
      ).rejects.toThrow('deferring so RevenueCat redelivers it');
      expect(adminClient.rpc).not.toHaveBeenCalled();
    });

    it('still downgrades the losers on a permanent RC failure (receiver left untouched)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
      await service.processEvent(
        baseEvent({
          id: 'tr-2',
          type: 'TRANSFER',
          app_user_id: RECEIVER,
          transferred_from: [LOSER],
        }),
      );
      expect(adminClient.rpc).toHaveBeenCalledWith(
        'process_revenuecat_event',
        expect.objectContaining({
          p_event_type: 'TRANSFER',
          p_product_id: null,
          p_expiration_at: null,
          p_transferred_from: [LOSER],
        }),
      );
    });
  });
});
