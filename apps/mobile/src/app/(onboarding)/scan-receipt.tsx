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
import { Clock, ScanLine, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_SCREEN } from '../../config/onboarding';
import { MODAL_ROUTE } from '../../config/routes';
import {
  SCAN_ENTRY_SURFACE,
  type TranslationKey,
} from '../../features/receipt-scan/scan-flow-constants';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

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
  readonly icon: typeof ScanLine;
  readonly labelKey: string;
}

const VALUE_BULLETS: readonly ValueBullet[] = [
  { icon: Sparkles, labelKey: 'onboarding.scanBulletExtract' },
  { icon: Clock, labelKey: 'onboarding.scanBulletFast' },
] as const;

export default function OnboardingScanReceiptScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const onBack = useOnboardingBack(OB_SCREEN.SCAN_RECEIPT);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.SCAN_RECEIPT);
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
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <OnboardingBackButton
        onPress={onBack}
        style={{ position: 'absolute', top: insets.top + 44, left: 16, zIndex: 10 }}
      />

      <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 96 }}>
        <Animated.View
          entering={FadeInUp.duration(280)}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 5,
            paddingHorizontal: 11,
            borderRadius: 999,
            borderCurve: 'continuous',
            backgroundColor: ONBOARDING_COLORS.accentBg,
            borderWidth: 1,
            borderColor: ONBOARDING_COLORS.warm,
            marginBottom: 14,
          }}
        >
          <ScanLine size={13} color={ONBOARDING_COLORS.warm2} />
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 10,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.warm2,
            }}
          >
            {t('onboarding.scanEyebrow')}
          </Text>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(70).duration(280)}
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 34,
            lineHeight: 37,
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.7,
            marginBottom: 12,
          }}
        >
          {t('onboarding.scanTitle')}{' '}
          <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
            {t('onboarding.scanTitleAccent')}
          </Text>
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(130).duration(280)}
          style={{
            fontSize: 14.5,
            color: ONBOARDING_COLORS.textSecondary,
            lineHeight: 21,
            marginBottom: 26,
          }}
        >
          {t('onboarding.scanSubtitle')}
        </Animated.Text>

        <View style={{ gap: 14 }}>
          {VALUE_BULLETS.map((bullet, index) => {
            const Icon = bullet.icon;
            return (
              <Animated.View
                key={bullet.labelKey}
                entering={FadeInUp.delay(180 + index * 60).duration(280)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${ONBOARDING_COLORS.warm2}26`,
                  }}
                >
                  <Icon size={17} color={ONBOARDING_COLORS.warm2} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14.5,
                    color: ONBOARDING_COLORS.textPrimary,
                    lineHeight: 20,
                  }}
                >
                  {t(bullet.labelKey as TranslationKey)}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: ONBOARDING_COLORS.background,
        }}
      >
        <OnboardingContinueButton label={t('onboarding.scanCta')} onPress={handleScan} />
        <Pressable
          onPress={handleSkip}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.scanSkip')}
          style={{ marginTop: 12, alignSelf: 'center' }}
        >
          <Text style={{ fontSize: 13.5, color: ONBOARDING_COLORS.textMuted }}>
            {t('onboarding.scanSkip')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
