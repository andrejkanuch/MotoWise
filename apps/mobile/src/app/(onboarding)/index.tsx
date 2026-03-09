import type { ExperienceLevel } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Bike, Flame, Gauge } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OptionCard } from '../../components/option-card';
import { ProgressBar } from '../../components/progress-bar';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_STEPS } from './config';

const EXPERIENCE_LEVELS = [
  {
    key: 'beginner' as ExperienceLevel,
    descKey: 'beginnerDesc',
    icon: Bike,
    color: '#34D399',
  },
  {
    key: 'intermediate' as ExperienceLevel,
    descKey: 'intermediateDesc',
    icon: Gauge,
    color: '#60A5FA',
  },
  {
    key: 'advanced' as ExperienceLevel,
    descKey: 'advancedDesc',
    icon: Flame,
    color: '#F59E0B',
  },
] as const;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setExperienceLevel = useOnboardingStore((s) => s.setExperienceLevel);
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (key: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelected(key);
  };

  const handleContinue = () => {
    if (!selected) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setExperienceLevel(selected as ExperienceLevel);
    router.push('/(onboarding)/select-bike');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ProgressBar step={1} total={TOTAL_STEPS} />

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
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          {t('onboarding.welcomeTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(150).duration(300)}
          style={{
            fontSize: 17,
            color: 'rgba(255, 255, 255, 0.6)',
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
              <OptionCard
                value={level.key}
                icon={level.icon}
                title={t(`onboarding.${level.key}`)}
                subtitle={t(`onboarding.${level.descKey}`)}
                color={level.color}
                selected={selected === level.key}
                onPress={handleSelect}
              />
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <Animated.View
        entering={FadeIn.delay(600).duration(300)}
        style={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
          style={({ pressed }) => ({
            backgroundColor: selected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            borderCurve: 'continuous',
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            boxShadow: selected ? '0 4px 12px rgba(255, 255, 255, 0.15)' : 'none',
          })}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: selected ? '#0F172A' : 'rgba(255, 255, 255, 0.3)',
            }}
          >
            {t('onboarding.continue')}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
