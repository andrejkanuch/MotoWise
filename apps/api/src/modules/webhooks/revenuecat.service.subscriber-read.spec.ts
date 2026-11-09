import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTierCache, resolveTier } from '../../common/entitlements/resolve-tier';
import { RC_REQUEST_TIMEOUT_MS, RevenueCatService } from './revenuecat.service';
import type { RcSubscriberResponse } from './revenuecat-entitlement';

vi.mock('@sentry/nestjs', () => ({ captureMessage: vi.fn(), addBreadcrumb: vi.fn() }));

const USER = '11111111-1111-1111-1111-111111111111';
const ALLOWED_SANDBOX_USER = '22222222-2222-2222-2222-222222222222';
const MONTHLY = 'motovault_pro_monthly_v4';
const SECRET_KEY = 'sk_secret_never_logged';
const FUTURE_ISO = '2999-01-01T00:00:00.000Z';
/** The users row before the webhook lands. */
const FREE_ROW = {
  subscription_tier: 'free',
  subscription_status: 'free',
  subscription_expires_at: null,
};

const subscriber = (isSandbox: boolean): RcSubscriberResponse => ({
  subscriber: {
    entitlements: { 'MotoWise Pro': { expires_date: FUTURE_ISO, product_identifier: MONTHLY } },
    subscriptions: {
      [MONTHLY]: { period_type: 'normal', store: 'app_store', is_sandbox: isSandbox },
    },
  },
});
const neverBought: RcSubscriberResponse = {
  subscriber: { entitlements: {}, subscriptions: {}, non_subscriptions: {} },
};

const okResponse = (body: RcSubscriberResponse) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

/** A service-role client whose users row still says free. */
const freeRowAdmin = () =>
  ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: FREE_ROW, error: null }),
        }),
      }),
    }),
  }) as never;

describe('RevenueCatService.fetchSubscriberEntitlements', () => {
  let service: RevenueCatService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let secretKey: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    clearTierCache();
    secretKey = SECRET_KEY;
    fetchMock = vi.fn().mockResolvedValue(okResponse(subscriber(false)));
    vi.stubGlobal('fetch', fetchMock);
    service = new RevenueCatService(
      {
        get: vi.fn((key: string) => {
          if (key === 'REVENUECAT_SECRET_API_KEY') return secretKey;
          if (key === 'REVENUECAT_SANDBOX_ALLOWED_USER_IDS') return [ALLOWED_SANDBOX_USER];
          return undefined;
        }),
      } as never,
      { rpc: vi.fn(), from: vi.fn() } as never,
      { sendAppEvent: vi.fn() } as never,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reads the v1 subscriber with the secret key and a request timeout', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    await service.fetchSubscriberEntitlements(USER);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.revenuecat.com/v1/subscribers/${USER}`);
    expect(init.headers).toEqual({ Authorization: `Bearer ${SECRET_KEY}` });
    expect(timeoutSpy).toHaveBeenCalledWith(RC_REQUEST_TIMEOUT_MS);
    timeoutSpy.mockRestore();
  });

  it('confirms an active Pro entitlement', async () => {
    const result = await service.fetchSubscriberEntitlements(USER);
    expect(result.isPro).toBe(true);
    expect(result.state).toMatchObject({ tier: 'pro', status: 'active', expiresAt: FUTURE_ISO });
  });

  it('makes the shared tier read Pro after a confirmation, though the row still says free', async () => {
    expect(await resolveTier(freeRowAdmin(), USER)).toBe('free');
    await service.fetchSubscriberEntitlements(USER);
    expect(await resolveTier(freeRowAdmin(), USER)).toBe('pro');
  });

  it('answers a second refresh inside the rate limit with the cached confirmation', async () => {
    const first = await service.fetchSubscriberEntitlements(USER);
    fetchMock.mockResolvedValue(okResponse(neverBought));
    const second = await service.fetchSubscriberEntitlements(USER);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second.isPro).toBe(true);
  });

  it('reads RevenueCat again once the rate-limit window has passed', async () => {
    vi.useFakeTimers();
    await service.fetchSubscriberEntitlements(USER);
    vi.advanceTimersByTime(30_001);
    fetchMock.mockResolvedValue(okResponse(neverBought));
    const later = await service.fetchSubscriberEntitlements(USER);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(later.isPro).toBe(false);
  });

  it('limits each user separately', async () => {
    await service.fetchSubscriberEntitlements(USER);
    await service.fetchSubscriberEntitlements(ALLOWED_SANDBOX_USER);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not confirm Pro for a rider without the entitlement', async () => {
    fetchMock.mockResolvedValue(okResponse(neverBought));
    const result = await service.fetchSubscriberEntitlements(USER);
    expect(result.isPro).toBe(false);
    expect(result.state).toMatchObject({ tier: 'free' });
    expect(await resolveTier(freeRowAdmin(), USER)).toBe('free');
  });

  it('does not confirm a sandbox-backed entitlement for a user off the sandbox allowlist', async () => {
    fetchMock.mockResolvedValue(okResponse(subscriber(true)));
    const result = await service.fetchSubscriberEntitlements(USER);
    expect(result).toEqual({ isPro: false, state: null });
    expect(await resolveTier(freeRowAdmin(), USER)).toBe('free');
  });

  it('confirms a sandbox-backed entitlement for an allowlisted user', async () => {
    fetchMock.mockResolvedValue(okResponse(subscriber(true)));
    const result = await service.fetchSubscriberEntitlements(ALLOWED_SANDBOX_USER);
    expect(result.isPro).toBe(true);
  });

  it('does not call RevenueCat when the secret key is unset', async () => {
    secretKey = undefined;
    const result = await service.fetchSubscriberEntitlements(USER);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ isPro: false, state: null });
  });

  it('answers not-Pro on a network failure or a non-2xx response', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'));
    expect(await service.fetchSubscriberEntitlements(USER)).toEqual({ isPro: false, state: null });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    expect(await service.fetchSubscriberEntitlements(ALLOWED_SANDBOX_USER)).toEqual({
      isPro: false,
      state: null,
    });
  });

  it('never logs the secret key', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    await service.fetchSubscriberEntitlements(USER);
    expect(warn).toHaveBeenCalled();
    for (const call of warn.mock.calls) expect(JSON.stringify(call)).not.toContain(SECRET_KEY);
    warn.mockRestore();
  });
});
