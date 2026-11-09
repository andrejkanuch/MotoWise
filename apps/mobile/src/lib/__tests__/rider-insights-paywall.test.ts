// The Rider insights paywall: which offering serves it, and when it receives the
// rider's headline as custom variables.

const mockGetOfferings = jest.fn();
const mockGetPlacementOffering = jest.fn();
const mockPresent = jest.fn();
const mockPresentIfNeeded = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn().mockResolvedValue(undefined),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {}, all: {} } }),
    addCustomerInfoUpdateListener: jest.fn(() => jest.fn()),
    removeCustomerInfoUpdateListener: jest.fn(),
    getOfferings: (...args: unknown[]) => mockGetOfferings(...args),
    getCurrentOfferingForPlacement: (...args: unknown[]) => mockGetPlacementOffering(...args),
    setAttributes: jest.fn(),
    overridePreferredLocale: jest.fn().mockResolvedValue(undefined),
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
  CustomVariableValue: { string: (value: string) => ({ type: 'string', value }) },
  default: {
    presentPaywall: (...args: unknown[]) => mockPresent(...args),
    presentPaywallIfNeeded: (...args: unknown[]) => mockPresentIfNeeded(...args),
  },
}));

jest.mock('expo-constants', () => ({ appOwnership: null }));
jest.mock('../analytics-consent', () => ({ getStoredAnalyticsConsent: () => false }));
jest.mock('../meta-attribution', () => ({
  getStoredUtmProperties: jest.fn().mockResolvedValue(null),
  getStoredFbclid: jest.fn().mockResolvedValue(null),
}));

const mockTrackEvent = jest.fn();
const mockGetFeatureFlag = jest.fn();
jest.mock('../analytics', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
  isAnalyticsEnabled: () => true,
  posthogClient: { getFeatureFlag: (key: string) => mockGetFeatureFlag(key) },
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

import { ONBOARDING_PAYWALL_SURFACE, RIDER_INSIGHTS_PAYWALL_ROW } from '../paywall-surfaces';
import { paywallHistoryLoader, presentPaywall, presentRiderInsightsPaywall } from '../subscription';

paywallHistoryLoader.load = () =>
  Promise.resolve({
    recordOnboardingPaywallDismissed: jest.fn(),
    getOnboardingPaywallDismissedAt: () => null,
  });

const CURRENT = { identifier: 'v5_arm_b', availablePackages: [{}, {}] };
const INSIGHTS = { identifier: 'rider_insights', availablePackages: [{}, {}] };
const COPY = { headline: '1,330 mi this season', subhead: 'Pro shows how twisty your roads were.' };

const eventsNamed = (name: string) =>
  mockTrackEvent.mock.calls.filter(([event]) => event === name).map(([, p]) => p);
const presentArgs = () => mockPresent.mock.calls[0][0];

describe('presentRiderInsightsPaywall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOfferings.mockResolvedValue({ current: CURRENT, all: { rider_insights: INSIGHTS } });
    mockGetPlacementOffering.mockResolvedValue(null);
    mockPresent.mockResolvedValue('CANCELLED');
    mockGetFeatureFlag.mockReturnValue(undefined);
  });

  it('presents the current offering while no placement is attached, and says so', async () => {
    await presentRiderInsightsPaywall(RIDER_INSIGHTS_PAYWALL_ROW.TERRITORY, COPY);

    expect(mockGetPlacementOffering).toHaveBeenCalledWith('rider_insights');
    expect(presentArgs().offering).toBe(CURRENT);
    expect(eventsNamed('PAYWALL_VIEWED')).toEqual([
      expect.objectContaining({
        placement: 'rider_insights',
        offering_source: 'current',
        resolved_offering_identifier: 'v5_arm_b',
        feature: 'territory',
      }),
    ]);
    expect(eventsNamed('PAYWALL_RESULT')).toEqual([
      expect.objectContaining({ offering_source: 'current', paywall_result: 'cancelled' }),
    ]);
  });

  it('presents the placement offering once one is attached', async () => {
    mockGetPlacementOffering.mockResolvedValue(INSIGHTS);

    await presentRiderInsightsPaywall(RIDER_INSIGHTS_PAYWALL_ROW.RHYTHM, COPY);

    expect(presentArgs().offering).toBe(INSIGHTS);
    expect(eventsNamed('PAYWALL_VIEWED')).toEqual([
      expect.objectContaining({ offering_source: 'placement' }),
    ]);
  });

  it('passes no custom variables while the flag is unfetched', async () => {
    await presentRiderInsightsPaywall(RIDER_INSIGHTS_PAYWALL_ROW.TERRITORY, COPY);

    expect(presentArgs().customVariables).toBeUndefined();
  });

  it('passes no custom variables while the flag is off', async () => {
    mockGetFeatureFlag.mockReturnValue(false);

    await presentRiderInsightsPaywall(RIDER_INSIGHTS_PAYWALL_ROW.TERRITORY, COPY);

    expect(presentArgs().customVariables).toBeUndefined();
  });

  it('passes the headline and subhead as string variables when the flag is on', async () => {
    mockGetFeatureFlag.mockImplementation(
      (key: string) => key === 'paywall_vars_rider_insights_ios',
    );

    await presentRiderInsightsPaywall(RIDER_INSIGHTS_PAYWALL_ROW.TERRITORY, COPY);

    expect(presentArgs().customVariables).toEqual({
      insight_headline: { type: 'string', value: '1,330 mi this season' },
      insight_subhead: { type: 'string', value: 'Pro shows how twisty your roads were.' },
    });
  });

  it('presents with one native call, never a gate first', async () => {
    await presentRiderInsightsPaywall(RIDER_INSIGHTS_PAYWALL_ROW.BEST_RIDES, COPY);

    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(mockPresentIfNeeded).not.toHaveBeenCalled();
  });
});

describe('presentPaywall custom variables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOfferings.mockResolvedValue({ current: CURRENT, all: {} });
    mockGetPlacementOffering.mockResolvedValue(null);
    mockPresent.mockResolvedValue('CANCELLED');
    mockGetFeatureFlag.mockReturnValue(true);
  });

  it('never gives the onboarding paywall insights variables, even with every flag on', async () => {
    for (const surface of Object.values(ONBOARDING_PAYWALL_SURFACE)) {
      mockPresent.mockClear();
      await presentPaywall({
        surface,
        customVariables: { insight_headline: 'x', insight_subhead: 'y' },
      });
      expect(presentArgs().customVariables).toBeUndefined();
    }
  });

  it('marks a paywall without a placement as served by the current offering', async () => {
    await presentPaywall({ source: 'settings' });

    expect(eventsNamed('PAYWALL_VIEWED')).toEqual([
      expect.objectContaining({ offering_source: 'current' }),
    ]);
  });
});
