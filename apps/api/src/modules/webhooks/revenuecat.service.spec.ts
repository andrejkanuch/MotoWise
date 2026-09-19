import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';
import { RevenueCatService } from './revenuecat.service';

/**
 * RevenueCat webhook processing (audit: ad-attribution + idempotency guards).
 *
 * Covers the event-handling invariants that, if regressed, double-count ad spend or
 * make RevenueCat retry a permanently-failing delivery forever:
 *  - NON_RENEWING_PURCHASE (lifetime Pro) → routed through the entitlement RPC
 *  - plain RENEWAL → NO Meta 'Subscribe' (only trial-converting renewals fire it)
 *  - first INITIAL_PURCHASE (non-trial) → fires 'Subscribe' exactly once
 */
const VALID_UUID = '11111111-1111-1111-1111-111111111111';

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
        get: vi.fn((key: string) => (key === 'REVENUECAT_SECRET_API_KEY' ? 'sk_test' : undefined)),
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

  describe('NON_RENEWING_PURCHASE (lifetime Pro)', () => {
    it('routes the lifetime purchase through the entitlement RPC (grants Pro, no health report)', async () => {
      await service.processEvent(baseEvent({ type: 'NON_RENEWING_PURCHASE', id: 'txn-1' }));
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
        service.processEvent(baseEvent({ type: 'NON_RENEWING_PURCHASE', id: 'txn-1' })),
      ).resolves.toBeUndefined();
    });

    it('fires Meta Subscribe for a lifetime purchase (paid conversion)', async () => {
      await service.processEvent(
        baseEvent({ type: 'NON_RENEWING_PURCHASE', id: 'txn-1', price: 99.99, currency: 'USD' }),
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
      expect(fetchMock).not.toHaveBeenCalled();
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
          p_expiration_at: '2027-01-01T00:00:00Z',
          p_period_type: 'NORMAL',
          p_product_id: 'motovault_pro_annual_v4',
          p_store: 'APP_STORE',
          p_transferred_from: [LOSER],
        }),
      );
    });

    it('still downgrades the losers when RC cannot be reached (receiver left untouched)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
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
