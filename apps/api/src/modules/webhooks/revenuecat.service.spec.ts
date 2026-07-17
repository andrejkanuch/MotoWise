import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    service = new RevenueCatService({ get: vi.fn() } as never, adminClient as never, meta as never);
  });

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
});
