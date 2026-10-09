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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { OnboardingBikePlate } from '../../components/onboarding/onboarding-bike-plate';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { getPrimaryGoal, getTotalScreens, OB_SCREEN, OB_VARIANT } from '../../config/onboarding';
import { useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent, captureException, setUserPropertiesOnce } from '../../lib/analytics';
import { createGaragePaywallHandoff } from '../../lib/garage-paywall-handoff';
import { gqlFetcher } from '../../lib/graphql-client';
import { uploadBikePhoto } from '../../lib/image-upload';
import { detectCurrency } from '../../lib/locale-detection';
import { logger } from '../../lib/logger';
import { MetaAnalytics } from '../../lib/meta-analytics';
import { clearStoredFbclid, getStoredFbclid } from '../../lib/meta-attribution';
import { trackOnboardingEvent, trackOnboardingFlowEvent } from '../../lib/onboarding-analytics';
import {
  ONBOARDING_PAYWALL_SURFACE,
  presentOnboardingPaywall,
  resolveOnboardingPaywallPlacement,
} from '../../lib/onboarding-paywall';
import { queryKeys } from '../../lib/query-keys';
import { setSelfReportedSource } from '../../lib/subscription';
import { useAuthStore } from '../../stores/auth.store';
import { useChecklistStore } from '../../stores/checklist.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { radius, space, type } from '../../theme/type';

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

const MIN_ANIMATION_MS = 1600;

/**
 * garage_first: how long "Open my garage" may wait for the paywall before an
 * escape link appears. The native modal normally covers the screen within a
 * second; the link exists for an RC init/offerings stall, which would otherwise
 * leave the rider tapping a button that seems to do nothing.
 */
const GARAGE_PAYWALL_ESCAPE_DELAY_MS = 6000;

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
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const { totalScreens, variant } = useOnboardingStep(OB_SCREEN.PERSONALIZING);
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
    pendingIntent,
    setAwaitingGarageCta,
    setCompletionSent,
    reset,
  } = useOnboardingStore();
  // garage_first presents the onboarding paywall from the payoff CTA. Never on
  // the cold-start resume path: that rider already finished, it completes silently.
  const showsGaragePaywall = variant === OB_VARIANT.GARAGE_FIRST && !isResumed;
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
  /** Set once the rider leaves for the garage (CTA, escape or Skip). */
  const leftOnboarding = useRef(false);
  /** Set by the first run() to finish; a concurrent Retry run reports nothing. */
  const completionReported = useRef(false);
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
      // Set before the first await: Skip (reset()) can land while the setup is
      // still saving, and reset() must win. Set after an await, a stalled run
      // would re-arm the hold after the rider entered the garage, and the root
      // gate would send them back into onboarding on every later launch.
      if (showsGaragePaywall) setAwaitingGarageCta(true);

      // Resolve the user's global measurement system from the onboarding unit
      // toggle (falling back to the device-derived store default). The odometer is
      // stored raw in that unit; we persist measurement_system to match.
      const chosenUnit = bikeData?.mileageUnit ?? preBikeMileageUnit ?? null;
      const onboardingSystem: MeasurementSystem = chosenUnit
        ? UNIT_TO_SYSTEM[chosenUnit]
        : useAuthStore.getState().measurementSystem;

      // Persist the global measurement system so display units match what the user
      // picked (complete_onboarding does not touch users.measurement_system, which
      // otherwise stays the 'metric' default and mislabels imperial riders).
      // Best-effort and idempotent: never block onboarding on it; also set the
      // store so the app renders correctly before the next `me` refetch.
      const syncMeasurementSystem = async () => {
        try {
          useAuthStore.getState().setMeasurementSystem(onboardingSystem);
          await gqlFetcher(UpdateUserDocument, {
            input: { measurementSystem: onboardingSystem },
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
          // The 00180 sync trigger just rewrote the new bike's distance_unit; the
          // bike was cached (by completeOnboarding's refetch) in the old unit.
          queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
        } catch (err) {
          logger.warn('[Personalizing] measurement_system update skipped:', err);
        }
      };

      // Resume after a kill on the payoff screen: the setup is already saved.
      // Running it again would re-upload the photo and send a second
      // onboarding_completed and Meta CompleteRegistration (new event id).
      // The unit sync is re-run: a kill while it was in flight would lose it.
      if (useOnboardingStore.getState().completionSent) {
        await syncMeasurementSystem();
        setMutationDone(true);
        return;
      }

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

      // A Retry tapped while this run was still saving starts a second run; only
      // the first to finish reports the completion.
      if (completionReported.current) {
        setMutationDone(true);
        return;
      }
      completionReported.current = true;

      // Report synchronously, before the marker and before any further await, so
      // no kill can land between the save and its reporting. Every variant counts
      // completion at the same point: the setup is saved. The garage_first paywall
      // comes after this, and its result is the paywall step event, so the
      // completion guardrail compares like with like.
      trackOnboardingCompleted();
      MetaAnalytics.trackCompleteRegistration(eventId);
      useChecklistStore.getState().initialize(ridingGoals);

      // Not after the rider already left for the garage: reset() cleared the
      // store, and a marker written now would outlive this onboarding run.
      if (!leftOnboarding.current) setCompletionSent(true);

      await syncMeasurementSystem();

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
    leftOnboarding.current = true;
    reset();
    setOnboardingCompleted(true);
  };

  const trackOnboardingCompleted = () => {
    trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_COMPLETED, {
      experience_level: experienceLevel ?? 'beginner',
      has_bike: !!bikeData,
      has_photo: !!bikeData?.photoUri,
      goals_count: ridingGoals.length,
      goals: ridingGoals.join(','),
      primary_goal: primaryGoal,
      // Full-flow length, as before the progress bar counted visible screens.
      total_screens: getTotalScreens(variant),
      visible_screens: totalScreens,
      ...(bikeData && {
        bike_make: bikeData.make,
        bike_model: bikeData.model,
        bike_year: bikeData.year,
      }),
      accepted_maintenance_count: acceptedOemScheduleIds.length,
    });
  };

  // garage_first: "Open my garage" presents the onboarding paywall, then opens
  // the garage whatever the result (purchase, close, not presented, error).
  const [garagePaywallPending, setGaragePaywallPending] = useState(false);
  const [showGarageEscape, setShowGarageEscape] = useState(false);

  useEffect(() => {
    if (!garagePaywallPending) return;
    const id = setTimeout(() => setShowGarageEscape(true), GARAGE_PAYWALL_ESCAPE_DELAY_MS);
    return () => clearTimeout(id);
  }, [garagePaywallPending]);

  const garagePaywallInput = { ridingGoals, bikeData, experienceLevel, pendingIntent };
  const garagePaywallFields = (() => {
    const { primaryGoal, placement, goals } = resolveOnboardingPaywallPlacement(garagePaywallInput);
    return {
      goals,
      primary_goal: primaryGoal,
      placement,
      surface: ONBOARDING_PAYWALL_SURFACE.GARAGE_READY,
    };
  })();

  // The handoff is created once; its callbacks read the latest render's values.
  const garagePaywallLatest = useRef({ garagePaywallInput, garagePaywallFields, handleContinue });
  garagePaywallLatest.current = { garagePaywallInput, garagePaywallFields, handleContinue };
  const garagePaywall = useRef<ReturnType<typeof createGaragePaywallHandoff> | null>(null);
  if (!garagePaywall.current) {
    garagePaywall.current = createGaragePaywallHandoff({
      present: (shouldAbort) =>
        presentOnboardingPaywall(garagePaywallLatest.current.garagePaywallInput, {
          surface: ONBOARDING_PAYWALL_SURFACE.GARAGE_READY,
          shouldAbort,
        }),
      onStart: () => {
        setGaragePaywallPending(true);
        trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.PAYWALL, {
          surface: ONBOARDING_PAYWALL_SURFACE.GARAGE_READY,
        });
      },
      onSettled: (paywallResult) => {
        trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.PAYWALL, {
          ...garagePaywallLatest.current.garagePaywallFields,
          paywall_result: paywallResult,
        });
        garagePaywallLatest.current.handleContinue();
      },
      // presentPaywall resolves its own failures; reaching here means a bug, and
      // the rider still gets into their garage.
      onError: (err) => captureException(err, { screen: OB_SCREEN.PERSONALIZING }),
    });
  }

  const handleOpenGarage = () => {
    if (!showsGaragePaywall) {
      handleContinue();
      return;
    }
    garagePaywall.current?.open();
  };

  const handleGarageEscape = () => garagePaywall.current?.escape();

  // Cold-start resume: the staged setup UI must not appear on app load. Hold a
  // bare background while the mutation completes silently (then the root guard
  // flips to the garage). Only if the silent completion errors or stalls past
  // the 8s safety net does the full UI surface, with the retry controls.
  if (isResumed && !showRetry) {
    return <View style={{ flex: 1, backgroundColor: oc.background }} />;
  }

  if (showDone) {
    return (
      <OnboardingShell
        screen={OB_SCREEN.PERSONALIZING}
        title={t('onboarding.personalizingDoneHeadline')}
        subtitle={
          bikeLabel
            ? (t(
                'onboarding.personalizingDoneSubWithBike' as never,
                { bikeLabel } as never,
              ) as unknown as string)
            : t('onboarding.personalizingDoneSub' as never)
        }
        primary={{
          label: t('onboarding.personalizingDoneCta' as never),
          onPress: handleOpenGarage,
          // Disabled while the paywall loads, so the tap visibly registered.
          disabled: garagePaywallPending,
        }}
        secondary={
          showGarageEscape
            ? { label: t('onboarding.obPaywallEscape'), onPress: handleGarageEscape }
            : undefined
        }
      >
        {bikeData?.make ? (
          // The plate the rider set up, now ready — the payoff's one moment.
          <OnboardingBikePlate make={bikeData.make} model={bikeData.model} year={bikeData.year} />
        ) : (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(240)}
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              backgroundColor: oc.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={30} color={oc.success} strokeWidth={2.6} />
          </Animated.View>
        )}
      </OnboardingShell>
    );
  }

  const canRetry = showRetry && retryCount < 2;

  return (
    <OnboardingShell
      screen={OB_SCREEN.PERSONALIZING}
      title={t('onboarding.v2PersonalizingHeadline')}
      subtitle={
        bikeLabel
          ? (t(
              'onboarding.v2PersonalizingSubtitle' as never,
              { bikeLabel } as never,
            ) as unknown as string)
          : undefined
      }
      primary={
        canRetry
          ? {
              label: t('common.retry'),
              onPress: () => {
                setShowRetry(false);
                setMutationDone(false);
                setRetryCount((c) => c + 1);
              },
            }
          : undefined
      }
      secondary={
        showRetry
          ? { label: t('onboarding.personalizingSkip'), onPress: handleContinue }
          : undefined
      }
    >
      {/* Calm progress readout: every step listed, each ticking off in turn. */}
      <View
        style={{
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: oc.surface,
          overflow: 'hidden',
        }}
      >
        {steps.map((stepKey, index) => {
          const StepIcon = stepIcons[index];
          const done = visibleSteps > index;
          return (
            <View
              key={stepKey}
              accessibilityState={{ checked: done }}
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: oc.line,
              }}
            >
              <StepIcon size={18} color={done ? oc.textSecondary : oc.textDimmed} />
              <Text style={[type.body, { flex: 1, color: done ? oc.textPrimary : oc.textMuted }]}>
                {t(`onboarding.${stepKey}` as never)}
              </Text>
              {done ? (
                <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(200)}>
                  <Check size={18} color={oc.success} strokeWidth={2.6} />
                </Animated.View>
              ) : null}
            </View>
          );
        })}
      </View>
    </OnboardingShell>
  );
}
