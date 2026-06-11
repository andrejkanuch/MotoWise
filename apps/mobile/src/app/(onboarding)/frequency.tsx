import { RidingFrequency } from '@motovault/types';
import { NotificationFeedbackType } from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { Calendar, CalendarClock, Gauge, Sun } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerNotification } from '../../utils/haptics';

const FREQUENCY_OPTIONS = [
  {
    id: RidingFrequency.DAILY,
    labelKey: 'obFreqDaily',
    subKey: 'obFreqDailySub',
    previewKey: 'obFreqDailyPreview',
    affirmKey: 'obFreqDailyAffirm',
    icon: Gauge,
  },
  {
    id: RidingFrequency.WEEKLY,
    labelKey: 'obFreqWeekly',
    subKey: 'obFreqWeeklySub',
    previewKey: 'obFreqWeeklyPreview',
    affirmKey: 'obFreqWeeklyAffirm',
    icon: Calendar,
  },
  {
    id: RidingFrequency.MONTHLY,
    labelKey: 'obFreqMonthly',
    subKey: 'obFreqMonthlySub',
    previewKey: 'obFreqMonthlyPreview',
    affirmKey: 'obFreqMonthlyAffirm',
    icon: CalendarClock,
  },
  {
    id: RidingFrequency.SEASONALLY,
    labelKey: 'obFreqSeasonally',
    subKey: 'obFreqSeasonallySub',
    previewKey: 'obFreqSeasonallyPreview',
    affirmKey: 'obFreqSeasonallyAffirm',
    icon: Sun,
  },
] as const;

const ADVANCE_DELAY_MS = 1000;

/* ─── Eyebrow pill (mirrors experience.tsx) ─── */

function EyebrowPill({ label }: { label: string }) {
  const dotScale = useSharedValue(1);

  useEffect(() => {
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [dotScale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(500)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: `${ONBOARDING_COLORS.warm}1F`,
        borderWidth: 1,
        borderColor: `${ONBOARDING_COLORS.warm}4D`,
        marginBottom: 14,
      }}
    >
      <Animated.View
        style={[
          { width: 4, height: 4, borderRadius: 2, backgroundColor: ONBOARDING_COLORS.warm2 },
          dotStyle,
        ]}
      />
      <Text
        style={{
          fontFamily: 'GeistMono-Medium',
          fontSize: 9.5,
          fontWeight: '600',
          letterSpacing: 1.7,
          textTransform: 'uppercase',
          color: ONBOARDING_COLORS.warm2,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

/* ─── Pulsing affirmation dot (mirrors experience.tsx AffirmDot) ─── */

function AffirmDot() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        { width: 5, height: 5, borderRadius: 2.5, backgroundColor: ONBOARDING_COLORS.warm2 },
        animStyle,
      ]}
    />
  );
}

export default function FrequencyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const onBack = useOnboardingBack(OB_SCREEN.FREQUENCY);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.FREQUENCY);
  const goNext = useOnboardingNext(OB_SCREEN.FREQUENCY);
  const setRidingFrequency = useOnboardingStore((s) => s.setRidingFrequency);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const [pending, setPending] = useState<RidingFrequency | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.FREQUENCY);
  }, []);

  // Reset pending state when returning to this screen
  useFocusEffect(
    useCallback(() => {
      setPending(null);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }, []),
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSelect = (id: RidingFrequency) => {
    if (pending) return;
    triggerNotification(NotificationFeedbackType.Success);
    setPending(id);
    setRidingFrequency(id);
    setLastCompletedScreen(OB_SCREEN.FREQUENCY);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.FREQUENCY, {
      riding_frequency: id,
    });
    timerRef.current = setTimeout(goNext, ADVANCE_DELAY_MS);
  };

  const handleBack = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <OnboardingBackButton
        onPress={handleBack}
        style={{ position: 'absolute', top: insets.top + 44, left: 16, zIndex: 10 }}
      />

      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 72,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <EyebrowPill label={t('onboarding.obFreqEyebrow')} />
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 34,
              lineHeight: 36,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.7,
            }}
          >
            {t('onboarding.obFreqTitle')}{' '}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              {t('onboarding.obFreqTitleItalic')}
            </Text>
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: ONBOARDING_COLORS.textSecondary,
              lineHeight: 20,
              marginTop: 10,
              maxWidth: 320,
            }}
          >
            {t('onboarding.obFreqWhy')}
          </Text>
        </Animated.View>

        <View style={{ flex: 1, justifyContent: 'center', gap: 10 }}>
          {FREQUENCY_OPTIONS.map((option, index) => {
            const Icon = option.icon;
            const active = pending === option.id;
            const dimmed = pending !== null && !active;
            return (
              <Animated.View
                key={option.id}
                entering={FadeInUp.delay(200 + index * 70).duration(320)}
                style={{ opacity: dimmed ? 0.4 : 1 }}
              >
                <Pressable
                  onPress={() => handleSelect(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${t(`onboarding.${option.labelKey}`)}, ${t(`onboarding.${option.subKey}`)}`}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    backgroundColor: active ? ONBOARDING_COLORS.accentBg : ONBOARDING_COLORS.cardBg,
                    borderWidth: active ? 2 : 1,
                    borderColor: active
                      ? ONBOARDING_COLORS.warm
                      : ONBOARDING_COLORS.cardBorderDefault,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 13,
                        borderCurve: 'continuous',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active
                          ? ONBOARDING_COLORS.warm
                          : ONBOARDING_COLORS.surface2,
                      }}
                    >
                      <Icon
                        size={21}
                        color={active ? ONBOARDING_COLORS.textOnAccent : ONBOARDING_COLORS.warm2}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15.5,
                          fontWeight: '600',
                          color: ONBOARDING_COLORS.textPrimary,
                        }}
                      >
                        {t(`onboarding.${option.labelKey}`)}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'GeistMono-Medium',
                          fontSize: 10,
                          letterSpacing: 1.6,
                          textTransform: 'uppercase',
                          color: active ? ONBOARDING_COLORS.warm2 : ONBOARDING_COLORS.ink3,
                          marginTop: 3,
                        }}
                      >
                        {t(`onboarding.${option.subKey}`)}
                      </Text>
                    </View>
                  </View>

                  {/* Preview / "why" line — always visible */}
                  <Text
                    style={{
                      fontSize: 12.5,
                      lineHeight: 18,
                      fontStyle: 'italic',
                      color: active ? ONBOARDING_COLORS.textBright : ONBOARDING_COLORS.textSoft,
                      marginTop: 10,
                      paddingLeft: 58,
                    }}
                  >
                    {t(`onboarding.${option.previewKey}` as never)}
                  </Text>

                  {/* Affirmation — only after selection */}
                  {active && (
                    <Animated.View
                      entering={FadeInUp.duration(260)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 10,
                        paddingLeft: 58,
                      }}
                    >
                      <AffirmDot />
                      <Text
                        style={{ fontSize: 13, color: ONBOARDING_COLORS.warm2, fontWeight: '500' }}
                      >
                        {t(`onboarding.${option.affirmKey}` as never)}
                      </Text>
                    </Animated.View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 11,
            letterSpacing: 0.6,
            color: ONBOARDING_COLORS.ink3,
            textAlign: 'center',
          }}
        >
          {t('onboarding.obFreqProof')}
        </Text>
      </View>
    </View>
  );
}
