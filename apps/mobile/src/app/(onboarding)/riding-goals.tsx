import { palette } from '@motovault/design-system';
import type { RidingGoal } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Activity,
  ClipboardCheck,
  DollarSign,
  PiggyBank,
  Shield,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './_config';

const GOAL_OPTIONS: {
  value: RidingGoal;
  icon: typeof Wrench;
  color: string;
}[] = [
  { value: 'learn_maintenance', icon: Wrench, color: ONBOARDING_COLORS.success },
  { value: 'improve_riding', icon: TrendingUp, color: palette.moduleSuspension },
  { value: 'track_maintenance', icon: ClipboardCheck, color: '#A78BFA' },
  { value: 'save_money', icon: DollarSign, color: ONBOARDING_COLORS.warning },
  { value: 'find_community', icon: Users, color: '#EC4899' },
  { value: 'safety', icon: Shield, color: palette.danger500 },
  { value: 'save_on_maintenance', icon: PiggyBank, color: '#14B8A6' },
  { value: 'track_bike_health', icon: Activity, color: '#8B5CF6' },
];

export default function RidingGoalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setRidingGoals = useOnboardingStore((s) => s.setRidingGoals);
  const existingGoals = useOnboardingStore((s) => s.ridingGoals);

  const [selectedGoals, setSelectedGoals] = useState<Set<RidingGoal>>(new Set(existingGoals));

  const handlePress = (value: string) => {
    const goal = value as RidingGoal;
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

  const canContinue = selectedGoals.size > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setRidingGoals([...selectedGoals]);
    router.replace('/(onboarding)/maintenance-style');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={9} totalScreens={TOTAL_SCREENS} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 120 }}
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
          {t('onboarding.ridingGoalsTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(300)}
          style={{
            fontSize: 17,
            color: ONBOARDING_COLORS.textSecondary,
            lineHeight: 24,
            marginBottom: 32,
          }}
        >
          {t('onboarding.ridingGoalsSubtitle')}
        </Animated.Text>

        <View style={{ gap: 10 }}>
          {GOAL_OPTIONS.map((option, index) => (
            <Animated.View key={option.value} entering={FadeInUp.delay(index * 50).duration(300)}>
              <OnboardingCard
                value={option.value}
                icon={option.icon}
                label={t(`onboarding.ridingGoal_${option.value}`)}
                color={option.color}
                selected={selectedGoals.has(option.value)}
                onPress={handlePress}
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
            backgroundColor: canContinue
              ? ONBOARDING_COLORS.textPrimary
              : ONBOARDING_COLORS.textDimmed,
            borderRadius: 16,
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
              color: canContinue ? ONBOARDING_COLORS.background : ONBOARDING_COLORS.textMuted,
            }}
          >
            {t('onboarding.continue')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
