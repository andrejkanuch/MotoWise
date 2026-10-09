/**
 * OFF-FLOW as of 2026-08-24 (U6). This screen is in NO onboarding flow.
 *
 * Removed as friction, on the most decisive number in the audit: 40 riders saw
 * it, **0** completed it, 40 skipped. Retained as a route for riders caught
 * mid-flow by the OTA; `getNextRoute` resolves it forward to `personalizing`
 * (RETIRED_SCREEN_SUCCESSOR). `useOnboardingStep` returns stepIndex -1 here.
 *
 * Receipt scanning itself is live and used from the expenses flow — the feature
 * is fine, the placement was not.
 */
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { Clock, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { OB_SCREEN } from '../../config/onboarding';
import { MODAL_ROUTE } from '../../config/routes';
import {
  SCAN_ENTRY_SURFACE,
  type TranslationKey,
} from '../../features/receipt-scan/scan-flow-constants';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { radius, space, type } from '../../theme/type';

/**
 * Onboarding "snap a receipt" step (U8 — activation Goal 7 / G6).
 *
 * Invites the rider to try the receipt scanner once. The scan launches with
 * `is_onboarding: true` so it is quota-exempt (KTD-10) and uses the U7c zero-bike
 * path — onboarding riders may not have a server-side bike yet. The step NEVER
 * blocks onboarding completion: "Maybe later" advances immediately, and after the
 * scan modal closes (saved, parked, or cancelled) the step auto-advances on focus.
 * The `ONBOARDING_SCAN_COMPLETED` activation event fires inside the scan flow on a
 * completed extraction, not here.
 */

interface ValueBullet {
  readonly icon: typeof Clock;
  readonly labelKey: string;
}

const VALUE_BULLETS: readonly ValueBullet[] = [
  { icon: Sparkles, labelKey: 'onboarding.scanBulletExtract' },
  { icon: Clock, labelKey: 'onboarding.scanBulletFast' },
] as const;

export default function OnboardingScanReceiptScreen() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const router = useRouter();
  const onBack = useOnboardingBack(OB_SCREEN.SCAN_RECEIPT);
  const goNext = useOnboardingNext(OB_SCREEN.SCAN_RECEIPT);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  // Set once the scan modal is launched; the return-focus effect reads it to
  // advance exactly once. A separate latch prevents a double advance if both the
  // focus effect and an explicit action fire.
  const launchedRef = useRef(false);
  const advancedRef = useRef(false);

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.SCAN_RECEIPT);
  }, []);

  const advance = useCallback(
    (opts?: { replace?: boolean }) => {
      if (advancedRef.current) return;
      advancedRef.current = true;
      setLastCompletedScreen(OB_SCREEN.SCAN_RECEIPT);
      goNext(opts);
    },
    [goNext, setLastCompletedScreen],
  );

  // Back from the scan modal → continue the flow (never strand the rider here).
  useFocusEffect(
    useCallback(() => {
      if (launchedRef.current) advance({ replace: true });
    }, [advance]),
  );

  const handleScan = () => {
    launchedRef.current = true;
    router.push({
      pathname: MODAL_ROUTE.SCAN_RECEIPT,
      params: { is_onboarding: 'true', surface: SCAN_ENTRY_SURFACE.ONBOARDING },
    } as Href);
  };

  const handleSkip = () => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, OB_SCREEN.SCAN_RECEIPT);
    advance();
  };

  return (
    <OnboardingShell
      screen={OB_SCREEN.SCAN_RECEIPT}
      onBack={onBack}
      title={t('onboarding.scanHeadline')}
      subtitle={t('onboarding.scanSubtitle')}
      primary={{ label: t('onboarding.scanCta'), onPress: handleScan }}
      secondary={{ label: t('onboarding.scanSkip'), onPress: handleSkip }}
    >
      <View
        style={{
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: oc.surface,
          overflow: 'hidden',
        }}
      >
        {VALUE_BULLETS.map((bullet, index) => {
          const Icon = bullet.icon;
          return (
            <View
              key={bullet.labelKey}
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: oc.line,
              }}
            >
              <Icon size={18} color={oc.textSecondary} />
              <Text style={[type.body, { flex: 1, color: oc.textPrimary }]}>
                {t(bullet.labelKey as TranslationKey)}
              </Text>
            </View>
          );
        })}
      </View>
    </OnboardingShell>
  );
}
