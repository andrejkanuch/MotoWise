import type { RidingFrequency } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Calendar, CalendarDays, CalendarRange, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './config';

const FREQUENCY_OPTIONS: {
  value: RidingFrequency;
  icon: typeof Calendar;
  color: string;
  subtitleKey: string;
}[] = [
  {
    value: 'daily',
    icon: Calendar,
    color: '#34D399',
    subtitleKey: 'onboarding.ridingFrequencyDesc_daily',
  },
  {
    value: 'weekly',
    icon: CalendarDays,
    color: '#60A5FA',
    subtitleKey: 'onboarding.ridingFrequencyDesc_weekly',
  },
  {
    value: 'monthly',
    icon: CalendarRange,
    color: '#A78BFA',
    subtitleKey: 'onboarding.ridingFrequencyDesc_monthly',
  },
  {
    value: 'seasonally',
    icon: Sun,
    color: '#F59E0B',
    subtitleKey: 'onboarding.ridingFrequencyDesc_seasonally',
  },
];

export default function RidingFrequencyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setRidingFrequency = useOnboardingStore((s) => s.setRidingFrequency);
  const existingFrequency = useOnboardingStore((s) => s.ridingFrequency);

  const [selected, setSelected] = useState<RidingFrequency | null>(existingFrequency);

  const handlePress = (value: string) => {
    const freq = value as RidingFrequency;
    setSelected(freq);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setRidingFrequency(freq);
    setTimeout(() => {
      router.replace('/(onboarding)/riding-goals');
    }, 200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <OnboardingProgress screenIndex={8} totalScreens={TOTAL_SCREENS} />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48 }}>
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 32,
          }}
        >
          {t('onboarding.ridingFrequencyTitle')}
        </Animated.Text>

        <View style={{ gap: 10 }}>
          {FREQUENCY_OPTIONS.map((option, index) => (
            <Animated.View key={option.value} entering={FadeInUp.delay(index * 50).duration(300)}>
              <OnboardingCard
                value={option.value}
                icon={option.icon}
                label={t(`onboarding.ridingFrequency_${option.value}`)}
                subtitle={t(option.subtitleKey as any)}
                color={option.color}
                selected={selected === option.value}
                onPress={handlePress}
              />
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );
}
