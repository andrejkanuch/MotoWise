import { useEffect } from 'react';
import {
  type AuthGateInput,
  shouldRenderAuthGroup,
  shouldRenderRestoring,
} from '../lib/auth-hydration';
import { resolveGateGroup, trackGateRoutedOnce } from '../lib/onboarding-nav-analytics';
import { useAuthStore } from '../stores/auth.store';

interface MeQueryState {
  data?: unknown;
  isFetchedAfterMount: boolean;
  dataUpdatedAt: number;
}

interface GateRoutedTrackingInput {
  /** The gate is still holding the splash; nothing is routed yet. */
  holding: boolean;
  gateInput: AuthGateInput;
  /** The gate's effective flag: local OR server. */
  onboardingCompleted: boolean;
  meQuery: MeQueryState;
}

/**
 * `gate_routed` once per cold start, the first time the root NavigationGate
 * settles: which group it opened and which input decided onboarding completion
 * (issue 365 T04b). Mirrors the gate's own `Stack.Protected` guards.
 */
export function useGateRoutedTracking({
  holding,
  gateInput,
  onboardingCompleted,
  meQuery,
}: GateRoutedTrackingInput) {
  const storeOnboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const { data, isFetchedAfterMount, dataUpdatedAt } = meQuery;

  useEffect(() => {
    if (holding) return;
    const { isSignedIn, isAnonOnboarding } = gateInput;
    const group = resolveGateGroup({
      restoring: shouldRenderRestoring(gateInput),
      auth: shouldRenderAuthGroup(gateInput),
      onboarding: isAnonOnboarding || (isSignedIn && !onboardingCompleted),
      tabs: isSignedIn && onboardingCompleted,
    });
    trackGateRoutedOnce({
      group,
      storeOnboardingCompleted,
      hasMe: data !== undefined,
      meFetchedAfterMount: isFetchedAfterMount,
      meUpdatedAt: dataUpdatedAt,
    });
  }, [
    holding,
    gateInput,
    onboardingCompleted,
    storeOnboardingCompleted,
    data,
    isFetchedAfterMount,
    dataUpdatedAt,
  ]);
}
