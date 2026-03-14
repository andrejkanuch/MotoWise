import { palette } from '@motovault/design-system';
import type { ExperienceLevel } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Bike, Flame, Gauge } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './_config';

const EXPERIENCE_LEVELS = [
  {
    key: 'beginner' as ExperienceLevel,
    descKey: 'beginnerDesc',
    icon: Bike,
    color: ONBOARDING_COLORS.success,
  },
  {
    key: 'intermediate' as ExperienceLevel,
    descKey: 'intermediateDesc',
    icon: Gauge,
    color: palette.moduleSuspension,
  },
  {
    key: 'advanced' as ExperienceLevel,
    descKey: 'advancedDesc',
    icon: Flame,
    color: ONBOARDING_COLORS.warning,
  },
] as const;

export default function ExperienceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setExperienceLevel = useOnboardingStore((s) => s.setExperienceLevel);
  const storedLevel = useOnboardingStore((s) => s.experienceLevel);
  const [selected, setSelected] = useState<string | null>(storedLevel);

  const handleSelect = (key: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSelected(key);
    setExperienceLevel(key as ExperienceLevel);
    // Auto-advance after brief delay for visual feedback
    setTimeout(() => {
      router.replace('/(onboarding)/bike-year');
    }, 300);
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={1} totalScreens={TOTAL_SCREENS} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          {t('onboarding.experienceTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(150).duration(300)}
          style={{
            fontSize: 17,
            color: ONBOARDING_COLORS.textSecondary,
            lineHeight: 24,
            marginBottom: 40,
          }}
        >
          {t('onboarding.welcomeSubtitle')}
        </Animated.Text>

        <View style={{ gap: 16 }}>
          {EXPERIENCE_LEVELS.map((level, index) => (
            <Animated.View
              key={level.key}
              entering={FadeInUp.delay(250 + index * 100)
                .duration(300)
                .springify()
                .damping(18)}
            >
              <OnboardingCard
                value={level.key}
                icon={level.icon}
                label={t(`onboarding.${level.key}`)}
                subtitle={t(`onboarding.${level.descKey}`)}
                color={level.color}
                selected={selected === level.key}
                onPress={handleSelect}
              />
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
