import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import {
  GOAL_TO_PLACEMENT,
  getPrimaryGoal,
  OB_ROUTE,
  OB_SCREEN,
  TOTAL_SCREENS,
} from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { presentPaywall, setOnboardingAttributes } from '../../lib/subscription';
import { useOnboardingStore } from '../../stores/onboarding.store';

const isExpoGo = Constants.appOwnership === 'expo';

export default function PaywallScreen() {
  const router = useRouter();
  const presented = useRef(false);
  const ridingGoals = useOnboardingStore((s) => s.ridingGoals);
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const experienceLevel = useOnboardingStore((s) => s.experienceLevel);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  useEffect(() => {
    if (presented.current) return;
    presented.current = true;

    const primaryGoal = getPrimaryGoal(ridingGoals);
    const placement = GOAL_TO_PLACEMENT[primaryGoal];
    const goalsJoined = ridingGoals.join(',');

    trackEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, {
      step: 'paywall',
      step_index: 5,
    });

    if (isExpoGo) {
      // Skip paywall in Expo Go — IAP not available
      setLastCompletedScreen(OB_SCREEN.PAYWALL);
      trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
        step: 'paywall',
        step_index: 5,
        paywall_result: 'skipped_expo_go',
        goals: goalsJoined,
        primary_goal: primaryGoal,
        placement,
      });
      router.push(OB_ROUTE.NOTIFICATIONS);
      return;
    }

    (async () => {
      const personalization = {
        primaryGoal,
        bikeMake: bikeData?.make,
        bikeModel: bikeData?.model,
        bikeYear: bikeData?.year,
        experience: experienceLevel,
      };

      // Customer attributes drive targeting (placement/audiences); they are NOT
      // substituted into paywall text.
      await setOnboardingAttributes(personalization);

      // Paywall copy is personalized via custom variables ({{ custom.* }}) — the
      // same answers are passed through `personalization` here.
      const result = await presentPaywall({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_PRO,
        placement,
        personalization,
        source: 'onboarding',
        feature: 'subscription',
        surface: 'onboarding_paywall',
      });

      setLastCompletedScreen(OB_SCREEN.PAYWALL);
      trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
        step: 'paywall',
        step_index: 5,
        paywall_result: result,
        goals: goalsJoined,
        primary_goal: primaryGoal,
        placement,
      });

      // Navigate forward regardless of result — user can always continue free
      // The RevenueCat listener in subscription.ts will update the store if purchased
      router.push(OB_ROUTE.NOTIFICATIONS);
    })();
  }, [router, ridingGoals, bikeData, experienceLevel, setLastCompletedScreen]);

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={5} totalScreens={TOTAL_SCREENS} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ONBOARDING_COLORS.accent} />
      </View>
    </View>
  );
}
