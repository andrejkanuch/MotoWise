import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import {
  GOAL_TO_PLACEMENT,
  getPrimaryGoal,
  MAINTENANCE_INTENT_PLACEMENT,
  OB_SCREEN,
} from '../../config/onboarding';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { isMaintenanceIntent } from '../../lib/pending-intent';
import { presentPaywall, setOnboardingAttributes } from '../../lib/subscription';
import { useOnboardingStore } from '../../stores/onboarding.store';

const isExpoGo = Constants.appOwnership === 'expo';

export default function PaywallScreen() {
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.PAYWALL);
  const goNext = useOnboardingNext(OB_SCREEN.PAYWALL);
  const presented = useRef(false);
  const ridingGoals = useOnboardingStore((s) => s.ridingGoals);
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const experienceLevel = useOnboardingStore((s) => s.experienceLevel);
  const pendingIntent = useOnboardingStore((s) => s.pendingIntent);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  useEffect(() => {
    if (presented.current) return;
    presented.current = true;

    const primaryGoal = getPrimaryGoal(ridingGoals);
    // Maintenance-intent riders (arrived from a bike's service-schedule article)
    // get the reminder-led paywall placement instead of the goal-derived one
    // (P3.2). The paywall still runs AFTER first value — placement only, no
    // reordering. Falls back to the current offering if the placement is absent.
    const placement = isMaintenanceIntent(pendingIntent)
      ? MAINTENANCE_INTENT_PLACEMENT
      : GOAL_TO_PLACEMENT[primaryGoal];
    const goalsJoined = ridingGoals.join(',');

    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.PAYWALL);

    if (isExpoGo) {
      // Skip paywall in Expo Go — IAP not available
      setLastCompletedScreen(OB_SCREEN.PAYWALL);
      trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.PAYWALL, {
        paywall_result: 'skipped_expo_go',
        goals: goalsJoined,
        primary_goal: primaryGoal,
        placement,
      });
      goNext();
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
      trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.PAYWALL, {
        paywall_result: result,
        goals: goalsJoined,
        primary_goal: primaryGoal,
        placement,
      });

      // Navigate forward regardless of result — user can always continue free
      // The RevenueCat listener in subscription.ts will update the store if purchased
      goNext();
    })();
  }, [goNext, ridingGoals, bikeData, experienceLevel, pendingIntent, setLastCompletedScreen]);

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ONBOARDING_COLORS.accent} />
      </View>
    </View>
  );
}
