import { useEffect } from 'react';
import {
  type AuthGateInput,
  shouldRenderAuthGroup,
  shouldRenderRestoring,
} from '../lib/auth-hydration';
import { GATE_GROUP, resolveGateGroup, trackGateRoutedOnce } from '../lib/onboarding-nav-analytics';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';

interface MeQueryState {
  data?: unknown;
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
 * (issue 365 T04b). Mirrors the gate's own `Stack.Protected` guards. Whenever the
 * gate opens (tabs), the onboarding resume point is cleared, so a later
 * `auth_session_lost` does not count a finished rider as mid-onboarding.
 */
export function useGateRoutedTracking({
  holding,
  gateInput,
  onboardingCompleted,
  meQuery,
}: GateRoutedTrackingInput) {
  const storeOnboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const { data, dataUpdatedAt } = meQuery;

  useEffect(() => {
    if (holding) return;
    const { isSignedIn, isAnonOnboarding } = gateInput;
    const group = resolveGateGroup({
      restoring: shouldRenderRestoring(gateInput),
      auth: shouldRenderAuthGroup(gateInput),
      onboarding: isAnonOnboarding || (isSignedIn && !onboardingCompleted),
      tabs: isSignedIn && onboardingCompleted,
    });
    if (group === GATE_GROUP.TABS) useOnboardingStore.getState().clearResumePoint();
    trackGateRoutedOnce({
      group,
      storeOnboardingCompleted,
      hasMe: data !== undefined,
      meUpdatedAt: dataUpdatedAt,
    });
  }, [holding, gateInput, onboardingCompleted, storeOnboardingCompleted, data, dataUpdatedAt]);
}
