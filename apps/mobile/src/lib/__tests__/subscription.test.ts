const mockLogOut = jest.fn();
const mockIsAnonymous = jest.fn();
const mockConfigure = jest.fn().mockResolvedValue(undefined);
const mockGetCustomerInfo = jest.fn().mockResolvedValue({
  entitlements: { active: {} },
});
const mockAddListener = jest.fn(() => jest.fn());
const mockRemoveListener = jest.fn();

const mockPurchases = {
  configure: mockConfigure,
  logOut: mockLogOut,
  isAnonymous: mockIsAnonymous,
  getCustomerInfo: mockGetCustomerInfo,
  addCustomerInfoUpdateListener: mockAddListener,
  removeCustomerInfoUpdateListener: mockRemoveListener,
  logIn: jest.fn(),
  syncAttributesAndOfferingsIfNeeded: jest.fn(),
  setAttributes: jest.fn(),
  collectDeviceIdentifiers: jest.fn().mockResolvedValue(undefined),
  enableAdServicesAttributionTokenCollection: jest.fn().mockResolvedValue(undefined),
};

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: mockPurchases,
}));

jest.mock('expo-constants', () => ({
  appOwnership: null,
}));

const mockConsent = jest.fn<boolean, []>();
jest.mock('../analytics-consent', () => ({
  getStoredAnalyticsConsent: () => mockConsent(),
}));

const mockGetStoredUtm = jest.fn<Promise<Record<string, string> | null>, []>();
jest.mock('../meta-attribution', () => ({
  getStoredUtmProperties: () => mockGetStoredUtm(),
  getStoredFbclid: jest.fn().mockResolvedValue(null),
}));

const mockCaptureException = jest.fn();
const mockAddBreadcrumb = jest.fn();
const mockTrackEvent = jest.fn();
jest.mock('../analytics', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));

const mockLoggerWarn = jest.fn();
jest.mock('../logger', () => ({
  logger: { warn: (...args: unknown[]) => mockLoggerWarn(...args) },
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

import {
  configureRcAttribution,
  logoutRevenueCat,
  setOnboardingAttributes,
  setSelfReportedSource,
} from '../subscription';

beforeAll(() => {
  process.env.EXPO_PUBLIC_RC_IOS_KEY = 'test_key';
  process.env.EXPO_OS = 'ios';
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no consent, no stored UTM — keeps doInit's attribution branch off
  // for the existing tests. Individual attribution tests opt in explicitly.
  mockConsent.mockReturnValue(false);
  mockGetStoredUtm.mockResolvedValue(null);
});

describe('logoutRevenueCat', () => {
  it('skips logOut when user is anonymous', async () => {
    mockIsAnonymous.mockResolvedValue(true);

    await logoutRevenueCat();

    expect(mockIsAnonymous).toHaveBeenCalled();
    expect(mockLogOut).not.toHaveBeenCalled();
  });

  it('calls logOut when user is NOT anonymous', async () => {
    mockIsAnonymous.mockResolvedValue(false);
    mockLogOut.mockResolvedValue({ entitlements: { active: {} } });

    await logoutRevenueCat();

    expect(mockIsAnonymous).toHaveBeenCalled();
    expect(mockLogOut).toHaveBeenCalled();
  });

  it('handles isAnonymous throwing gracefully', async () => {
    const error = new Error('SDK not ready');
    mockIsAnonymous.mockRejectedValue(error);

    await logoutRevenueCat();

    expect(mockLogOut).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      source: 'revenuecat.logoutRevenueCat',
    });
  });

  it('returns early in Expo Go', async () => {
    const Constants = require('expo-constants');
    Constants.appOwnership = 'expo';

    await logoutRevenueCat();

    expect(mockIsAnonymous).not.toHaveBeenCalled();
    expect(mockLogOut).not.toHaveBeenCalled();

    Constants.appOwnership = null;
  });
});

describe('setOnboardingAttributes', () => {
  it('maps onboarding answers to RevenueCat attributes', async () => {
    await setOnboardingAttributes({
      primaryGoal: 'track_rides',
      bikeMake: 'BMW',
      bikeModel: 'R1250GS',
      bikeYear: 2023,
      experience: 'advanced',
    });

    expect(mockPurchases.setAttributes).toHaveBeenCalledWith({
      primary_goal: 'track_rides',
      primary_bike_make: 'BMW',
      primary_bike_model: 'R1250GS',
      primary_bike_year: '2023',
      riding_experience: 'advanced',
    });
    expect(mockPurchases.syncAttributesAndOfferingsIfNeeded).toHaveBeenCalled();
  });

  it('sends null for empty / missing answers so attributes are deleted', async () => {
    await setOnboardingAttributes({
      primaryGoal: 'just_exploring',
      bikeMake: '   ',
      bikeModel: undefined,
      bikeYear: null,
    });

    expect(mockPurchases.setAttributes).toHaveBeenCalledWith({
      primary_goal: 'just_exploring',
      primary_bike_make: null,
      primary_bike_model: null,
      primary_bike_year: null,
      riding_experience: null,
    });
  });

  it('returns early in Expo Go without touching the SDK', async () => {
    const Constants = require('expo-constants');
    Constants.appOwnership = 'expo';

    await setOnboardingAttributes({ primaryGoal: 'track_rides' });

    expect(mockPurchases.setAttributes).not.toHaveBeenCalled();

    Constants.appOwnership = null;
  });

  it('downgrades transient network errors to warn + breadcrumb (no Sentry capture)', async () => {
    const error = new Error('Error performing request');
    mockPurchases.setAttributes.mockRejectedValueOnce(error);

    await setOnboardingAttributes({ primaryGoal: 'track_rides' });

    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      'Error performing request',
      'revenuecat.setOnboardingAttributes',
    );
  });

  it('captures genuinely unexpected (non-network) errors to Sentry', async () => {
    const error = new Error('Something unexpected exploded');
    mockPurchases.setAttributes.mockRejectedValueOnce(error);

    await setOnboardingAttributes({ primaryGoal: 'track_rides' });

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      source: 'revenuecat.setOnboardingAttributes',
    });
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });

  it('never throws even when the SDK rejects', async () => {
    mockPurchases.setAttributes.mockRejectedValueOnce(new Error('Error performing request'));

    await expect(setOnboardingAttributes({ primaryGoal: 'track_rides' })).resolves.toBeUndefined();
  });
});

describe('setSelfReportedSource', () => {
  it('writes the self-reported channel as a custom (mutable) attribute', async () => {
    await setSelfReportedSource('tiktok');
    expect(mockPurchases.setAttributes).toHaveBeenCalledWith({ self_reported_source: 'tiktok' });
  });

  it('is a no-op for empty / null values (no write)', async () => {
    await setSelfReportedSource('   ');
    await setSelfReportedSource(null);
    await setSelfReportedSource(undefined);
    expect(mockPurchases.setAttributes).not.toHaveBeenCalled();
  });
});

describe('configureRcAttribution', () => {
  it('does nothing when analytics consent is not granted (GDPR gate)', async () => {
    mockConsent.mockReturnValue(false);

    await configureRcAttribution();

    expect(mockPurchases.collectDeviceIdentifiers).not.toHaveBeenCalled();
    expect(mockPurchases.enableAdServicesAttributionTokenCollection).not.toHaveBeenCalled();
    expect(mockPurchases.setAttributes).not.toHaveBeenCalled();
  });

  it('collects device identifiers + ASA token when consented, even with no UTM', async () => {
    mockConsent.mockReturnValue(true);
    mockGetStoredUtm.mockResolvedValue(null);

    await configureRcAttribution();

    expect(mockPurchases.collectDeviceIdentifiers).toHaveBeenCalledTimes(1);
    // iOS — ASA token collection enabled.
    expect(mockPurchases.enableAdServicesAttributionTokenCollection).toHaveBeenCalledTimes(1);
    // No real UTM → $mediaSource must NOT be set (write-once guard, KTD-5).
    expect(mockPurchases.setAttributes).not.toHaveBeenCalled();
  });

  it('stamps $mediaSource/$campaign from a real deep-link UTM', async () => {
    mockConsent.mockReturnValue(true);
    mockGetStoredUtm.mockResolvedValue({ utm_source: 'tiktok', utm_campaign: 'spring' });

    await configureRcAttribution();

    expect(mockPurchases.setAttributes).toHaveBeenCalledWith({
      $mediaSource: 'tiktok',
      $campaign: 'spring',
    });
  });

  it('never sets $mediaSource for organic_unknown (write-once guard)', async () => {
    mockConsent.mockReturnValue(true);
    mockGetStoredUtm.mockResolvedValue({ utm_source: 'organic_unknown' });

    await configureRcAttribution();

    expect(mockPurchases.setAttributes).not.toHaveBeenCalled();
  });
});
