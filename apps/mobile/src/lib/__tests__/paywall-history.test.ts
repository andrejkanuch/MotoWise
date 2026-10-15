jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map<string, unknown>();
    return {
      set: (k: string, v: unknown) => store.set(k, v),
      getNumber: (k: string) => store.get(k) as number | undefined,
    };
  },
}));

import {
  getOnboardingPaywallDismissedAt,
  recordOnboardingPaywallDismissed,
} from '../paywall-history';

describe('paywall-history', () => {
  it('reads null before any onboarding dismissal, then the latest dismissal time', () => {
    expect(getOnboardingPaywallDismissedAt()).toBeNull();

    recordOnboardingPaywallDismissed(1_000);
    expect(getOnboardingPaywallDismissedAt()).toBe(1_000);

    recordOnboardingPaywallDismissed(2_000);
    expect(getOnboardingPaywallDismissedAt()).toBe(2_000);
  });
});
