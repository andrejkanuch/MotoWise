const mockGetFeatureFlag = jest.fn();
const mockAnalyticsEnabled = jest.fn<boolean, []>();
jest.mock('../analytics', () => ({
  isAnalyticsEnabled: () => mockAnalyticsEnabled(),
  posthogClient: { getFeatureFlag: (key: string) => mockGetFeatureFlag(key) },
}));

import { isPaywallVariablesEnabled } from '../feature-flags';
import { ONBOARDING_PAYWALL_SURFACE, PAYWALL_SURFACE } from '../paywall-surfaces';

const ON_FLAGS = new Set<string>();

describe('isPaywallVariablesEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ON_FLAGS.clear();
    mockAnalyticsEnabled.mockReturnValue(true);
    mockGetFeatureFlag.mockImplementation((key: string) => ON_FLAGS.has(key));
  });

  it('reads the iOS flag on iOS and the Android flag on Android', () => {
    ON_FLAGS.add('paywall_vars_rider_insights_ios');

    expect(isPaywallVariablesEnabled(PAYWALL_SURFACE.RIDER_INSIGHTS, 'ios')).toBe(true);
    expect(isPaywallVariablesEnabled(PAYWALL_SURFACE.RIDER_INSIGHTS, 'android')).toBe(false);

    ON_FLAGS.add('paywall_vars_rider_insights_android');
    expect(isPaywallVariablesEnabled(PAYWALL_SURFACE.RIDER_INSIGHTS, 'android')).toBe(true);
  });

  it('is off while the flags have not loaded or their fetch failed', () => {
    mockGetFeatureFlag.mockReturnValue(undefined);
    expect(isPaywallVariablesEnabled(PAYWALL_SURFACE.RIDER_INSIGHTS, 'ios')).toBe(false);
  });

  it('is off when reading the flag throws', () => {
    mockGetFeatureFlag.mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(isPaywallVariablesEnabled(PAYWALL_SURFACE.RIDER_INSIGHTS, 'ios')).toBe(false);
  });

  it('is off when analytics is off, without asking PostHog', () => {
    ON_FLAGS.add('paywall_vars_rider_insights_ios');
    mockAnalyticsEnabled.mockReturnValue(false);

    expect(isPaywallVariablesEnabled(PAYWALL_SURFACE.RIDER_INSIGHTS, 'ios')).toBe(false);
    expect(mockGetFeatureFlag).not.toHaveBeenCalled();
  });

  it('is never on for an onboarding surface, an unknown surface or no surface', () => {
    mockGetFeatureFlag.mockReturnValue(true);

    for (const surface of Object.values(ONBOARDING_PAYWALL_SURFACE)) {
      expect(isPaywallVariablesEnabled(surface, 'ios')).toBe(false);
    }
    expect(isPaywallVariablesEnabled('garage_add_bike_header', 'ios')).toBe(false);
    expect(isPaywallVariablesEnabled(undefined, 'ios')).toBe(false);
  });
});
