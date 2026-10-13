/**
 * Paywall surfaces the app presents on its own during onboarding. Kept in a
 * dependency-free module so lib/subscription.ts can match them exactly without
 * importing lib/onboarding-paywall.ts, which imports subscription.ts.
 */
export const ONBOARDING_PAYWALL_SURFACE = {
  STEP: 'onboarding_paywall',
  GARAGE_READY: 'onboarding_garage_ready',
} as const;

export type OnboardingPaywallSurface =
  (typeof ONBOARDING_PAYWALL_SURFACE)[keyof typeof ONBOARDING_PAYWALL_SURFACE];

const ONBOARDING_SURFACES: ReadonlySet<string> = new Set(Object.values(ONBOARDING_PAYWALL_SURFACE));

export function isOnboardingPaywallSurface(surface: string | undefined): boolean {
  return surface !== undefined && ONBOARDING_SURFACES.has(surface);
}
