import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import {
  GOAL_TO_PLACEMENT,
  getPrimaryGoal,
  MAINTENANCE_INTENT_PLACEMENT,
} from '../config/onboarding';
import type { useOnboardingStore } from '../stores/onboarding.store';
import { isMaintenanceIntent } from './pending-intent';
import { presentPaywall, setOnboardingAttributes, waitForRevenueCatLogin } from './subscription';

/**
 * Where an onboarding paywall was presented from. `onboarding_paywall` is the
 * `commit_first` step screen (the historical value, kept so funnels stay
 * comparable); `onboarding_garage_ready` is the `garage_first` payoff CTA.
 */
export const ONBOARDING_PAYWALL_SURFACE = {
  STEP: 'onboarding_paywall',
  GARAGE_READY: 'onboarding_garage_ready',
} as const;

export type OnboardingPaywallSurface =
  (typeof ONBOARDING_PAYWALL_SURFACE)[keyof typeof ONBOARDING_PAYWALL_SURFACE];

/**
 * How long to wait for RevenueCat `logIn` before presenting anyway. After the
 * account step the RC customer is being switched from the anonymous id to the
 * Supabase UUID; presenting before that finishes would evaluate the anonymous
 * customer, so an existing Pro subscriber signing in on a new device would see
 * the paywall instead of skipping it.
 */
const REVENUECAT_LOGIN_WAIT_MS = 3000;

type OnboardingState = ReturnType<typeof useOnboardingStore.getState>;

export type OnboardingPaywallInput = Pick<
  OnboardingState,
  'ridingGoals' | 'bikeData' | 'experienceLevel' | 'pendingIntent'
>;

export type OnboardingPaywallResult = Awaited<ReturnType<typeof presentPaywall>>;

/**
 * Placement + analytics fields for an onboarding paywall. Maintenance-intent
 * riders (arrived from a bike's service-schedule article) get the reminder-led
 * placement; everyone else gets the one mapped from their primary goal. A
 * missing placement falls back to the current offering inside RevenueCat.
 */
export function resolveOnboardingPaywallPlacement(input: OnboardingPaywallInput) {
  const primaryGoal = getPrimaryGoal(input.ridingGoals);
  const placement = isMaintenanceIntent(input.pendingIntent)
    ? MAINTENANCE_INTENT_PLACEMENT
    : GOAL_TO_PLACEMENT[primaryGoal];
  return { primaryGoal, placement, goals: input.ridingGoals.join(',') };
}

/**
 * Present the onboarding paywall the same way from both variants: write the
 * rider's onboarding answers as RevenueCat attributes (targeting only, not
 * copy), wait briefly for RevenueCat `logIn`, then present with
 * `requiredEntitlementIdentifier` so riders who already have Pro skip it.
 * Errors resolve to a result rather than throwing; callers always advance.
 */
export async function presentOnboardingPaywall(
  input: OnboardingPaywallInput,
  options: { surface: OnboardingPaywallSurface; shouldAbort: () => boolean },
): Promise<OnboardingPaywallResult> {
  const { primaryGoal, placement } = resolveOnboardingPaywallPlacement(input);
  const personalization = {
    primaryGoal,
    bikeMake: input.bikeData?.make,
    bikeModel: input.bikeData?.model,
    bikeYear: input.bikeData?.year,
    experience: input.experienceLevel,
  };

  // Login first, so the attributes land on the signed-in customer rather than the
  // anonymous one being replaced.
  await waitForRevenueCatLogin(REVENUECAT_LOGIN_WAIT_MS);
  await setOnboardingAttributes(personalization);

  // The rider may have taken the escape link while we waited. Bail before
  // presentPaywall emits a present request into the funnel.
  if (options.shouldAbort()) return 'not_presented';

  return presentPaywall({
    requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_PRO,
    placement,
    personalization,
    source: 'onboarding',
    feature: 'subscription',
    surface: options.surface,
    silentOnError: true,
    shouldAbort: options.shouldAbort,
  });
}

/**
 * Whether the root gate should treat the server's onboarding flag as complete.
 * While a `garage_first` rider is waiting on "Open my garage" the server flag is
 * already true (personalizing saved the setup), but switching to the tabs then
 * would skip the payoff CTA and its paywall.
 */
export function isServerOnboardingComplete(
  preferences: { onboardingCompleted?: boolean } | null | undefined,
  awaitingGarageCta: boolean,
): boolean {
  return preferences?.onboardingCompleted === true && !awaitingGarageCta;
}
