import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { presentPaywall } from '../../lib/subscription';
import { TOTAL_SCREENS } from './_config';

const isExpoGo = Constants.appOwnership === 'expo';

export default function PaywallScreen() {
  const router = useRouter();
  const presented = useRef(false);

  useEffect(() => {
    if (presented.current) return;
    presented.current = true;

    if (isExpoGo) {
      // Skip paywall in Expo Go — IAP not available
      router.replace('/(onboarding)/personalizing');
      return;
    }

    (async () => {
      await presentPaywall({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_PRO,
      });

      // Navigate forward regardless of result — user can always continue free
      // The RevenueCat listener in subscription.ts will update the store if purchased
      router.replace('/(onboarding)/personalizing');
    })();
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={15} totalScreens={TOTAL_SCREENS} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ONBOARDING_COLORS.accent} />
      </View>
    </View>
  );
}
