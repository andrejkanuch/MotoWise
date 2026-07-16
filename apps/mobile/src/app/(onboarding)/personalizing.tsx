import {
  CompleteOnboardingDocument,
  type CompleteOnboardingInput,
  UpdateUserDocument,
} from '@motovault/graphql';
import { type MeasurementSystem, type MileageUnit, mileageUnitLabel } from '@motovault/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
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
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { getPrimaryGoal, OB_SCREEN } from '../../config/onboarding';
import { useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent, captureException, setUserPropertiesOnce } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { uploadBikePhoto } from '../../lib/image-upload';
import { detectCurrency } from '../../lib/locale-detection';
import { logger } from '../../lib/logger';
import { MetaAnalytics } from '../../lib/meta-analytics';
import { clearStoredFbclid, getStoredFbclid } from '../../lib/meta-attribution';
import { trackOnboardingEvent, trackOnboardingFlowEvent } from '../../lib/onboarding-analytics';
import { queryKeys } from '../../lib/query-keys';
import { setSelfReportedSource } from '../../lib/subscription';
import { useAuthStore } from '../../stores/auth.store';
import { useChecklistStore } from '../../stores/checklist.store';
import { useOnboardingStore } from '../../stores/onboarding.store';

// Onboarding still captures mileage with a per-bike mi/km toggle, but the app now
// derives the display unit from the global users.measurement_system
// (docs/plans/odometer-unit-normalization.md). Map the toggle choice to the global
// system so we persist the matching measurement_system (the odometer itself is
// stored raw in that unit — no conversion).
const UNIT_TO_SYSTEM: Record<MileageUnit, MeasurementSystem> = {
  mi: 'imperial',
  km: 'metric',
} as const;

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

const SERIF_REGULAR = 'InstrumentSerif-Regular' as const;
const SERIF_ITALIC = 'InstrumentSerif-Italic' as const;
const MONO_MEDIUM = 'GeistMono-Medium' as const;
const BODY = 'Geist-Regular' as const;

type BikeLike = { year?: number | null; make?: string | null; model?: string | null } | null;

/** Builds a human-readable bike label (e.g. "2023 BMW R 1250 GS"), or null if no bike. */
function buildBikeLabel(bike: BikeLike): string | null {
  if (!bike?.make?.trim()) return null;
  const parts = [
    bike.year ? String(bike.year) : null,
    bike.make.trim(),
    bike.model?.trim() || null,
  ];
  return parts.filter(Boolean).join(' ');
}

export default function PersonalizingScreen() {
  const { t } = useTranslation();
  const { totalScreens } = useOnboardingStep(OB_SCREEN.PERSONALIZING);
  // Resume-after-kill entry (welcome's resume replace) — the rider already sat
  // through the staged setup once; don't replay it on app load. Skip the
  // minimum-animation gate and complete straight into the garage on mutation
  // success, so the whole thing finishes behind the launch splash.
  const { resumed } = useLocalSearchParams<{ resumed?: string }>();
  const isResumed = resumed === '1';
  const [visibleSteps, setVisibleSteps] = useState(0);
  const {
    experienceLevel,
    bikeData,
    preBikeMileageUnit,
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
    heardFrom,
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
  const [animationDone, setAnimationDone] = useState(isResumed);
  const [showDone, setShowDone] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const reducedMotion = useReducedMotion();

  const primaryGoal = useMemo(() => getPrimaryGoal(ridingGoals), [ridingGoals]);
  const goalConfig = GOAL_STEP_CONFIG[primaryGoal];
  const bikeLabel = useMemo(() => buildBikeLabel(bikeData), [bikeData]);

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

  // Check-badge pop on the payoff phase (spring scale; respects reduced motion).
  const checkScale = useSharedValue(0);
  const checkBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // Track step viewed once on mount. Resume entries already fired this in the
  // original session (welcome fires ONBOARDING_RESUMED instead) — re-firing
  // would inflate the funnel step.
  useEffect(() => {
    if (!isResumed) {
      trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.PERSONALIZING);
    }
  }, [isResumed]);

  // Persist preferences to server
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire on mount and on manual retry
  useEffect(() => {
    const run = async () => {
      // Read Meta click ID for CAPI attribution (P1 fix)
      const fbclid = await getStoredFbclid();

      // Auto-detect currency if not set during onboarding
      const detectedCurrency = detectCurrency();

      // Upload the rider's bike photo BEFORE completing onboarding so its URL is
      // persisted atomically — `complete_onboarding` writes `primary_photo_url`
      // on bike creation when given `bikePhotoUrl`. Best-effort: a failed upload
      // still lets onboarding finish without a photo (it can be added later from
      // the garage). The upload overlaps the minimum payoff animation, so it adds
      // no perceptible latency.
      let bikePhotoUrl: string | undefined;
      if (bikeData?.photoUri) {
        try {
          const userId = useAuthStore.getState().session?.user?.id;
          if (userId) {
            const { publicUrl } = await uploadBikePhoto(bikeData.photoUri, userId);
            bikePhotoUrl = publicUrl;
          }
        } catch (err) {
          logger.warn('[Personalizing] bike photo upload skipped:', err);
        }
      }

      // Resolve the user's global measurement system from the onboarding unit
      // toggle (falling back to the device-derived store default). The odometer is
      // stored raw in that unit; we persist measurement_system to match.
      const chosenUnit = bikeData?.mileageUnit ?? preBikeMileageUnit ?? null;
      const onboardingSystem: MeasurementSystem = chosenUnit
        ? UNIT_TO_SYSTEM[chosenUnit]
        : useAuthStore.getState().measurementSystem;

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
          // Odometer is stored raw in the user's unit; the per-bike unit column
          // records the matching label from the global measurement system.
          bikeMileage: bikeData.currentMileage,
          bikeMileageUnit: mileageUnitLabel(onboardingSystem),
          ...(bikeData.nickname && { bikeNickname: bikeData.nickname }),
          ...(bikePhotoUrl && { bikePhotoUrl }),
        }),
        ...(acceptedOemScheduleIds.length > 0 && { acceptedOemScheduleIds }),
      };

      // Clear fbclid after use — it should only be sent once
      if (fbclid) clearStoredFbclid();

      // Shared event ID for client-server dedup with Meta CAPI
      const eventId = Crypto.randomUUID();
      input.eventId = eventId;

      // Backstop the self-reported acquisition channel: the HDYHAU screen writes
      // these fire-and-forget, so an app kill mid-advance could lose them while the
      // persisted `heardFrom` survives. Both are idempotent ($set_once person prop /
      // mutable RC attribute), so re-asserting here at the terminal step is safe.
      if (heardFrom) {
        setUserPropertiesOnce({ heard_from: heardFrom });
        void setSelfReportedSource(heardFrom);
      }

      await completeOnboarding(input);

      // Persist the global measurement system so display units match what the user
      // picked (complete_onboarding does not touch users.measurement_system, which
      // otherwise stays the 'metric' default and mislabels imperial riders).
      // Best-effort: never block onboarding on it; also set the store so the app
      // renders correctly before the next `me` refetch.
      try {
        useAuthStore.getState().setMeasurementSystem(onboardingSystem);
        await gqlFetcher(UpdateUserDocument, {
          input: { measurementSystem: onboardingSystem },
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
      } catch (err) {
        logger.warn('[Personalizing] measurement_system update skipped:', err);
      }

      trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_COMPLETED, {
        experience_level: experienceLevel ?? 'beginner',
        has_bike: !!bikeData,
        has_photo: !!bikeData?.photoUri,
        goals_count: ridingGoals.length,
        goals: ridingGoals.join(','),
        primary_goal: primaryGoal,
        total_screens: totalScreens,
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

      setMutationDone(true);
    };

    run().catch((error) => {
      captureException(error, {
        source: 'onboarding.personalizing.completeOnboarding',
        attempt: String(retryCount),
      });
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

  // When BOTH the server mutation succeeded AND the minimum animation finished,
  // transition to the DONE / payoff phase instead of redirecting immediately.
  // The `onboarding_completed` analytics event has already fired inside the
  // mutation `run()` above (before any navigation), so we do NOT re-fire it here.
  // The actual completion trigger — flipping `onboardingCompleted`, which makes
  // the root Stack.Protected guard auto-redirect to (tabs) — is deferred to the
  // explicit "Open my garage" CTA so the user sees the payoff first.
  // EXCEPTION: on a cold-start resume there is no payoff to earn — complete
  // immediately so the rider lands in the garage, ideally before the launch
  // splash even dismisses.
  useEffect(() => {
    if (!mutationDone || !animationDone) return;
    if (isResumed) {
      reset();
      setOnboardingCompleted(true);
    } else {
      setShowDone(true);
    }
  }, [mutationDone, animationDone, isResumed, reset, setOnboardingCompleted]);

  // Pop the check badge in when the payoff phase appears.
  useEffect(() => {
    if (!showDone) return;
    if (reducedMotion) {
      checkScale.value = 1;
      return;
    }
    checkScale.value = withSpring(1, { damping: 11, stiffness: 180, mass: 0.7 });
  }, [showDone, reducedMotion, checkScale]);

  // Safety net: if stuck for 8s total, show continue button
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!mutationDone && !showRetry) {
        setShowRetry(true);
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [mutationDone, showRetry]);

  // Single completion trigger: reset onboarding state + flip the auth flag, which
  // makes the root guard redirect to OB_ROUTE.HOME. Used by the payoff CTA and the
  // retry/safety-net skip link (both before any navigation).
  const handleContinue = () => {
    reset();
    setOnboardingCompleted(true);
  };

  // Cold-start resume: the staged setup UI must not appear on app load. Hold a
  // bare background while the mutation completes silently (then the root guard
  // flips to the garage). Only if the silent completion errors or stalls past
  // the 8s safety net does the full UI surface, with the retry controls.
  if (isResumed && !showRetry) {
    return <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }} />;
  }

  if (showDone) {
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
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ alignItems: 'center', width: '100%' }}
        >
          {/* Copper rounded CHECK badge — pops in with a spring scale */}
          <Animated.View
            style={[
              {
                width: 84,
                height: 84,
                borderRadius: 26,
                borderCurve: 'continuous',
                backgroundColor: ONBOARDING_COLORS.warm,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              },
              checkBadgeStyle,
            ]}
          >
            <Check size={40} color={ONBOARDING_COLORS.textOnAccent} strokeWidth={3} />
          </Animated.View>

          <Animated.Text
            entering={FadeInUp.delay(80).duration(300)}
            style={{
              fontFamily: MONO_MEDIUM,
              fontSize: 12,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.warm2,
              marginBottom: 14,
            }}
          >
            {t('onboarding.personalizingDoneEyebrow' as never)}
          </Animated.Text>

          <Animated.Text
            entering={FadeInUp.delay(120).duration(300)}
            style={{
              fontFamily: SERIF_REGULAR,
              fontSize: 40,
              lineHeight: 44,
              color: ONBOARDING_COLORS.textPrimary,
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            {t('onboarding.personalizingDoneTitleLead' as never)}{' '}
            <Text style={{ fontFamily: SERIF_ITALIC, color: ONBOARDING_COLORS.warm2 }}>
              {t('onboarding.personalizingDoneTitleAccent' as never)}
            </Text>
          </Animated.Text>

          <Animated.Text
            entering={FadeInUp.delay(160).duration(300)}
            style={{
              fontFamily: BODY,
              fontSize: 15,
              lineHeight: 22,
              color: ONBOARDING_COLORS.textSecondary,
              textAlign: 'center',
              maxWidth: 320,
              marginBottom: 32,
            }}
          >
            {bikeLabel
              ? (t(
                  'onboarding.personalizingDoneSubWithBike' as never,
                  {
                    bikeLabel,
                  } as never,
                ) as unknown as string)
              : t('onboarding.personalizingDoneSub' as never)}
          </Animated.Text>

          <Animated.View entering={FadeInUp.delay(200).duration(300)} style={{ width: '100%' }}>
            <OnboardingContinueButton
              label={t('onboarding.personalizingDoneCta' as never)}
              onPress={handleContinue}
            />
          </Animated.View>
        </Animated.View>
      </View>
    );
  }

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

      {/* Title — Instrument Serif with italic-copper accent on the key phrase */}
      <Text
        style={{
          fontFamily: SERIF_REGULAR,
          fontSize: 30,
          lineHeight: 34,
          color: ONBOARDING_COLORS.textPrimary,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {t('onboarding.v2PersonalizingTitleLead' as never)}{' '}
        <Text style={{ fontFamily: SERIF_ITALIC, color: ONBOARDING_COLORS.warm2 }}>
          {t('onboarding.v2PersonalizingTitleAccent' as never)}
        </Text>
      </Text>

      {bikeLabel ? (
        <Text
          style={{
            fontFamily: BODY,
            fontSize: 13,
            color: ONBOARDING_COLORS.ink3,
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          {
            t(
              'onboarding.v2PersonalizingSubtitle' as never,
              {
                bikeLabel,
              } as never,
            ) as unknown as string
          }
        </Text>
      ) : (
        <View style={{ marginBottom: 32 }} />
      )}

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
                  fontFamily: BODY,
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
