import { colors } from '@motolearn/design-system';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { ProgressBar } from './progress-bar';

const GOALS = [
  'goalCommute',
  'goalWeekend',
  'goalTrack',
  'goalTouring',
  'goalLearning',
  'goalMaintenance',
] as const;

export default function RidingGoalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setRidingGoals = useOnboardingStore((s) => s.setRidingGoals);
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());

  const toggleGoal = (goal: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) {
        next.delete(goal);
      } else {
        next.add(goal);
      }
      return next;
    });
  };

  const handleContinue = () => {
    setRidingGoals([...selectedGoals]);
    router.push('/(onboarding)/personalizing');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary[950] }}>
      <ProgressBar step={3} total={4} />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48 }}>
        <Animated.Text
          entering={FadeInDown.duration(500)}
          style={{
            fontSize: 34,
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: 8,
          }}
        >
          {t('onboarding.goalsTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(500)}
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.7)',
            marginBottom: 32,
          }}
        >
          {t('onboarding.goalsSubtitle')}
        </Animated.Text>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {GOALS.map((goal, index) => {
            const isSelected = selectedGoals.has(goal);
            return (
              <Animated.View
                key={goal}
                entering={FadeInUp.delay(200 + index * 60).duration(400)}
                style={{ width: '47%' }}
              >
                <Pressable
                  onPress={() => toggleGoal(goal)}
                  style={({ pressed }) => ({
                    backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                    borderWidth: 1.5,
                    borderColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    paddingVertical: 20,
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: isSelected ? colors.primary[950] : '#FFFFFF',
                      textAlign: 'center',
                    }}
                  >
                    {t(`onboarding.${goal}`)}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        <Pressable
          onPress={handleContinue}
          disabled={selectedGoals.size === 0}
          style={({ pressed }) => ({
            backgroundColor: selectedGoals.size > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
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
              color: selectedGoals.size > 0 ? colors.primary[950] : 'rgba(255,255,255,0.4)',
            }}
          >
            {t('onboarding.continue')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
