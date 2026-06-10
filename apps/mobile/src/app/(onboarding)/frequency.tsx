import { RidingFrequency } from '@motovault/types';
import { Calendar, CalendarClock, ChevronLeft, Gauge, Sun } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerImpact } from '../../utils/haptics';

const FREQUENCY_OPTIONS = [
  { id: RidingFrequency.DAILY, labelKey: 'obFreqDaily', subKey: 'obFreqDailySub', icon: Gauge },
  {
    id: RidingFrequency.WEEKLY,
    labelKey: 'obFreqWeekly',
    subKey: 'obFreqWeeklySub',
    icon: Calendar,
  },
  {
    id: RidingFrequency.MONTHLY,
    labelKey: 'obFreqMonthly',
    subKey: 'obFreqMonthlySub',
    icon: CalendarClock,
  },
  {
    id: RidingFrequency.SEASONALLY,
    labelKey: 'obFreqSeasonally',
    subKey: 'obFreqSeasonallySub',
    icon: Sun,
  },
] as const;

const ADVANCE_DELAY_MS = 700;

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
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSelect = (id: RidingFrequency) => {
    if (pending) return;
    triggerImpact();
    setPending(id);
    setRidingFrequency(id);
    setLastCompletedScreen(OB_SCREEN.FREQUENCY);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.FREQUENCY, {
      riding_frequency: id,
    });
    timerRef.current = setTimeout(goNext, ADVANCE_DELAY_MS);
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: insets.top + 44,
          left: 16,
          zIndex: 10,
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronLeft size={24} color={ONBOARDING_COLORS.textPrimary} />
      </Pressable>

      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 72,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 11,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.warm2,
              marginBottom: 12,
            }}
          >
            {t('onboarding.obFreqEyebrow')}
          </Text>
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
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 14,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    backgroundColor: active
                      ? ONBOARDING_COLORS.cardBgSelected
                      : ONBOARDING_COLORS.cardBg,
                    borderWidth: 1,
                    borderColor: active
                      ? ONBOARDING_COLORS.warm
                      : ONBOARDING_COLORS.cardBorderDefault,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      borderCurve: 'continuous',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? ONBOARDING_COLORS.warm : ONBOARDING_COLORS.surface2,
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
