// presentPaywall's failure handling: one paywall at a time, a visible message when
// it cannot be shown, and the cause recorded on `paywall_result`.

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

const mockTrackEvent = jest.fn();
jest.mock('../analytics', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));
jest.mock('../logger', () => ({ logger: { warn: jest.fn() } }));

const mockShowUnavailable = jest.fn();
jest.mock('../paywall-error-alert', () => ({
  showPaywallUnavailable: () => mockShowUnavailable(),
}));

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

import { presentPaywall } from '../subscription';

const OFFERING = { identifier: 'default', availablePackages: [{}, {}] };
const resultEvents = () =>
  mockTrackEvent.mock.calls.filter(([event]) => event === 'PAYWALL_RESULT').map(([, p]) => p);

describe('presentPaywall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOfferings.mockResolvedValue({ current: OFFERING, all: {} });
    mockPresent.mockResolvedValue('CANCELLED');
  });

  it('joins a paywall that is already in flight instead of presenting twice', async () => {
    const [first, second] = await Promise.all([
      presentPaywall({ source: 'feature_gate' }),
      presentPaywall({ source: 'feature_gate' }),
    ]);

    expect(first).toBe('cancelled');
    expect(second).toBe('cancelled');
    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(resultEvents()).toHaveLength(1);
  });

  it('presents again once the previous paywall has settled', async () => {
    await presentPaywall();
    await presentPaywall();

    expect(mockPresent).toHaveBeenCalledTimes(2);
  });

  it('tells the rider and records the cause when offerings cannot be loaded', async () => {
    mockGetOfferings.mockRejectedValue(
      Object.assign(new Error('There was a problem with the store.'), {
        code: '2',
        userInfo: { readableErrorCode: 'StoreProblemError' },
      }),
    );

    await expect(presentPaywall({ source: 'garage' })).resolves.toBe('error');

    expect(mockPresent).not.toHaveBeenCalled();
    expect(mockShowUnavailable).toHaveBeenCalledTimes(1);
    expect(resultEvents()).toEqual([
      expect.objectContaining({
        paywall_result: 'error',
        error_stage: 'offerings',
        error_code: '2',
        error_readable_code: 'StoreProblemError',
        error_message: 'There was a problem with the store.',
      }),
    ]);
  });

  it('records the stage and package count when the native paywall reports an error', async () => {
    mockPresent.mockResolvedValue('ERROR');

    await expect(presentPaywall()).resolves.toBe('error');

    expect(mockShowUnavailable).toHaveBeenCalledTimes(1);
    expect(resultEvents()).toEqual([
      expect.objectContaining({
        paywall_result: 'error',
        error_stage: 'native_result',
        offering_package_count: 2,
      }),
    ]);
  });

  it('does not show the alert for a paywall the app presented on its own', async () => {
    mockPresent.mockResolvedValue('ERROR');

    await presentPaywall({ source: 'onboarding', silentOnError: true });

    expect(mockShowUnavailable).not.toHaveBeenCalled();
  });

  it('does not let a later tap join a flight its caller can abort', async () => {
    const [aborted, tapped] = await Promise.all([
      presentPaywall({ source: 'onboarding', shouldAbort: () => true }),
      presentPaywall({ source: 'feature_gate' }),
    ]);

    expect(aborted).toBe('not_presented');
    expect(tapped).toBe('cancelled');
    expect(mockPresent).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the rider simply closes the paywall', async () => {
    await presentPaywall();

    expect(mockShowUnavailable).not.toHaveBeenCalled();
  });
});
