import { isOnboardingPaywallSurface, ONBOARDING_PAYWALL_SURFACE } from '../paywall-surfaces';

describe('isOnboardingPaywallSurface', () => {
  it('matches exactly the registered onboarding surfaces', () => {
    for (const surface of Object.values(ONBOARDING_PAYWALL_SURFACE)) {
      expect(isOnboardingPaywallSurface(surface)).toBe(true);
    }
  });

  it('rejects an unregistered onboarding_* string, other surfaces and no surface', () => {
    expect(isOnboardingPaywallSurface('onboarding_something_new')).toBe(false);
    expect(isOnboardingPaywallSurface('garage_add_bike_header')).toBe(false);
    expect(isOnboardingPaywallSurface(undefined)).toBe(false);
  });
});
