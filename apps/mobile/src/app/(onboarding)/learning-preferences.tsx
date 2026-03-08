import type { LearningFormat } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { BookOpen, Brain, Play, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { OptionCard } from '../../components/option-card';
import { ProgressBar } from '../../components/progress-bar';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_STEPS } from './config';

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

  const [selectedFormats, setSelectedFormats] = useState<Set<LearningFormat>>(new Set());

  const pulseOpacity = useSharedValue(1);
  pulseOpacity.value = withRepeat(withTiming(0.4, { duration: 1000 }), -1, true);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const handleFormatPress = (value: LearningFormat) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
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
    router.push('/(onboarding)/insights');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ProgressBar step={4} total={TOTAL_STEPS} />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48 }}>
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

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {FORMAT_OPTIONS.map((option, index) => (
            <Animated.View
              key={option.value}
              entering={FadeInUp.delay(Math.min(index * 60, 400)).duration(300)}
              style={{ width: '48%' }}
            >
              <OptionCard
                value={option.value}
                icon={option.icon}
                title={t(`onboarding.learningFormat_${option.value}`)}
                subtitle={t(`onboarding.learningFormatDesc_${option.value}`)}
                color={option.color}
                selected={selectedFormats.has(option.value)}
                onPress={handleFormatPress}
              />
            </Animated.View>
          ))}
        </View>

        <Animated.Text
          style={[
            {
              fontSize: 15,
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
              marginTop: 32,
            },
            pulseStyle,
          ]}
        >
          {t('onboarding.preparingExperience')}
        </Animated.Text>
      </View>

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
