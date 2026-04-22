import type { ExperienceLevel } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Bike, Flame, Gauge } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

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
    color: ONBOARDING_COLORS.warm,
  },
  {
    key: 'advanced' as ExperienceLevel,
    descKey: 'advancedDesc',
    icon: Flame,
    color: ONBOARDING_COLORS.error,
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
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'experience',
      step_index: 1,
      experience_level: key,
    });
    // Auto-advance after brief delay for visual feedback
    setTimeout(() => {
      router.replace('/(onboarding)/bike-year');
    }, 300);
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 72, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.warm,
              marginBottom: 10,
            }}
          >
            {t('onboarding.experienceTitle')}
          </Text>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 36,
              lineHeight: 38,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.7,
              marginBottom: 6,
            }}
          >
            How experienced{'\n'}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              are you?
            </Text>
          </Text>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(150).duration(300)}
          style={{
            fontSize: 14,
            color: ONBOARDING_COLORS.textSecondary,
            lineHeight: 20,
            marginBottom: 32,
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
