import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { presentPaywall } from '../../lib/subscription';

export default function PaywallScreen() {
  const router = useRouter();

  useEffect(() => {
    const show = async () => {
      trackEvent(AnalyticsEvent.PAYWALL_VIEWED, {
        source: 'onboarding',
        feature: 'onboarding_completion',
      });

      const result = await presentPaywall();

      if (result === 'purchased' || result === 'restored') {
        trackEvent(AnalyticsEvent.PURCHASE_COMPLETED, {
          source: 'onboarding',
          feature: 'onboarding_completion',
        });
      }

      // Always proceed to welcome-home regardless of purchase result
      router.replace('/(onboarding)/welcome-home');
    };

    show();
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }} />;
}
