import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { presentPaywall } from '../../lib/subscription';

const isExpoGo = Constants.appOwnership === 'expo';

export default function PaywallScreen() {
  const router = useRouter();
  const presented = useRef(false);

  useEffect(() => {
    if (presented.current) return;
    presented.current = true;

    if (isExpoGo) {
      // Skip paywall in Expo Go — IAP not available
      trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
        step: 'paywall',
        step_index: 10,
        paywall_result: 'skipped_expo_go',
      });
      router.replace('/(onboarding)/personalizing');
      return;
    }

    trackEvent(AnalyticsEvent.PAYWALL_VIEWED, { source: 'onboarding' });

    (async () => {
      const result = await presentPaywall({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_PRO,
      });

      trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
        step: 'paywall',
        step_index: 10,
        paywall_result: result,
      });

      if (result === 'purchased') {
        trackEvent(AnalyticsEvent.PURCHASE_COMPLETED, { source: 'onboarding' });
      } else if (result === 'restored') {
        trackEvent(AnalyticsEvent.SUBSCRIPTION_RESTORED, { source: 'onboarding' });
      } else if (result === 'cancelled') {
        trackEvent(AnalyticsEvent.PAYWALL_DISMISSED, {
          source: 'onboarding',
          reason: 'user_cancelled',
        });
      }

      // Navigate forward regardless of result — user can always continue free
      // The RevenueCat listener in subscription.ts will update the store if purchased
      router.replace('/(onboarding)/personalizing');
    })();
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={10} totalScreens={TOTAL_SCREENS} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ONBOARDING_COLORS.accent} />
      </View>
    </View>
  );
}
