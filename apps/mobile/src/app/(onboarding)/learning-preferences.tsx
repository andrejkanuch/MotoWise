import type { LearningFormat } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { BookOpen, Brain, Play, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './_config';

const FORMAT_OPTIONS = [
  { value: 'quick_tips' as LearningFormat, icon: Zap, color: '#34D399' },
  { value: 'deep_dives' as LearningFormat, icon: BookOpen, color: '#60A5FA' },
  { value: 'video_walkthroughs' as LearningFormat, icon: Play, color: '#A78BFA' },
  { value: 'hands_on_quizzes' as LearningFormat, icon: Brain, color: '#F59E0B' },
] as const;

export default function LearningPreferencesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setLearningFormats = useOnboardingStore((s) => s.setLearningFormats);
  const storedFormats = useOnboardingStore((s) => s.learningFormats);

  const [selectedFormats, setSelectedFormats] = useState<Set<LearningFormat>>(
    () => new Set(storedFormats),
  );

  const handleFormatPress = (value: string) => {
    const format = value as LearningFormat;
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) {
        next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  };

  const canContinue = selectedFormats.size > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setLearningFormats([...selectedFormats]);
    router.replace('/(onboarding)/smart-maintenance');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <OnboardingProgress screenIndex={12} totalScreens={TOTAL_SCREENS} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          {t('onboarding.learningPreferencesTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(300)}
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 32,
          }}
        >
          {t('onboarding.learningPreferencesSubtitle')}
        </Animated.Text>

        <View style={{ gap: 10 }}>
          {FORMAT_OPTIONS.map((option, index) => (
            <Animated.View
              key={option.value}
              entering={FadeInUp.delay(Math.min(index * 50, 400)).duration(300)}
            >
              <OnboardingCard
                value={option.value}
                icon={option.icon}
                label={t(`onboarding.learningFormat_${option.value}`)}
                subtitle={t(`onboarding.learningFormatDesc_${option.value}`)}
                color={option.color}
                selected={selectedFormats.has(option.value)}
                onPress={handleFormatPress}
              />
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={({ pressed }) => ({
            backgroundColor: canContinue ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
            borderRadius: 20,
            borderCurve: 'continuous',
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: canContinue ? '#0F172A' : 'rgba(255,255,255,0.4)',
            }}
          >
            {t('onboarding.continue')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
