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
};

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: mockPurchases,
}));

jest.mock('expo-constants', () => ({
  appOwnership: null,
}));

const mockCaptureException = jest.fn();
const mockTrackEvent = jest.fn();
jest.mock('../analytics', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
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

import { logoutRevenueCat, setOnboardingAttributes } from '../subscription';

beforeAll(() => {
  process.env.EXPO_PUBLIC_RC_IOS_KEY = 'test_key';
  process.env.EXPO_OS = 'ios';
});

beforeEach(() => {
  jest.clearAllMocks();
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
});
