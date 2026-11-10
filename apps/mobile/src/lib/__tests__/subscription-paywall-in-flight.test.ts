// The read-only paywall signal other surfaces wait on before showing themselves.

const mockGetOfferings = jest.fn();
const mockPresent = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn().mockResolvedValue(undefined),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {}, all: {} } }),
    addCustomerInfoUpdateListener: jest.fn(() => jest.fn()),
    removeCustomerInfoUpdateListener: jest.fn(),
    getOfferings: (...args: unknown[]) => mockGetOfferings(...args),
    getCurrentOfferingForPlacement: jest.fn().mockResolvedValue(null),
    setAttributes: jest.fn(),
    collectDeviceIdentifiers: jest.fn().mockResolvedValue(undefined),
    enableAdServicesAttributionTokenCollection: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  PAYWALL_RESULT: {
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
    NOT_PRESENTED: 'NOT_PRESENTED',
    ERROR: 'ERROR',
    CANCELLED: 'CANCELLED',
  },
  default: { presentPaywall: (...args: unknown[]) => mockPresent(...args) },
}));

jest.mock('expo-constants', () => ({ appOwnership: null }));
jest.mock('../analytics-consent', () => ({ getStoredAnalyticsConsent: () => false }));
jest.mock('../meta-attribution', () => ({
  getStoredUtmProperties: jest.fn().mockResolvedValue(null),
  getStoredFbclid: jest.fn().mockResolvedValue(null),
}));
jest.mock('../analytics', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  trackEvent: jest.fn(),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));
jest.mock('../logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('../store-review', () => ({
  REVIEW_ACTION: { PRO_SUBSCRIBED: 'pro_subscribed' },
  recordReviewAction: jest.fn(),
}));
jest.mock('../paywall-error-alert', () => ({ showPaywallUnavailable: jest.fn() }));
jest.mock('../../stores/subscription.store', () => ({
  useSubscriptionStore: {
    getState: () => ({
      setAvailable: jest.fn(),
      setPro: jest.fn(),
      setTrialing: jest.fn(),
      setVerified: jest.fn(),
    }),
  },
}));

import { isPaywallInFlight, paywallFlightSettled, presentPaywall } from '../subscription';

const OFFERING = { identifier: 'default', availablePackages: [{}, {}] };

/** A native paywall the test closes by hand, so the flight can be observed mid-air. */
function holdNativePaywall() {
  let close: (result: string) => void = () => {};
  let fail: (error: Error) => void = () => {};
  mockPresent.mockReturnValue(
    new Promise<string>((resolve, reject) => {
      close = resolve;
      fail = reject;
    }),
  );
  return { close: (result: string) => close(result), fail: (error: Error) => fail(error) };
}

describe('paywall in-flight signal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOfferings.mockResolvedValue({ current: OFFERING, all: {} });
  });

  it('is idle before any paywall is requested', () => {
    expect(isPaywallInFlight()).toBe(false);
    expect(paywallFlightSettled()).toBeNull();
  });

  it('is in flight while the paywall is up, and settles when the rider closes it', async () => {
    const native = holdNativePaywall();

    const flight = presentPaywall();
    expect(isPaywallInFlight()).toBe(true);
    const settled = paywallFlightSettled();
    expect(settled).toBeInstanceOf(Promise);

    native.close('CANCELLED');
    await expect(settled).resolves.toBeUndefined();
    await flight;
    expect(isPaywallInFlight()).toBe(false);
    expect(paywallFlightSettled()).toBeNull();
  });

  it('settles and goes idle when the native paywall fails', async () => {
    const native = holdNativePaywall();

    const flight = presentPaywall({ silentOnError: true });
    const settled = paywallFlightSettled();
    native.fail(new Error('native paywall crashed'));

    await expect(settled).resolves.toBeUndefined();
    await expect(flight).resolves.toBe('error');
    expect(isPaywallInFlight()).toBe(false);
    expect(paywallFlightSettled()).toBeNull();
  });
});
