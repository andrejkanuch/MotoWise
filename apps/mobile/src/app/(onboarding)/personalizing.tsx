import { CompleteOnboardingDocument, type CompleteOnboardingInput } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import {
  Bike,
  Check,
  Compass,
  MapPin,
  Search,
  Settings,
  Sparkles,
  Wallet,
  Wrench,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { getPrimaryGoal, OB_ROUTE, TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { detectCurrency } from '../../lib/locale-detection';
import { MetaAnalytics } from '../../lib/meta-analytics';
import { clearStoredFbclid, getStoredFbclid } from '../../lib/meta-attribution';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { useChecklistStore } from '../../stores/checklist.store';
import { useOnboardingStore } from '../../stores/onboarding.store';

const FIXED_STEP_ICONS = [Search, Bike, Settings] as const;
const FIXED_STEPS = [
  'v2PersonalizingStep1',
  'v2PersonalizingStep2',
  'v2PersonalizingStep3',
] as const;

const GOAL_STEP_CONFIG: Record<string, { i18nKey: string; icon: typeof MapPin }> = {
  track_rides: { i18nKey: 'v2PersonalizingStepRides', icon: MapPin },
  manage_expenses: { i18nKey: 'v2PersonalizingStepExpenses', icon: Wallet },
  discover_routes: { i18nKey: 'v2PersonalizingStepRoutes', icon: Compass },
  maintain_bike: { i18nKey: 'v2PersonalizingStepMaintain', icon: Wrench },
  just_exploring: { i18nKey: 'v2PersonalizingStepExploring', icon: Sparkles },
};

const MIN_ANIMATION_MS = 2500;

export default function PersonalizingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [visibleSteps, setVisibleSteps] = useState(0);
  const {
    experienceLevel,
    bikeData,
    ridingGoals,
    acceptedOemScheduleIds,
    ridingFrequency,
    maintenanceStyle,
    annualRepairSpend,
    maintenanceReminders,
    reminderChannel,
    seasonalTips,
    recallAlerts,
    weeklySummary,
    lastServiceDate,
    currency,
    reset,
  } = useOnboardingStore();
  const queryClient = useQueryClient();

  const { mutateAsync: completeOnboarding } = useMutation({
    mutationFn: (input: CompleteOnboardingInput) =>
      gqlFetcher(CompleteOnboardingDocument, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
  });

  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);
  const [mutationDone, setMutationDone] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [navFailed, setNavFailed] = useState(false);

  const primaryGoal = useMemo(() => getPrimaryGoal(ridingGoals), [ridingGoals]);
  const goalConfig = GOAL_STEP_CONFIG[primaryGoal];

  const steps = useMemo(() => [...FIXED_STEPS, goalConfig.i18nKey] as const, [goalConfig.i18nKey]);
  const stepIcons = useMemo(
    () => [...FIXED_STEP_ICONS, goalConfig.icon] as const,
    [goalConfig.icon],
  );

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    pulseScale.value = withRepeat(withTiming(1.3, { duration: 1200 }), -1, true);
    pulseOpacity.value = withRepeat(withTiming(0.2, { duration: 1200 }), -1, true);
  }, [pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Track step viewed once on mount
  useEffect(() => {
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, {
      step: 'personalizing',
      step_index: 7,
    });
  }, []);

  // Persist preferences to server
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire on mount and on manual retry
  useEffect(() => {
    const run = async () => {
      // Read Meta click ID for CAPI attribution (P1 fix)
      const fbclid = await getStoredFbclid();

      // Auto-detect currency if not set during onboarding
      const detectedCurrency = detectCurrency();

      const input: CompleteOnboardingInput = {
        experienceLevel: experienceLevel ?? 'beginner',
        ridingGoals: ridingGoals.length > 0 ? ridingGoals : [],
        learningFormats: [],
        maintenanceReminders,
        seasonalTips,
        recallAlerts,
        weeklySummary,
        ...(ridingFrequency && { ridingFrequency }),
        ...(maintenanceStyle && { maintenanceStyle }),
        ...(annualRepairSpend && { annualRepairSpend }),
        ...(reminderChannel && { reminderChannel }),
        ...(lastServiceDate && { lastServiceDate }),
        currency: currency ?? detectedCurrency,
        ...(fbclid && { fbclid }),
        ...(bikeData && {
          ...(bikeData.make?.trim() && { bikeMake: bikeData.make.trim() }),
          ...(bikeData.model?.trim() && { bikeModel: bikeData.model.trim() }),
          ...(bikeData.type && { bikeType: bikeData.type }),
          bikeYear: bikeData.year,
          bikeMileage: bikeData.currentMileage,
          bikeMileageUnit: bikeData.mileageUnit,
          ...(bikeData.nickname && { bikeNickname: bikeData.nickname }),
        }),
        ...(acceptedOemScheduleIds.length > 0 && { acceptedOemScheduleIds }),
      };

      // Clear fbclid after use — it should only be sent once
      if (fbclid) clearStoredFbclid();

      // Shared event ID for client-server dedup with Meta CAPI
      const eventId = Crypto.randomUUID();
      input.eventId = eventId;

      await completeOnboarding(input);
      trackEvent(AnalyticsEvent.ONBOARDING_COMPLETED, {
        experience_level: experienceLevel ?? 'beginner',
        has_bike: !!bikeData,
        has_photo: !!bikeData?.nickname,
        goals_count: ridingGoals.length,
        goals: ridingGoals.join(','),
        primary_goal: primaryGoal,
        total_screens: TOTAL_SCREENS,
        ...(bikeData && {
          bike_make: bikeData.make,
          bike_model: bikeData.model,
          bike_year: bikeData.year,
        }),
        accepted_maintenance_count: acceptedOemScheduleIds.length,
      });
      MetaAnalytics.trackCompleteRegistration(eventId);

      // Initialize checklist store based on user goals
      useChecklistStore.getState().initialize(ridingGoals);

      setOnboardingCompleted(true);
      setMutationDone(true);
    };

    run().catch((error) => {
      console.error(
        '[Personalizing] Attempt failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      setShowRetry(true);
    });
  }, [retryCount]);

  // Animation steps + minimum display time (2500ms total)
  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleSteps(1), 300),
      setTimeout(() => setVisibleSteps(2), 800),
      setTimeout(() => setVisibleSteps(3), 1300),
      setTimeout(() => setVisibleSteps(4), 1800),
      setTimeout(() => setAnimationDone(true), MIN_ANIMATION_MS),
    ];

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  // Navigate only when BOTH mutation succeeded AND animation finished
  useEffect(() => {
    if (mutationDone && animationDone) {
      try {
        reset();
        router.replace(OB_ROUTE.HOME);
      } catch {
        setNavFailed(true);
      }
    }
  }, [mutationDone, animationDone, router, reset]);

  // Safety net: if stuck for 8s total, show continue button
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!mutationDone && !showRetry) {
        setShowRetry(true);
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [mutationDone, showRetry]);

  const handleContinue = () => {
    setOnboardingCompleted(true);
    reset();
    router.replace(OB_ROUTE.HOME);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: ONBOARDING_COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
      }}
    >
      {/* Pulsing ring + Sparkles icon */}
      <View
        style={{
          width: 120,
          height: 120,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 48,
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: 60,
              borderCurve: 'continuous',
              borderWidth: 3,
              borderColor: ONBOARDING_COLORS.accent,
            },
            pulseStyle,
          ]}
        />
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            borderCurve: 'continuous',
            backgroundColor: ONBOARDING_COLORS.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={28} color={ONBOARDING_COLORS.textPrimary} strokeWidth={2} />
        </View>
      </View>

      <Text
        style={{
          fontSize: 24,
          fontWeight: '800',
          color: ONBOARDING_COLORS.textPrimary,
          textAlign: 'center',
          marginBottom: 32,
        }}
      >
        {t('onboarding.v2PersonalizingTitle')}
      </Text>

      <View style={{ gap: 16, alignItems: 'flex-start' }}>
        {steps.map((stepKey, index) => {
          const StepIcon = stepIcons[index];
          return visibleSteps > index ? (
            <Animated.View
              key={stepKey}
              entering={FadeInUp.duration(300)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <StepIcon size={18} color={ONBOARDING_COLORS.textMuted} />
              <Text
                style={{
                  fontSize: 16,
                  color: ONBOARDING_COLORS.textSecondary,
                }}
              >
                {t(`onboarding.${stepKey}` as never)}
              </Text>
              <Check size={16} color={ONBOARDING_COLORS.success} />
            </Animated.View>
          ) : null;
        })}
      </View>

      {/* Fallback continue button if auto-navigation didn't fire */}
      {navFailed && (
        <Animated.View entering={FadeIn.duration(300)} style={{ marginTop: 32 }}>
          <Pressable
            onPress={handleContinue}
            style={{
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: ONBOARDING_COLORS.accent,
            }}
          >
            <Text style={{ color: ONBOARDING_COLORS.background, fontSize: 17, fontWeight: '700' }}>
              {t('common.done')}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {showRetry && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ marginTop: 32, alignItems: 'center', gap: 16 }}
        >
          {retryCount < 2 && (
            <Pressable
              onPress={() => {
                setShowRetry(false);
                setMutationDone(false);
                setRetryCount((c) => c + 1);
              }}
              style={{
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: ONBOARDING_COLORS.cardBorder,
              }}
            >
              <Text style={{ color: ONBOARDING_COLORS.accent, fontSize: 16, fontWeight: '600' }}>
                {t('common.retry')}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={handleContinue}>
            <Text style={{ color: ONBOARDING_COLORS.accent, fontSize: 15, fontWeight: '600' }}>
              {t('onboarding.personalizingSkip')}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
