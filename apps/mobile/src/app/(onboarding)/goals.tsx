import type { RidingGoal } from '@motovault/types';
import { useFocusEffect } from 'expo-router';
import { Check, Compass, MapPin, Sparkles, Wallet, Wrench } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { getPrimaryGoal, OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerImpact } from '../../utils/haptics';

const GOAL_OPTIONS = [
  {
    key: 'track_rides' as RidingGoal,
    labelKey: 'v2GoalTrackRides',
    descKey: 'v2GoalTrackRidesDesc',
    icon: MapPin,
  },
  {
    key: 'manage_expenses' as RidingGoal,
    labelKey: 'v2GoalManageExpenses',
    descKey: 'v2GoalManageExpensesDesc',
    icon: Wallet,
  },
  {
    key: 'discover_routes' as RidingGoal,
    labelKey: 'v2GoalDiscoverRoutes',
    descKey: 'v2GoalDiscoverRoutesDesc',
    icon: Compass,
  },
  {
    key: 'maintain_bike' as RidingGoal,
    labelKey: 'v2GoalMaintainBike',
    descKey: 'v2GoalMaintainBikeDesc',
    icon: Wrench,
  },
  {
    key: 'just_exploring' as RidingGoal,
    labelKey: 'v2GoalJustExploring',
    descKey: 'v2GoalJustExploringDesc',
    icon: Sparkles,
    italicSubtitle: true,
  },
] as const;

export default function GoalsScreen() {
  const { t } = useTranslation();
  // Widened wrapper for onboarding copy keys that are pending addition to en.json.
  // Routes through i18next at runtime; sidesteps the generated-from-en.json key union
  // so this screen can reference its spec'd copy keys without editing locale files.
  const tx = (key: string, options?: Record<string, unknown>) =>
    (t as (k: string, o?: Record<string, unknown>) => string)(key, options);
  const onBack = useOnboardingBack(OB_SCREEN.GOALS);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.GOALS);
  const goNext = useOnboardingNext(OB_SCREEN.GOALS);
  const insets = useSafeAreaInsets();
  const setRidingGoals = useOnboardingStore((s) => s.setRidingGoals);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);
  const bikeMake = useOnboardingStore((s) => s.bikeData?.make);

  // Interpolate the rider's bike make into the title; fall back to a generic word.
  const titleMake = bikeMake?.trim() || tx('onboarding.goalsTitleFallback');

  const [selected, setSelected] = useState<Set<RidingGoal>>(new Set());
  const [showAffirmation, setShowAffirmation] = useState(false);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset affirmation state when returning to this screen
  useFocusEffect(
    useCallback(() => {
      setShowAffirmation(false);
      if (navigateTimerRef.current) {
        clearTimeout(navigateTimerRef.current);
        navigateTimerRef.current = null;
      }
    }, []),
  );

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.GOALS);
  }, []);

  useEffect(() => {
    return () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, []);

  const handleToggle = (key: RidingGoal) => {
    triggerImpact();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleContinue = () => {
    const goals = Array.from(selected);
    const primaryGoal = getPrimaryGoal(goals);

    // Batch write to Zustand store
    setRidingGoals(goals);
    setLastCompletedScreen(OB_SCREEN.GOALS);

    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.GOALS, {
      goals: goals.join(','),
      goals_count: goals.length,
      primary_goal: primaryGoal,
    });

    // Show affirmation, then navigate
    setShowAffirmation(true);
    navigateTimerRef.current = setTimeout(() => {
      goNext();
    }, 500);
  };

  const canContinue = selected.size > 0;

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      {/* Back button */}
      <OnboardingBackButton
        onPress={onBack}
        style={{ position: 'absolute', top: insets.top + 44, left: 16, zIndex: 10 }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 72, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Eyebrow */}
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 11,
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            color: ONBOARDING_COLORS.warm2,
            marginBottom: 12,
          }}
        >
          {tx('onboarding.goalsEyebrow')}
        </Animated.Text>

        {/* Headline */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
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
            {tx('onboarding.goalsTitle')}
            {'\n'}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              {tx('onboarding.goalsTitleAccent', { make: titleMake })}
            </Text>
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.Text
          entering={FadeInUp.delay(150).duration(300)}
          style={{
            fontSize: 14,
            color: ONBOARDING_COLORS.textSecondary,
            lineHeight: 20,
            marginBottom: 32,
          }}
        >
          {tx('onboarding.goalsSubtitle')}
        </Animated.Text>

        {/* Goal cards */}
        <View style={{ gap: 12 }}>
          {GOAL_OPTIONS.map((goal, index) => {
            const isSelected = selected.has(goal.key);
            const Icon = goal.icon;

            return (
              <Animated.View
                key={goal.key}
                entering={FadeInUp.delay(200 + index * 80)
                  .duration(300)
                  .springify()
                  .damping(18)}
              >
                <Pressable
                  onPress={() => handleToggle(goal.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${t(`onboarding.${goal.labelKey}`)}, ${t(`onboarding.${goal.descKey}`)}`}
                  style={({ pressed }) => ({
                    backgroundColor: isSelected
                      ? ONBOARDING_COLORS.accentBg
                      : ONBOARDING_COLORS.cardBg,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected
                      ? ONBOARDING_COLORS.warm
                      : ONBOARDING_COLORS.cardBorderDefault,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  {/* Icon */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      borderCurve: 'continuous',
                      backgroundColor: isSelected
                        ? ONBOARDING_COLORS.accentBg
                        : ONBOARDING_COLORS.surface2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      size={22}
                      color={isSelected ? ONBOARDING_COLORS.warm2 : ONBOARDING_COLORS.ink3}
                    />
                  </View>

                  {/* Text */}
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: ONBOARDING_COLORS.textPrimary,
                        fontSize: 17,
                        fontWeight: '600',
                      }}
                    >
                      {t(`onboarding.${goal.labelKey}`)}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: ONBOARDING_COLORS.textSecondary,
                        fontSize: 14,
                        marginTop: 2,
                        ...('italicSubtitle' in goal && goal.italicSubtitle
                          ? { fontStyle: 'italic' }
                          : {}),
                      }}
                    >
                      {t(`onboarding.${goal.descKey}`)}
                    </Text>
                  </View>

                  {/* Checkbox */}
                  {isSelected ? (
                    <Animated.View
                      entering={ZoomIn.duration(200).springify()}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        borderCurve: 'continuous',
                        backgroundColor: ONBOARDING_COLORS.warm,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={16} color={ONBOARDING_COLORS.textOnAccent} />
                    </Animated.View>
                  ) : (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        borderCurve: 'continuous',
                        borderWidth: 1.5,
                        borderColor: ONBOARDING_COLORS.cardBorderDefault,
                      }}
                    />
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom CTA area */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 16,
          paddingTop: 16,
          backgroundColor: ONBOARDING_COLORS.background,
        }}
      >
        {showAffirmation ? (
          <Animated.Text
            entering={FadeInUp.duration(200)}
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: ONBOARDING_COLORS.warm,
              textAlign: 'center',
              paddingVertical: 18,
            }}
          >
            {tx('onboarding.goalsAffirmation')}
          </Animated.Text>
        ) : (
          <>
            <OnboardingContinueButton
              label={t('onboarding.continue')}
              onPress={handleContinue}
              disabled={!canContinue}
            />
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 11,
                letterSpacing: 1,
                color: ONBOARDING_COLORS.textMuted,
                textAlign: 'center',
                marginTop: 10,
              }}
            >
              {tx('onboarding.goalsPicked', {
                count: selected.size,
                total: GOAL_OPTIONS.length,
              })}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
