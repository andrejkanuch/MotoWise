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
  TOTAL_SCREENS,
} from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { presentPaywall } from '../../lib/subscription';
import { useOnboardingStore } from '../../stores/onboarding.store';

const isExpoGo = Constants.appOwnership === 'expo';

export default function PaywallScreen() {
  const router = useRouter();
  const presented = useRef(false);
  const ridingGoals = useOnboardingStore((s) => s.ridingGoals);

  useEffect(() => {
    if (presented.current) return;
    presented.current = true;

    const primaryGoal = getPrimaryGoal(ridingGoals);
    const placement = GOAL_TO_PLACEMENT[primaryGoal];

    if (isExpoGo) {
      // Skip paywall in Expo Go — IAP not available
      trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
        step: 'paywall',
        step_index: 4,
        lastCompletedScreen: 'paywall',
        paywall_result: 'skipped_expo_go',
        goals: ridingGoals,
        placement,
      });
      router.push(OB_ROUTE.NOTIFICATIONS);
      return;
    }

    (async () => {
      const result = await presentPaywall({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_PRO,
        placement,
        source: 'onboarding',
        feature: 'subscription',
        surface: 'onboarding_paywall',
      });

      trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
        step: 'paywall',
        step_index: 4,
        lastCompletedScreen: 'paywall',
        paywall_result: result,
        goals: ridingGoals,
        placement,
      });

      // Navigate forward regardless of result — user can always continue free
      // The RevenueCat listener in subscription.ts will update the store if purchased
      router.push(OB_ROUTE.NOTIFICATIONS);
    })();
  }, [router, ridingGoals]);

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={4} totalScreens={TOTAL_SCREENS} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ONBOARDING_COLORS.accent} />
      </View>
    </View>
  );
}
