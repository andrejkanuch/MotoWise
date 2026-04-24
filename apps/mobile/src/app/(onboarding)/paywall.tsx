import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { presentPaywall } from '../../lib/subscription';

export default function PaywallScreen() {
  const router = useRouter();
  const hasNavigated = useRef(false);

  useEffect(() => {
    const show = async () => {
      trackEvent(AnalyticsEvent.PAYWALL_VIEWED, {
        source: 'onboarding',
        feature: 'onboarding_completion',
      });

      try {
        const result = await presentPaywall();
        console.log('[Paywall] Result:', result);

        if (result === 'purchased' || result === 'restored') {
          trackEvent(AnalyticsEvent.PURCHASE_COMPLETED, {
            source: 'onboarding',
            feature: 'onboarding_completion',
          });
        }
      } catch (err) {
        console.warn('[Paywall] Failed to present:', err);
      }

      if (!hasNavigated.current) {
        hasNavigated.current = true;
        router.replace('/(onboarding)/welcome-home');
      }
    };

    show();
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }} />;
}
