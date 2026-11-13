import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  getResumeRoute,
  OB_NOTICE,
  OB_NOTICE_PARAM,
  OB_ROUTE,
  OB_SCREEN,
} from '../../config/onboarding';
import { useOnboardingVariant } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingFlowEvent } from '../../lib/onboarding-analytics';
import { meOptions } from '../../lib/query-options';
import { useOnboardingStore } from '../../stores/onboarding.store';

/**
 * The onboarding sign-in screen's move once a session exists (issue 365 T11, FS-OB1a).
 *
 * The root gate keeps (onboarding) mounted for a signed-in account that has not
 * finished onboarding, so nothing else moves the rider off "Welcome back." — on
 * 3.26.0 six of ten riders who signed in here stayed put with a valid session.
 * Like the account step (`useAccountAdvance`), wait for the server onboarding
 * state, then:
 *  - onboarded → do nothing; the gate's (tabs) guard takes the rider Home;
 *  - otherwise (or `me` failed) → replace sign-in with the step after the last
 *    one completed on this device, or Experience, carrying the "account ready"
 *    notice param.
 *
 * Opened from the account step, that step is still mounted underneath and makes
 * the move itself, so this one stays out of the way.
 */
export function useSignInAdvance(hasSession: boolean): void {
  const router = useRouter();
  const navigation = useNavigation();
  const variant = useOnboardingVariant();
  const advancedRef = useRef(false);
  const meQuery = useQuery({ ...meOptions(), enabled: hasSession });

  useEffect(() => {
    if (!hasSession || advancedRef.current) return;
    if (meQuery.isLoading && !meQuery.isError) return;
    advancedRef.current = true;

    const alreadyOnboarded =
      (meQuery.data?.me?.preferences as { onboardingCompleted?: boolean } | null | undefined)
        ?.onboardingCompleted === true;
    if (alreadyOnboarded) return;

    const accountBelow = navigation
      .getState()
      ?.routes.some((route) => route.name === OB_SCREEN.ACCOUNT);
    if (accountBelow) return;

    const { lastCompletedScreen, bikeData } = useOnboardingStore.getState();
    const resumeTarget = lastCompletedScreen
      ? getResumeRoute(variant, lastCompletedScreen, { hasBike: !!bikeData?.make })
      : null;
    // Starting from the first step is starting onboarding, as "Get started" here does.
    if (!resumeTarget) trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_STARTED, {});
    router.replace({
      pathname: resumeTarget ?? OB_ROUTE.EXPERIENCE,
      params: { [OB_NOTICE_PARAM]: OB_NOTICE.ACCOUNT_READY },
    });
  }, [hasSession, meQuery.isLoading, meQuery.isError, meQuery.data, navigation, router, variant]);
}
