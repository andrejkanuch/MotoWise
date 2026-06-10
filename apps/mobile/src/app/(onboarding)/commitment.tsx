import * as Haptics from 'expo-haptics';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { getBrandColor } from '../../config/brand-dna';
import { OB_SCREEN, OB_VARIANT } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import {
  useOnboardingNext,
  useOnboardingStep,
  useOnboardingVariant,
} from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerNotification } from '../../utils/haptics';

/** B's pledge is deliberately more effortful than A's (effort justification). */
const HOLD_MS_LEAN = 850;
const HOLD_MS_INVESTED = 1500;
const SEAL_PAUSE_MS = 950;

export default function CommitmentScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const variant = useOnboardingVariant();
  const onBack = useOnboardingBack(OB_SCREEN.COMMITMENT);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.COMMITMENT);
  const goNext = useOnboardingNext(OB_SCREEN.COMMITMENT);
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const isInvested = variant === OB_VARIANT.INVESTED;
  const holdMs = isInvested ? HOLD_MS_INVESTED : HOLD_MS_LEAN;

  const make = bikeData?.make ?? '';
  const model = bikeData?.model || undefined;
  const year = bikeData?.year ?? new Date().getFullYear() - 3;
  const brandColor = getBrandColor(make);
  const bikeName = `${year} ${make}${model ? ` ${model}` : ''}`;

  const [sealed, setSealed] = useState(false);
  const [holding, setHolding] = useState(false);
  const fill = useSharedValue(0);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.COMMITMENT);
    return () => {
      if (completeTimer.current) clearTimeout(completeTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  const complete = () => {
    setSealed(true);
    setHolding(false);
    fill.value = withTiming(1, { duration: 120 });
    triggerNotification(Haptics.NotificationFeedbackType.Success);
    setLastCompletedScreen(OB_SCREEN.COMMITMENT);
    trackOnboardingEvent(AnalyticsEvent.COMMITMENT_COMPLETED, OB_SCREEN.COMMITMENT, {
      commitment_style: isInvested ? 'hold_long' : 'hold',
    });
    advanceTimer.current = setTimeout(goNext, SEAL_PAUSE_MS);
  };

  const startHold = () => {
    if (sealed) return;
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fill.value = withTiming(1, { duration: holdMs });
    completeTimer.current = setTimeout(complete, holdMs);
  };

  const cancelHold = () => {
    if (sealed) return;
    setHolding(false);
    if (completeTimer.current) clearTimeout(completeTimer.current);
    fill.value = withTiming(0, { duration: 280 });
  };

  const skip = () => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, OB_SCREEN.COMMITMENT);
    goNext();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 12,
          paddingHorizontal: 16,
          gap: 8,
        }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={24} color={ONBOARDING_COLORS.textPrimary} />
        </Pressable>
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 11,
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            color: ONBOARDING_COLORS.warm2,
          }}
        >
          {t('onboarding.obCommitEyebrow')}
        </Text>
      </View>

      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}
      >
        {/* bike medallion */}
        <Animated.View
          entering={FadeInUp.duration(400)}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 26,
            backgroundColor: `${brandColor}1F`,
            borderWidth: 2,
            borderColor: `${brandColor}88`,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: brandColor,
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: '800', color: ONBOARDING_COLORS.textWhite }}>
              {make.charAt(0).toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(90).duration(400)}
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 30,
            lineHeight: 34,
            textAlign: 'center',
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.5,
          }}
        >
          {t('onboarding.obCommitTitle')}
          {'\n'}
          {t('onboarding.obCommitTitleOf')}{' '}
          <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
            {bikeName}
          </Text>
          .
        </Animated.Text>
        <Animated.Text
          entering={FadeInUp.delay(160).duration(400)}
          style={{
            fontSize: 14,
            color: ONBOARDING_COLORS.textSecondary,
            lineHeight: 21,
            textAlign: 'center',
            maxWidth: 320,
            marginTop: 13,
          }}
        >
          {isInvested ? t('onboarding.obCommitSupportB') : t('onboarding.obCommitSupportA')}
        </Animated.Text>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        {/* press-and-hold pledge */}
        <Pressable
          onPressIn={startHold}
          onPressOut={cancelHold}
          disabled={sealed}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.obCommitButtonIdle')}
          style={{
            height: 58,
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: ONBOARDING_COLORS.cardBg,
            borderWidth: 1,
            borderColor: sealed ? 'transparent' : ONBOARDING_COLORS.warm,
          }}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                backgroundColor: ONBOARDING_COLORS.warm,
              },
              fillStyle,
            ]}
          />
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
            }}
          >
            {sealed ? (
              <>
                <Text
                  style={{ fontSize: 16, fontWeight: '700', color: ONBOARDING_COLORS.textOnAccent }}
                >
                  {t('onboarding.obCommitButtonDone')}
                </Text>
                <Check size={19} color={ONBOARDING_COLORS.textOnAccent} strokeWidth={2.6} />
              </>
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: ONBOARDING_COLORS.textPrimary,
                }}
              >
                {holding
                  ? t('onboarding.obCommitButtonHolding')
                  : t('onboarding.obCommitButtonIdle')}
              </Text>
            )}
          </View>
        </Pressable>

        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 10,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            textAlign: 'center',
            color: sealed ? ONBOARDING_COLORS.warm2 : ONBOARDING_COLORS.textMuted,
            marginTop: 11,
          }}
        >
          {sealed ? t('onboarding.obCommitPledged') : t('onboarding.obCommitHint')}
        </Text>

        {!sealed ? (
          <Pressable onPress={skip} hitSlop={8} style={{ marginTop: 10, alignSelf: 'center' }}>
            <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.textMuted }}>
              {t('onboarding.obCommitNotNow')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
