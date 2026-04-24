import type { OnboardingGoal } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  BookOpen,
  ChevronLeft,
  MapPin,
  Receipt,
  Route,
  ShieldAlert,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

const GOAL_OPTIONS = [
  {
    value: 'maintenance' as OnboardingGoal,
    icon: Wrench,
    labelKey: 'onboarding.goalMaintenance',
    subtitleKey: 'onboarding.goalMaintenanceDesc',
    color: ONBOARDING_COLORS.accent,
  },
  {
    value: 'expenses' as OnboardingGoal,
    icon: Receipt,
    labelKey: 'onboarding.goalExpenses',
    subtitleKey: 'onboarding.goalExpensesDesc',
    color: ONBOARDING_COLORS.success,
  },
  {
    value: 'rides' as OnboardingGoal,
    icon: Route,
    labelKey: 'onboarding.goalRides',
    subtitleKey: 'onboarding.goalRidesDesc',
    color: '#60A5FA',
  },
  {
    value: 'trips' as OnboardingGoal,
    icon: MapPin,
    labelKey: 'onboarding.goalTrips',
    subtitleKey: 'onboarding.goalTripsDesc',
    color: '#A78BFA',
  },
  {
    value: 'history' as OnboardingGoal,
    icon: BookOpen,
    labelKey: 'onboarding.goalHistory',
    subtitleKey: 'onboarding.goalHistoryDesc',
    color: ONBOARDING_COLORS.warm,
  },
  {
    value: 'recalls' as OnboardingGoal,
    icon: ShieldAlert,
    labelKey: 'onboarding.goalRecalls',
    subtitleKey: 'onboarding.goalRecallsDesc',
    color: ONBOARDING_COLORS.error,
  },
] as const;

export default function GoalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setGoals = useOnboardingStore((s) => s.setGoals);

  const [selectedGoals, setSelectedGoals] = useState<OnboardingGoal[]>([]);

  const handleToggleGoal = useCallback((value: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedGoals((prev) => {
      const goal = value as OnboardingGoal;
      if (prev.includes(goal)) {
        return prev.filter((g) => g !== goal);
      }
      return [...prev, goal];
    });
  }, []);

  const handleContinue = () => {
    setGoals(selectedGoals);
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'goals',
      step_index: 5,
      goals: selectedGoals,
      goal_count: selectedGoals.length,
    });
    router.replace('/(onboarding)/notifications');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={5} totalScreens={TOTAL_SCREENS} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Animated.View entering={FadeIn.duration(200)}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: ONBOARDING_COLORS.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <ChevronLeft size={20} color={ONBOARDING_COLORS.textPrimary} />
          </Pressable>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.duration(300)}>
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
            What matters{'\n'}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                color: ONBOARDING_COLORS.warm2,
              }}
            >
              to you?
            </Text>
          </Text>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(300)}
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: ONBOARDING_COLORS.textSecondary,
            marginBottom: 28,
          }}
        >
          {t('onboarding.goalsSubtitle')}
        </Animated.Text>

        {/* Goal cards */}
        <View style={{ gap: 10 }}>
          {GOAL_OPTIONS.map((goal, index) => (
            <Animated.View
              key={goal.value}
              entering={FadeInUp.delay(150 + index * 50).duration(300)}
            >
              <OnboardingCard
                value={goal.value}
                icon={goal.icon}
                label={t(goal.labelKey)}
                subtitle={t(goal.subtitleKey)}
                color={goal.color}
                selected={selectedGoals.includes(goal.value)}
                onPress={handleToggleGoal}
              />
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      {/* CTA */}
      <Animated.View
        entering={FadeIn.delay(400).duration(300)}
        style={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        <OnboardingContinueButton
          label={t('onboarding.continueNPicked', { count: selectedGoals.length })}
          onPress={handleContinue}
          disabled={selectedGoals.length < 1}
        />
      </Animated.View>
    </View>
  );
}
