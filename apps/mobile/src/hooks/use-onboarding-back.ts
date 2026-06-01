import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { getPreviousRoute, type OnboardingRoute } from '../config/onboarding';

/**
 * Returns a Back handler for an onboarding screen that pops the navigation
 * stack when possible, and otherwise replaces with the previous onboarding
 * step.
 *
 * The fallback matters after resume-after-kill: the welcome screen drops the
 * user onto a mid-flow screen via `router.replace`, which collapses the stack
 * to a single entry. A bare `router.back()` there throws
 * "GO_BACK was not handled by any navigator". Deriving the previous step from
 * the ordered screen list keeps Back working in every entry path.
 */
export function useOnboardingBack(current: OnboardingRoute) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    const previous = getPreviousRoute(current);
    if (previous) router.replace(previous);
  }, [router, current]);
}
