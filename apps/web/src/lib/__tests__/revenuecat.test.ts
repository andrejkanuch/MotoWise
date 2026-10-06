import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRevenueCatCustomerInfo, resetRevenueCatReadCacheForTests } from '../revenuecat';

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
  beforeEach(() => {
    vi.clearAllMocks();
    resetRevenueCatReadCacheForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

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

  it('serializes concurrent callers so the SDK is configured only once', async () => {
    vi.stubEnv(ENV_KEY, 'rcb_test');
    // Model the real singleton: unconfigured until configure() flips it.
    let configured = false;
    isConfigured.mockImplementation(() => configured);
    configure.mockImplementation(() => {
      configured = true;
      return instance;
    });
    instance.getAppUserId.mockReturnValue('user-a');
    instance.getCustomerInfo.mockResolvedValue({ managementURL: null });

    // Both hooks mount together and call concurrently; without the queue both
    // would see isConfigured() === false and configure twice.
    await Promise.all([getRevenueCatCustomerInfo('user-a'), getRevenueCatCustomerInfo('user-a')]);

    expect(configure).toHaveBeenCalledTimes(1);
  });

  it('shares one read between callers for the same user in the same burst', async () => {
    vi.stubEnv(ENV_KEY, 'rcb_test');
    isConfigured.mockReturnValue(true);
    instance.getAppUserId.mockReturnValue('user-a');
    const info = { managementURL: null };
    instance.getCustomerInfo.mockResolvedValue(info);

    // In flight: nav badge, account section and manage link mount together.
    const reads = [1, 2, 3].map(() => getRevenueCatCustomerInfo('user-a'));
    await expect(Promise.all(reads)).resolves.toEqual([info, info, info]);
    // Just settled: a component that mounts a render later.
    await expect(getRevenueCatCustomerInfo('user-a')).resolves.toBe(info);
    expect(instance.getCustomerInfo).toHaveBeenCalledTimes(1);
  });

  it('reads again once the shared window has passed (tab refocus refresh)', async () => {
    vi.useFakeTimers();
    vi.stubEnv(ENV_KEY, 'rcb_test');
    isConfigured.mockReturnValue(true);
    instance.getAppUserId.mockReturnValue('user-a');
    instance.getCustomerInfo.mockResolvedValue({ managementURL: null });

    await getRevenueCatCustomerInfo('user-a');
    vi.advanceTimersByTime(2_001);
    await getRevenueCatCustomerInfo('user-a');
    expect(instance.getCustomerInfo).toHaveBeenCalledTimes(2);
  });

  it('never shares a read across users', async () => {
    vi.stubEnv(ENV_KEY, 'rcb_test');
    isConfigured.mockReturnValue(true);
    instance.getAppUserId.mockReturnValue('user-a');
    instance.getCustomerInfo.mockResolvedValue({ managementURL: null });
    const infoB = { managementURL: 'https://pay.rev.cat/b' };
    instance.changeUser.mockResolvedValue(infoB);

    await getRevenueCatCustomerInfo('user-a');
    await expect(getRevenueCatCustomerInfo('user-b')).resolves.toBe(infoB);
    expect(instance.changeUser).toHaveBeenCalledWith('user-b');
  });

  it('does not reuse a failed read', async () => {
    vi.stubEnv(ENV_KEY, 'rcb_test');
    isConfigured.mockReturnValue(true);
    instance.getAppUserId.mockReturnValue('user-a');
    const info = { managementURL: null };
    instance.getCustomerInfo.mockRejectedValueOnce(new Error('network')).mockResolvedValue(info);

    await expect(getRevenueCatCustomerInfo('user-a')).rejects.toThrow('network');
    await expect(getRevenueCatCustomerInfo('user-a')).resolves.toBe(info);
    expect(instance.getCustomerInfo).toHaveBeenCalledTimes(2);
  });
});
