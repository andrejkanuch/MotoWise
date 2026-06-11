import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  getNextRoute,
  getStepIndex,
  getTotalScreens,
  OB_VARIANT,
  type ObVariant,
  type OnboardingRoute,
} from '../config/onboarding';
import { useExperimentStore } from '../stores/experiment.store';
import { useOnboardingStore } from '../stores/onboarding.store';

/**
 * Reactive onboarding variant. CONTROL while unassigned — pre-experiment users
 * and any path that races assignment degrade to the V4 behavior. In practice
 * `(onboarding)/_layout` blocks rendering until assignment, so step screens
 * always see the real variant.
 */
export function useOnboardingVariant(): ObVariant {
  return useExperimentStore((s) => s.onboardingVariant) ?? OB_VARIANT.CONTROL;
}

/** Progress-bar coordinates of a screen within the active variant's flow. */
export function useOnboardingStep(route: OnboardingRoute) {
  const variant = useOnboardingVariant();
  return {
    variant,
    stepIndex: getStepIndex(variant, route),
    totalScreens: getTotalScreens(variant),
  };
}

/**
 * Forward navigation for an onboarding step: pushes the screen that follows
 * `current` in the active variant's flow. Screens must use this instead of
 * hardcoding their successor — A/B variants order the flow differently.
 */
export function useOnboardingNext(current: OnboardingRoute) {
  const router = useRouter();
  const variant = useOnboardingVariant();
  // Bike-dependent screens (reveal/maintenance/commitment) are skipped when the
  // rider has no bike — drives A's §4 branches off store state, not literals.
  const hasBike = useOnboardingStore((s) => !!s.bikeData?.make);
  return useCallback(() => {
    const next = getNextRoute(variant, current, { hasBike });
    if (next) router.push(next);
  }, [router, variant, current, hasBike]);
}
