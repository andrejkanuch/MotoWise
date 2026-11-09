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

/** Paywall surfaces outside onboarding that the app names on its own. */
export const PAYWALL_SURFACE = {
  RIDER_INSIGHTS: 'rider_insights',
} as const;

export type PaywallSurface = (typeof PAYWALL_SURFACE)[keyof typeof PAYWALL_SURFACE];

/** What opens the Rider insights paywall: a locked row or recap card, or the ride-summary card. */
export const RIDER_INSIGHTS_PAYWALL_ROW = {
  TERRITORY: 'territory',
  ROAD_CHARACTER: 'road_character',
  RHYTHM: 'rhythm',
  BEST_RIDES: 'best_rides',
  SUMMARY: 'summary',
  COST: 'cost',
} as const;

export type RiderInsightsPaywallRow =
  (typeof RIDER_INSIGHTS_PAYWALL_ROW)[keyof typeof RIDER_INSIGHTS_PAYWALL_ROW];

/** Custom variables the Rider insights paywall reads as `{{ custom.<key> }}`. */
export const RIDER_INSIGHTS_PAYWALL_VARIABLE = {
  HEADLINE: 'insight_headline',
  SUBHEAD: 'insight_subhead',
} as const;
