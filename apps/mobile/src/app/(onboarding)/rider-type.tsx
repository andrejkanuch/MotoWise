import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Bike, ChevronLeft, Library, Map as MapIcon, Wrench } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

const SCREEN_INDEX = 1;

const RIDER_OPTIONS = [
  { value: 'daily_rider' as const, icon: Bike, color: ONBOARDING_COLORS.success },
  { value: 'tourer' as const, icon: MapIcon, color: ONBOARDING_COLORS.warm },
  { value: 'wrench' as const, icon: Wrench, color: '#A78BFA' },
  { value: 'collector' as const, icon: Library, color: ONBOARDING_COLORS.accent },
];

export default function RiderTypeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setRiderType = useOnboardingStore((s) => s.setRiderType);
  const [selected, setSelected] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const handleSelect = useCallback(
    (value: string) => {
      if (selected) return;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      setSelected(value);

      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      setRiderType(value as 'daily_rider' | 'tourer' | 'wrench' | 'collector');
      trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
        step: 'rider_type',
        value,
      });

      advanceTimer.current = setTimeout(() => {
        router.replace('/(onboarding)/your-bike');
      }, 300);
    },
    [selected, setRiderType, router],
  );

  const labelMap: Record<string, string> = {
    daily_rider: t('onboarding.dailyRider'),
    tourer: t('onboarding.tourer'),
    wrench: t('onboarding.wrenchAtHeart'),
    collector: t('onboarding.collector'),
  };

  const subtitleMap: Record<string, string> = {
    daily_rider: t('onboarding.dailyRiderDesc'),
    tourer: t('onboarding.tourerDesc'),
    wrench: t('onboarding.wrenchAtHeartDesc'),
    collector: t('onboarding.collectorDesc'),
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={SCREEN_INDEX} totalScreens={TOTAL_SCREENS} />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <ChevronLeft size={22} color={ONBOARDING_COLORS.textSecondary} />
      </Pressable>

      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 24 }}>
        {/* Title */}
        <Animated.View entering={FadeIn.delay(100).duration(250)}>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 40,
              lineHeight: 44,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.8,
              marginBottom: 8,
            }}
          >
            What kind of rider{'\n'}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                color: ONBOARDING_COLORS.warm2,
              }}
            >
              are you?
            </Text>
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.Text
          entering={FadeIn.delay(150).duration(250)}
          style={{
            fontSize: 15,
            lineHeight: 21,
            color: ONBOARDING_COLORS.textSecondary,
            marginBottom: 32,
          }}
        >
          {t('onboarding.riderTypeSubtitle')}
        </Animated.Text>

        {/* Options */}
        <View style={{ gap: 12 }}>
          {RIDER_OPTIONS.map((option, index) => (
            <Animated.View
              key={option.value}
              entering={FadeInDown.delay(200 + index * 50).duration(250)}
            >
              <OnboardingCard
                value={option.value}
                icon={option.icon}
                label={labelMap[option.value]}
                subtitle={subtitleMap[option.value]}
                color={option.color}
                selected={selected === option.value}
                onPress={handleSelect}
              />
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={{ paddingBottom: insets.bottom + 16 }} />
    </View>
  );
}
