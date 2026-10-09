import type { RidingGoal } from '@motovault/types';
import { useFocusEffect } from 'expo-router';
import { Compass, MapPin, Sparkles, Wallet, Wrench } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import {
  OnboardingOptionList,
  OPTION_MODE,
} from '../../components/onboarding/onboarding-option-list';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { getPrimaryGoal, OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';

/** How long the affirmation shows before navigating on. */
const AFFIRMATION_MS = 300;

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
  },
] as const;

export default function GoalsScreen() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  // Widened wrapper for onboarding copy keys that are pending addition to en.json.
  // Routes through i18next at runtime; sidesteps the generated-from-en.json key union
  // so this screen can reference its spec'd copy keys without editing locale files.
  const tx = (key: string, options?: Record<string, unknown>) =>
    (t as (k: string, o?: Record<string, unknown>) => string)(key, options);
  const onBack = useOnboardingBack(OB_SCREEN.GOALS);
  const goNext = useOnboardingNext(OB_SCREEN.GOALS);
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
    }, AFFIRMATION_MS);
  };

  const canContinue = selected.size > 0;

  return (
    <OnboardingShell
      screen={OB_SCREEN.GOALS}
      onBack={onBack}
      title={tx('onboarding.goalsHeadline', { make: titleMake })}
      subtitle={tx('onboarding.goalsSubtitle')}
      primary={
        showAffirmation
          ? undefined
          : { label: t('onboarding.continue'), onPress: handleContinue, disabled: !canContinue }
      }
      footer={
        showAffirmation ? (
          <Animated.Text
            entering={FadeIn.duration(200)}
            style={[
              type.bodyStrong,
              {
                color: oc.textPrimary,
                textAlign: 'center',
                minHeight: 52,
                textAlignVertical: 'center',
                paddingVertical: space.sm,
              },
            ]}
          >
            {tx('onboarding.goalsAffirmation')}
          </Animated.Text>
        ) : (
          <Text
            style={[
              type.caption,
              {
                color: oc.textMuted,
                textAlign: 'center',
                marginBottom: space.xxs,
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {tx('onboarding.goalsPicked', { count: selected.size, total: GOAL_OPTIONS.length })}
          </Text>
        )
      }
    >
      <OnboardingOptionList
        mode={OPTION_MODE.MULTI}
        options={GOAL_OPTIONS.map((goal) => ({
          key: goal.key,
          label: t(`onboarding.${goal.labelKey}`),
          description: t(`onboarding.${goal.descKey}`),
          icon: goal.icon,
        }))}
        isSelected={(key) => selected.has(key)}
        onSelect={handleToggle}
      />
    </OnboardingShell>
  );
}
