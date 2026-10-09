/**
 * OFF-FLOW as of 2026-08-24 (U6). This screen is in NO onboarding flow.
 *
 * Removed as friction: in the winning arm since 2026-06-15 it was viewed by 150
 * riders, completed by **2**, and skipped by 146. Retained as a route because a
 * rider mid-flow when the OTA lands may have it persisted as their last
 * completed step; `getNextRoute` resolves it forward to `commitment`
 * (RETIRED_SCREEN_SUCCESSOR). `useOnboardingStep` returns stepIndex -1 here.
 *
 * The OEM-schedule import this screen wraps is still valuable — it just does not
 * belong in front of a rider who has not used the app yet.
 */
import { OemSchedulesPreviewDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { OemDisclaimerCard } from '../../components/maintenance/oem-disclaimer-card';
import { TaskCard } from '../../components/onboarding/maintenance/task-card';
import { OnboardingBikePlate } from '../../components/onboarding/onboarding-bike-plate';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { PLATE_SIZE } from '../../components/ui/bike-plate';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { isMaintenanceIntent } from '../../lib/pending-intent';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { convertIntervalDistance, intervalDistanceUnit } from '../../utils/maintenance-interval';

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;
const CARD_HEIGHT = 340;
const EXIT_SPRING = { damping: 20, stiffness: 200, mass: 0.8 };
const SNAP_BACK_SPRING = { damping: 18, stiffness: 350, mass: 0.6 };

export default function MaintenanceScreen() {
  const oc = useOnboardingColors();
  const { isDark } = useEditorialTheme();
  const { t } = useTranslation();
  const onBack = useOnboardingBack(OB_SCREEN.MAINTENANCE);
  const goNext = useOnboardingNext(OB_SCREEN.MAINTENANCE);
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const pendingIntent = useOnboardingStore((s) => s.pendingIntent);
  const setAcceptedOemScheduleIds = useOnboardingStore((s) => s.setAcceptedOemScheduleIds);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const measurementSystem = useAuthStore((s) => s.measurementSystem);

  const make = bikeData?.make ?? '';
  const model = bikeData?.model ?? undefined;
  const year = bikeData?.year ?? undefined;
  const variant = bikeData?.variant ?? undefined;
  const bikeLabel = [model, make].filter(Boolean).join(' · ') || 'your bike';

  // Fetch OEM schedules for this make/model/year[/variant]. Threading the bike's
  // variant surfaces the verified per-variant intervals (e.g. DCT) when present;
  // the API waterfall falls back to the make+model baseline otherwise.
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.onboarding.oemSchedules(make, model, year, variant),
    queryFn: () => gqlFetcher(OemSchedulesPreviewDocument, { make, model, year, variant }),
    enabled: !!make,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const tasks = data?.oemSchedulesPreview ?? [];

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.MAINTENANCE);
  }, []);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);

  const done = currentIdx >= tasks.length;
  const currentTask = tasks[currentIdx];

  // Maintenance-intent cohort (P2 T4): the rider came from an article about THIS
  // bike's *service schedule*, so pre-accept the whole OEM schedule and drop them
  // straight into the summary — their garage lands populated instead of empty.
  // They can still Continue (or reconsider individual tasks). Fires
  // oem_schedule_imported once (T3). Gated to the MAINTENANCE cohort: cost/guide
  // intents (and non-intent onboarders) keep the normal swipe deck untouched, so
  // the auto-import + oem_schedule_imported never fire for them.
  const importedIntentSchedule = useRef(false);
  useEffect(() => {
    if (
      importedIntentSchedule.current ||
      !isMaintenanceIntent(pendingIntent) ||
      isLoading ||
      tasks.length === 0
    )
      return;
    importedIntentSchedule.current = true;
    setAccepted(tasks.map((task) => task.id));
    setCurrentIdx(tasks.length);
    trackOnboardingEvent(AnalyticsEvent.OEM_SCHEDULE_IMPORTED, OB_SCREEN.MAINTENANCE, {
      context: 'onboarding',
      task_count: tasks.length,
    });
  }, [pendingIntent, isLoading, tasks]);

  // Swipe animation
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const noDrag = useSharedValue<'left' | 'right' | null>(null);

  const onSwipeComplete = useCallback(
    (direction: 'left' | 'right') => {
      if (!currentTask) return;

      triggerImpact(direction === 'right' ? ImpactFeedbackStyle.Medium : ImpactFeedbackStyle.Light);

      if (direction === 'right') {
        setAccepted((a) => [...a, currentTask.id]);
      } else {
        setSkipped((s) => [...s, currentTask.id]);
      }

      // Reset position immediately before advancing index —
      // the new card mounts already at (0,0) because React re-keys it
      translateX.value = 0;
      translateY.value = 0;
      setCurrentIdx((i) => i + 1);
    },
    [currentTask, translateX, translateY],
  );

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.35;
    })
    .onEnd((e) => {
      const swipedRight = e.translationX > SWIPE_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD;
      const swipedLeft = e.translationX < -SWIPE_THRESHOLD || e.velocityX < -VELOCITY_THRESHOLD;

      if (swipedRight) {
        // Use velocity to determine exit target for natural momentum
        const exitX = Math.max(400, e.translationX + e.velocityX * 0.3);
        translateX.value = withSpring(exitX, EXIT_SPRING);
        translateY.value = withSpring(e.translationY * 0.35 - 40, EXIT_SPRING);
        runOnJS(onSwipeComplete)('right');
      } else if (swipedLeft) {
        const exitX = Math.min(-400, e.translationX + e.velocityX * 0.3);
        translateX.value = withSpring(exitX, EXIT_SPRING);
        translateY.value = withSpring(e.translationY * 0.35 - 40, EXIT_SPRING);
        runOnJS(onSwipeComplete)('left');
      } else {
        translateX.value = withSpring(0, SNAP_BACK_SPRING);
        translateY.value = withSpring(0, SNAP_BACK_SPRING);
      }
    });

  const topCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-300, 0, 300], [-18, 0, 18])}deg` },
    ],
    opacity: interpolate(Math.abs(translateX.value), [0, 300, 500], [1, 1, 0]),
  }));

  // Background card scales up as top card moves away
  const nextCardStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    return {
      transform: [
        { scale: interpolate(progress, [0, 1], [1 - 0.035, 1]) },
        { translateY: interpolate(progress, [0, 1], [12, 0]) },
      ],
      opacity: interpolate(progress, [0, 1], [1 - 0.18, 1]),
    };
  });

  const thirdCardStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    return {
      transform: [
        { scale: interpolate(progress, [0, 1], [1 - 0.07, 1 - 0.035]) },
        { translateY: interpolate(progress, [0, 1], [24, 12]) },
      ],
      opacity: interpolate(progress, [0, 1], [1 - 0.36, 1 - 0.18]),
    };
  });

  const dragDirection = useDerivedValue(() => {
    if (translateX.value > 30) return 'right' as const;
    if (translateX.value < -30) return 'left' as const;
    return null;
  });

  const handleButtonSwipe = (direction: 'left' | 'right') => {
    const exitX = direction === 'right' ? 450 : -450;
    translateX.value = withSpring(exitX, EXIT_SPRING);
    translateY.value = withSpring(-50, EXIT_SPRING);
    onSwipeComplete(direction);
  };

  const handleContinue = () => {
    triggerImpact(ImpactFeedbackStyle.Medium);
    setAcceptedOemScheduleIds(accepted);
    setLastCompletedScreen(OB_SCREEN.MAINTENANCE);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.MAINTENANCE, {
      accepted_count: accepted.length,
      skipped_count: skipped.length,
      total_tasks: tasks.length,
    });
    goNext();
  };

  const skipMaintenance = useCallback(
    ({ replace }: { replace: boolean }) => {
      setAcceptedOemScheduleIds([]);
      setLastCompletedScreen(OB_SCREEN.MAINTENANCE);
      trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, OB_SCREEN.MAINTENANCE);
      goNext({ replace });
    },
    [setAcceptedOemScheduleIds, setLastCompletedScreen, goNext],
  );

  // Auto-skip when no bike data or no tasks available. Use `replace` so this
  // pass-through drops out of history — otherwise Back from Commitment lands
  // here and the auto-skip immediately bounces the rider forward again (with a
  // loading flash), making Back appear broken.
  useEffect(() => {
    if (!make || (tasks.length === 0 && !isLoading)) {
      skipMaintenance({ replace: true });
    }
  }, [make, tasks.length, isLoading, skipMaintenance]);

  if (!make || (tasks.length === 0 && !isLoading)) {
    return null;
  }

  const title = t('onboarding.v2MaintenanceTitleFull');
  const subtitle = done
    ? t('onboarding.v2MaintenancePreloaded', { bikeLabel })
    : t('onboarding.v2MaintenanceSwipeInstruction', { bikeLabel });

  if (isLoading) {
    // Keep the Back button + progress visible while fetching — a bare,
    // escape-less spinner would trap the rider if the request hangs (e.g. slow
    // network, or a cold cache after Back re-enters this screen).
    return (
      <OnboardingShell screen={OB_SCREEN.MAINTENANCE} onBack={onBack} title={title} scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={oc.textMuted} />
        </View>
      </OnboardingShell>
    );
  }

  const plate = (
    <OnboardingBikePlate make={make} model={model} year={year} size={PLATE_SIZE.COMPACT} />
  );

  if (!done) {
    /* ═══ SWIPE MODE ═══ */
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <OnboardingShell
          screen={OB_SCREEN.MAINTENANCE}
          onBack={onBack}
          title={title}
          subtitle={subtitle}
          scroll={false}
          contentStyle={{ gap: space.sm, paddingTop: space.xs }}
          secondary={{
            label: t('onboarding.v2MaintenanceSkipAll'),
            onPress: () => skipMaintenance({ replace: false }),
          }}
          footer={
            <Text
              style={[
                type.caption,
                { color: oc.textMuted, textAlign: 'center', paddingHorizontal: space.xl },
              ]}
            >
              {t('onboarding.v2MaintenanceReassurance')}
            </Text>
          }
        >
          {plate}

          {/* Counter + progress dots */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={[type.figureSmall, { color: oc.textSecondary }]}>
              {currentIdx + 1}
              <Text style={{ color: oc.textMuted }}> / {tasks.length}</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: space.xxs }}>
              {tasks.map((task, i) => (
                <View
                  key={task.id}
                  style={{
                    width: i === currentIdx ? 16 : 4,
                    height: 4,
                    borderRadius: radius.pill,
                    backgroundColor:
                      i < currentIdx
                        ? accepted.includes(task.id)
                          ? oc.acceptGreen
                          : oc.rejectDotFaded
                        : i === currentIdx
                          ? oc.textPrimary
                          : oc.dotInactive,
                  }}
                />
              ))}
            </View>
          </View>

          {/* Card stack — grows into the free space, capped at the card's design height */}
          <View style={{ flex: 1, minHeight: 240, maxHeight: CARD_HEIGHT }}>
            {tasks[currentIdx + 2] && (
              <Animated.View
                key={`bg-${tasks[currentIdx + 2].id}`}
                style={[
                  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
                  thirdCardStyle,
                ]}
              >
                <TaskCard
                  task={tasks[currentIdx + 2]}
                  dragDirection={noDrag}
                  measurementSystem={measurementSystem}
                />
              </Animated.View>
            )}
            {tasks[currentIdx + 1] && (
              <Animated.View
                key={`bg-${tasks[currentIdx + 1].id}`}
                style={[
                  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
                  nextCardStyle,
                ]}
              >
                <TaskCard
                  task={tasks[currentIdx + 1]}
                  dragDirection={noDrag}
                  measurementSystem={measurementSystem}
                />
              </Animated.View>
            )}

            {/* Top swipeable card */}
            {currentTask && (
              <GestureDetector gesture={panGesture}>
                <Animated.View
                  key={`top-${currentTask.id}`}
                  style={[
                    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
                    topCardStyle,
                  ]}
                >
                  <TaskCard
                    task={currentTask}
                    dragDirection={dragDirection}
                    measurementSystem={measurementSystem}
                  />
                </Animated.View>
              </GestureDetector>
            )}
          </View>

          {/* Skip / add buttons */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: space.lg,
            }}
          >
            <Pressable
              onPress={() => handleButtonSwipe('left')}
              accessibilityRole="button"
              accessibilityLabel="Skip this task"
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.pill,
                backgroundColor: oc.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={22} color={oc.rejectRed} strokeWidth={2.5} />
            </Pressable>

            <Text
              style={[type.caption, { color: oc.textMuted, textAlign: 'center', minWidth: 80 }]}
            >
              {t('onboarding.v2MaintenanceSwipeOrTap')}
            </Text>

            <Pressable
              onPress={() => handleButtonSwipe('right')}
              accessibilityRole="button"
              accessibilityLabel="Add this task"
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.pill,
                backgroundColor: oc.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={22} color={oc.acceptGreen} strokeWidth={2.5} />
            </Pressable>
          </View>
        </OnboardingShell>
      </GestureHandlerRootView>
    );
  }

  /* ═══ SUMMARY MODE ═══ */
  return (
    <OnboardingShell
      screen={OB_SCREEN.MAINTENANCE}
      onBack={onBack}
      title={title}
      subtitle={subtitle}
      primary={{
        label: t('onboarding.continue', { defaultValue: 'Continue' }),
        onPress: handleContinue,
      }}
      secondary={
        skipped.length > 0
          ? {
              label: t('onboarding.v2MaintenanceReconsider', { count: skipped.length }),
              onPress: () => {
                setCurrentIdx(0);
                setAccepted([]);
                setSkipped([]);
              },
            }
          : undefined
      }
    >
      {plate}

      <Text
        accessibilityRole="header"
        style={[type.sectionTitle, { color: oc.textPrimary, marginTop: space.xl }]}
      >
        {t('onboarding.v2MaintenanceTaskCount', { count: accepted.length })}{' '}
        {accepted.length === 0
          ? t('onboarding.v2MaintenanceAddLater')
          : t('onboarding.v2MaintenanceOnRadar')}
      </Text>
      <Text
        style={[
          type.subhead,
          { color: oc.textSecondary, marginTop: space.xxs, marginBottom: space.md },
        ]}
      >
        {t('onboarding.v2MaintenanceReminders')}
      </Text>

      {/* Accepted tasks — inset grouped rows */}
      {accepted.length > 0 && (
        <View
          style={{
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: oc.surface,
            overflow: 'hidden',
            marginBottom: space.md,
          }}
        >
          {accepted.map((id, i) => {
            const task = tasks.find((tk) => tk.id === id);
            if (!task) return null;
            return (
              <Animated.View
                key={id}
                entering={FadeInUp.delay(i * 50).duration(240)}
                style={{
                  minHeight: 56,
                  paddingVertical: space.xs,
                  paddingHorizontal: space.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: oc.line,
                }}
              >
                <Check size={18} color={oc.success} strokeWidth={2.5} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>{task.taskName}</Text>
                  <Text
                    style={[type.caption, { color: oc.textMuted, fontVariant: ['tabular-nums'] }]}
                  >
                    {task.intervalKm
                      ? `${convertIntervalDistance(
                          task.intervalKm,
                          measurementSystem,
                        ).toLocaleString()} ${intervalDistanceUnit(measurementSystem)}`
                      : ''}
                    {task.intervalKm && task.intervalDays ? ' · ' : ''}
                    {task.intervalDays ? `${Math.round(task.intervalDays / 30)} mo` : ''}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Spec-data disclaimer (R5) — after the schedule list */}
      <OemDisclaimerCard isDark={isDark} delay={accepted.length * 50} />
    </OnboardingShell>
  );
}
