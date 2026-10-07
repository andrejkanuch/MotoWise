import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  getNextRoute,
  getVisibleProgress,
  OB_VARIANT,
  type ObVariant,
  type OnboardingRoute,
} from '../config/onboarding';
import { useExperimentStore } from '../stores/experiment.store';
import { useOnboardingStore } from '../stores/onboarding.store';

/**
 * Reactive onboarding variant. `shipped` (the paywall-free flow) while
 * unassigned, matching `getOnboardingVariant`. In practice `(onboarding)/_layout`
 * blocks rendering until assignment, so step screens always see the real variant.
 */
export function useOnboardingVariant(): ObVariant {
  return useExperimentStore((s) => s.onboardingVariant) ?? OB_VARIANT.SHIPPED;
}

/**
 * Progress-bar coordinates of a screen over the screens this rider actually
 * sees (bike state decides whether reveal/commitment or no-bike-value show), so
 * the bar ends full instead of skipping or overshooting segments.
 */
export function useOnboardingStep(route: OnboardingRoute) {
  const variant = useOnboardingVariant();
  const hasBike = useOnboardingStore((s) => !!s.bikeData?.make);
  const { index, total } = getVisibleProgress(variant, route, { hasBike });
  return { variant, stepIndex: index, totalScreens: total };
}

/**
 * Forward navigation for an onboarding step: pushes the screen that follows
 * `current` in the active variant's flow. Screens must use this instead of
 * hardcoding their successor — A/B variants order the flow differently.
 */
export function useOnboardingNext(current: OnboardingRoute) {
  const router = useRouter();
  const variant = useOnboardingVariant();
  // `opts.replace` is for pass-through steps (e.g. maintenance with no OEM
  // schedules) that auto-advance: replacing instead of pushing drops them from
  // history so Back skips over them rather than re-triggering the auto-advance.
  return useCallback(
    (opts?: { replace?: boolean }) => {
      // Bike-dependent screens (reveal/maintenance/commitment) are skipped when the
      // rider has no bike. Read the flag at CALL time — bike-setup calls
      // setBikeData() then goNext() synchronously, so a value captured from the
      // render would be stale (false) and wrongly skip the Reveal. Zustand's
      // set() is synchronous, so getState() already reflects the just-saved bike.
      const hasBike = !!useOnboardingStore.getState().bikeData?.make;
      const next = getNextRoute(variant, current, { hasBike });
      if (!next) return;
      if (opts?.replace === true) router.replace(next);
      else router.push(next);
    },
    [router, variant, current],
  );
}
