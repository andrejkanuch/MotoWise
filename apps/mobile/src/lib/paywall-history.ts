import { createMMKV } from 'react-native-mmkv';

/**
 * When the rider last dismissed an onboarding paywall. Read by the ride-moment
 * teaser rule (plan R4): no teaser within 72 hours of that dismissal, so a rider
 * who just said no in onboarding is not asked again on their next ride.
 *
 * Device-local on purpose: it is a courtesy cooldown, not entitlement state.
 */
const storage = createMMKV({ id: 'paywall-history' });

const KEY_ONBOARDING_DISMISSED_AT = 'onboardingPaywallDismissedAt';

export function recordOnboardingPaywallDismissed(now: number = Date.now()): void {
  storage.set(KEY_ONBOARDING_DISMISSED_AT, now);
}

export function getOnboardingPaywallDismissedAt(): number | null {
  return storage.getNumber(KEY_ONBOARDING_DISMISSED_AT) ?? null;
}
