const mockPurchases = {
  getCustomerInfo: jest.fn(),
  restorePurchases: jest.fn(),
};
jest.mock('react-native-purchases', () => ({ __esModule: true, default: mockPurchases }));

const mockTrackEvent = jest.fn();
const mockCaptureException = jest.fn();
jest.mock('../../../lib/analytics', () => ({
  AnalyticsEvent: { SUBSCRIPTION_RESTORED: 'subscription_restored' },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

const mockUpdateStore = jest.fn();
jest.mock('../../../lib/subscription', () => ({
  updateStoreFromCustomerInfo: (...args: unknown[]) => mockUpdateStore(...args),
}));

import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import type { TFunction } from 'i18next';
import { Alert, Linking } from 'react-native';
import { openManageSubscription, restorePurchases } from '../subscription-actions';

const t = ((key: string) => key) as unknown as TFunction;

let alertSpy: jest.SpyInstance;
let openUrlSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  alertSpy.mockRestore();
  openUrlSpy.mockRestore();
});

describe('openManageSubscription', () => {
  it('opens the store management page when RevenueCat has one', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue({
      managementURL: 'https://apps.apple.com/sub',
    });
    await openManageSubscription(t);
    expect(openUrlSpy).toHaveBeenCalledWith('https://apps.apple.com/sub');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('a lifetime or promo grant has no management URL: tells the rider so', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue({ managementURL: null });
    await openManageSubscription(t);
    expect(openUrlSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'profile.manageUnavailableTitle',
      'profile.manageUnavailableBody',
    );
  });

  it('a store error is reported and shown', async () => {
    mockPurchases.getCustomerInfo.mockRejectedValue(new Error('store down'));
    await openManageSubscription(t);
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error), {
      source: 'profile.manageSubscription',
    });
    expect(alertSpy).toHaveBeenCalledWith('profile.storeErrorTitle', 'profile.storeErrorBody');
  });
});

describe('restorePurchases', () => {
  it('Pro restored: refreshes the store, tracks the restore, confirms', async () => {
    const info = { entitlements: { active: { [REVENUECAT_ENTITLEMENT_PRO]: {} } } };
    mockPurchases.restorePurchases.mockResolvedValue(info);
    await restorePurchases(t);
    expect(mockUpdateStore).toHaveBeenCalledWith(info);
    expect(mockTrackEvent).toHaveBeenCalledWith('subscription_restored', {
      surface: 'profile_restore',
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'profile.restoreSuccessTitle',
      'profile.restoreSuccessBody',
    );
  });

  it('nothing to restore: refreshes the store, no tracking, says nothing was found', async () => {
    const info = { entitlements: { active: {} } };
    mockPurchases.restorePurchases.mockResolvedValue(info);
    await restorePurchases(t);
    expect(mockUpdateStore).toHaveBeenCalledWith(info);
    expect(mockTrackEvent).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('profile.restoreNoneTitle', 'profile.restoreNoneBody');
  });

  it('a store error is reported and shown', async () => {
    mockPurchases.restorePurchases.mockRejectedValue(new Error('network'));
    await restorePurchases(t);
    expect(mockUpdateStore).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error), {
      source: 'profile.restorePurchases',
    });
    expect(alertSpy).toHaveBeenCalledWith('profile.storeErrorTitle', 'profile.storeErrorBody');
  });
});
