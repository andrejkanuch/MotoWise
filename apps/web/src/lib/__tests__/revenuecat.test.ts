import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRevenueCatCustomerInfo } from '../revenuecat';

const { isConfigured, configure, getSharedInstance, instance } = vi.hoisted(() => {
  const instance = {
    getCustomerInfo: vi.fn(),
    getAppUserId: vi.fn(),
    changeUser: vi.fn(),
  };
  return {
    isConfigured: vi.fn(),
    configure: vi.fn(),
    getSharedInstance: vi.fn(() => instance),
    instance,
  };
});

vi.mock('@revenuecat/purchases-js', () => ({
  Purchases: { isConfigured, configure, getSharedInstance },
}));

const ENV_KEY = 'NEXT_PUBLIC_REVENUECAT_WEB_API_KEY';

describe('getRevenueCatCustomerInfo', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('returns null and never touches the SDK when the web API key is not set', async () => {
    vi.stubEnv(ENV_KEY, '');
    await expect(getRevenueCatCustomerInfo('user-a')).resolves.toBeNull();
    expect(isConfigured).not.toHaveBeenCalled();
    expect(configure).not.toHaveBeenCalled();
  });

  it('configures once when not configured and returns the customer info', async () => {
    vi.stubEnv(ENV_KEY, 'rcb_test');
    isConfigured.mockReturnValue(false);
    const info = { managementURL: 'https://pay.rev.cat/a' };
    instance.getCustomerInfo.mockResolvedValue(info);

    await expect(getRevenueCatCustomerInfo('user-a')).resolves.toBe(info);
    expect(configure).toHaveBeenCalledWith({ apiKey: 'rcb_test', appUserId: 'user-a' });
    expect(instance.changeUser).not.toHaveBeenCalled();
  });

  it('reuses the singleton without reconfiguring when already keyed to the same user', async () => {
    vi.stubEnv(ENV_KEY, 'rcb_test');
    isConfigured.mockReturnValue(true);
    instance.getAppUserId.mockReturnValue('user-a');
    const info = { managementURL: null };
    instance.getCustomerInfo.mockResolvedValue(info);

    await expect(getRevenueCatCustomerInfo('user-a')).resolves.toBe(info);
    expect(configure).not.toHaveBeenCalled();
    expect(instance.changeUser).not.toHaveBeenCalled();
    expect(instance.getCustomerInfo).toHaveBeenCalled();
  });

  it('re-keys the singleton via changeUser when it is configured for a different user', async () => {
    vi.stubEnv(ENV_KEY, 'rcb_test');
    isConfigured.mockReturnValue(true);
    instance.getAppUserId.mockReturnValue('user-a');
    const info = { managementURL: 'https://pay.rev.cat/b' };
    instance.changeUser.mockResolvedValue(info);

    // A stale singleton keyed to user-a must NOT return user-a's info to user-b.
    await expect(getRevenueCatCustomerInfo('user-b')).resolves.toBe(info);
    expect(instance.changeUser).toHaveBeenCalledWith('user-b');
    expect(configure).not.toHaveBeenCalled();
    expect(instance.getCustomerInfo).not.toHaveBeenCalled();
  });
});
