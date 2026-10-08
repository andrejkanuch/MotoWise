/**
 * Initial customer-info hydration vs the update listener. react-native-purchases
 * does not order `getCustomerInfo()` against `addCustomerInfoUpdateListener`
 * callbacks, so a listener update that lands while the initial fetch is pending
 * is the fresher state and the late snapshot must not overwrite it.
 */
type Info = {
  entitlements: {
    active: Record<string, { periodType?: string; expirationDate?: string | null }>;
  };
};

let resolveInitialFetch: (info: Info) => void = () => {};
let listener: (info: Info) => void = () => {};

const mockPurchases = {
  configure: jest.fn().mockResolvedValue(undefined),
  getCustomerInfo: jest.fn(
    () =>
      new Promise<Info>((resolve) => {
        resolveInitialFetch = resolve;
      }),
  ),
  addCustomerInfoUpdateListener: jest.fn((fn: (info: Info) => void) => {
    listener = fn;
  }),
  removeCustomerInfoUpdateListener: jest.fn(),
  setLogLevel: jest.fn(),
  LOG_LEVEL: { DEBUG: 'DEBUG', WARN: 'WARN' },
};

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: mockPurchases,
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { appOwnership: null } }));
jest.mock('../analytics-consent', () => ({ getStoredAnalyticsConsent: () => false }));
jest.mock('../analytics', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  trackEvent: jest.fn(),
}));
jest.mock('../logger', () => ({ logger: { warn: jest.fn() } }));
const mockSetPro = jest.fn();
jest.mock('../../stores/subscription.store', () => ({
  useSubscriptionStore: {
    getState: () => ({
      setAvailable: jest.fn(),
      setPro: mockSetPro,
      setTrialing: jest.fn(),
      setVerified: jest.fn(),
    }),
  },
}));

import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import { initRevenueCat, trialReminderLoader } from '../subscription';

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeAll(() => {
  process.env.EXPO_PUBLIC_RC_IOS_KEY = 'test_key';
  process.env.EXPO_OS = 'ios';
});

it('ignores a stale initial snapshot when a listener update arrived first', async () => {
  const mockReconcile = jest.fn().mockResolvedValue(undefined);
  trialReminderLoader.load = jest.fn(() =>
    Promise.resolve({
      reconcileTrialReminder: mockReconcile,
    } as unknown as typeof import('../trial-reminder')),
  );

  const init = initRevenueCat();
  await flush();

  // The rider cancelled: the listener reports no entitlement...
  listener({ entitlements: { active: {} } });
  // ...then the slower initial fetch resolves with the old trial.
  resolveInitialFetch({
    entitlements: {
      active: {
        [REVENUECAT_ENTITLEMENT_PRO]: {
          periodType: 'TRIAL',
          expirationDate: '2026-10-14T10:00:00Z',
        },
      },
    },
  });
  await init;
  await flush();

  expect(mockSetPro).toHaveBeenCalledTimes(1);
  expect(mockSetPro).toHaveBeenCalledWith(false);
  expect(mockReconcile).toHaveBeenCalledTimes(1);
  expect(mockReconcile).toHaveBeenCalledWith(undefined);
});
