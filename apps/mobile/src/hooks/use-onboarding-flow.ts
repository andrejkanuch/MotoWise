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
  return useCallback(() => {
    // Bike-dependent screens (reveal/maintenance/commitment) are skipped when the
    // rider has no bike. Read the flag at CALL time — bike-setup calls
    // setBikeData() then goNext() synchronously, so a value captured from the
    // render would be stale (false) and wrongly skip the Reveal. Zustand's
    // set() is synchronous, so getState() already reflects the just-saved bike.
    const hasBike = !!useOnboardingStore.getState().bikeData?.make;
    const next = getNextRoute(variant, current, { hasBike });
    if (next) router.push(next);
  }, [router, variant, current]);
}
