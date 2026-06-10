import { OemSchedulesPreviewDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Check, ChevronLeft, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskCard } from '../../components/onboarding/maintenance/task-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { getBrandColor } from '../../config/brand-dna';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerImpact } from '../../utils/haptics';

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;
const CARD_HEIGHT = 340;
const EXIT_SPRING = { damping: 20, stiffness: 200, mass: 0.8 };
const SNAP_BACK_SPRING = { damping: 18, stiffness: 350, mass: 0.6 };

export default function MaintenanceScreen() {
  const { t } = useTranslation();
  const onBack = useOnboardingBack(OB_SCREEN.MAINTENANCE);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.MAINTENANCE);
  const goNext = useOnboardingNext(OB_SCREEN.MAINTENANCE);
  const insets = useSafeAreaInsets();
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const setAcceptedOemScheduleIds = useOnboardingStore((s) => s.setAcceptedOemScheduleIds);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const make = bikeData?.make ?? '';
  const model = bikeData?.model ?? undefined;
  const year = bikeData?.year ?? undefined;
  const brandColor = getBrandColor(make);
  const bikeLabel = [model, make].filter(Boolean).join(' · ') || 'your bike';

  // Fetch OEM schedules for this make/model/year
  const { data, isLoading } = useQuery({
    queryKey: ['oemSchedulesPreview', make, model, year],
    queryFn: () => gqlFetcher(OemSchedulesPreviewDocument, { make, model, year }),
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

  const handleSkipAll = useCallback(() => {
    setAcceptedOemScheduleIds([]);
    setLastCompletedScreen(OB_SCREEN.MAINTENANCE);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, OB_SCREEN.MAINTENANCE);
    goNext();
  }, [setAcceptedOemScheduleIds, setLastCompletedScreen, goNext]);

  // Auto-skip when no bike data or no tasks available
  useEffect(() => {
    if (!make || (tasks.length === 0 && !isLoading)) {
      handleSkipAll();
    }
  }, [make, tasks.length, isLoading, handleSkipAll]);

  if (!make || (tasks.length === 0 && !isLoading)) {
    return null;
  }

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: ONBOARDING_COLORS.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={ONBOARDING_COLORS.warm} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      {/* Back button */}
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{
          position: 'absolute',
          top: insets.top + 44,
          left: 16,
          zIndex: 10,
          width: 36,
          height: 36,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: ONBOARDING_COLORS.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronLeft size={20} color={ONBOARDING_COLORS.textPrimary} />
      </Pressable>

      {/* Header */}
      <View style={{ paddingHorizontal: 26, paddingTop: 56 }}>
        <Animated.View entering={FadeIn.duration(400)}>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 30,
              lineHeight: 32,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            {t('onboarding.v2MaintenanceTitle')}
            {'\n'}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              {t('onboarding.v2MaintenanceTitleItalic')}
            </Text>
          </Text>
          <Text
            style={{
              fontSize: 13.5,
              color: ONBOARDING_COLORS.textSubtitle,
              lineHeight: 19,
              maxWidth: 320,
            }}
          >
            {done
              ? t('onboarding.v2MaintenancePreloaded', { bikeLabel })
              : t('onboarding.v2MaintenanceSwipeInstruction', { bikeLabel })}
          </Text>
        </Animated.View>
      </View>

      {!done ? (
        /* ═══ SWIPE MODE ═══ */
        <>
          {/* Counter + progress dots */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 26,
              paddingTop: 14,
            }}
          >
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 1.7,
                color: ONBOARDING_COLORS.textSoft,
                textTransform: 'uppercase',
              }}
            >
              {String(currentIdx + 1).padStart(2, '0')}{' '}
              <Text style={{ color: ONBOARDING_COLORS.textFaintest }}>
                / {String(tasks.length).padStart(2, '0')}
              </Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {tasks.map((task, i) => (
                <View
                  key={task.id}
                  style={{
                    width: i === currentIdx ? 16 : 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor:
                      i < currentIdx
                        ? accepted.includes(task.id)
                          ? ONBOARDING_COLORS.acceptGreen
                          : ONBOARDING_COLORS.rejectDotFaded
                        : i === currentIdx
                          ? brandColor
                          : ONBOARDING_COLORS.dotInactive,
                  }}
                />
              ))}
            </View>
          </View>

          {/* Card stack */}
          <View
            style={{
              flex: 1,
              marginHorizontal: 24,
              marginTop: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: '100%', height: CARD_HEIGHT, position: 'relative' }}>
              {/* Background cards — animate as top card moves */}
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
                    brandColor={brandColor}
                    dragDirection={noDrag}
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
                    brandColor={brandColor}
                    dragDirection={noDrag}
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
                      brandColor={brandColor}
                      dragDirection={dragDirection}
                    />
                  </Animated.View>
                </GestureDetector>
              )}
            </View>
          </View>

          {/* Action buttons */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 18,
              paddingBottom: 12,
            }}
          >
            <Pressable
              onPress={() => handleButtonSwipe('left')}
              accessibilityRole="button"
              accessibilityLabel="Skip this task"
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: ONBOARDING_COLORS.surfaceInput,
                borderWidth: 1.5,
                borderColor: ONBOARDING_COLORS.rejectBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={22} color={ONBOARDING_COLORS.rejectRed} strokeWidth={2.5} />
            </Pressable>

            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 10,
                letterSpacing: 1.7,
                color: ONBOARDING_COLORS.textFaint,
                textTransform: 'uppercase',
                textAlign: 'center',
                minWidth: 80,
              }}
            >
              {t('onboarding.v2MaintenanceSwipeOrTap')}
            </Text>

            <Pressable
              onPress={() => handleButtonSwipe('right')}
              accessibilityRole="button"
              accessibilityLabel="Add this task"
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: ONBOARDING_COLORS.surfaceInput,
                borderWidth: 1.5,
                borderColor: ONBOARDING_COLORS.acceptBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={22} color={ONBOARDING_COLORS.acceptGreen} strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Skip all + reassurance */}
          <View style={{ alignItems: 'center', paddingBottom: insets.bottom + 16, gap: 6 }}>
            <Pressable onPress={handleSkipAll} style={{ padding: 8 }}>
              <Text
                style={{
                  fontSize: 13,
                  color: ONBOARDING_COLORS.textLabel,
                  fontWeight: '500',
                  textDecorationLine: 'underline',
                  textDecorationColor: ONBOARDING_COLORS.underlineFaint,
                }}
              >
                {t('onboarding.v2MaintenanceSkipAll')}
              </Text>
            </Pressable>
            <Text
              style={{
                fontSize: 11,
                color: ONBOARDING_COLORS.textFaded,
                textAlign: 'center',
                paddingHorizontal: 40,
              }}
            >
              {t('onboarding.v2MaintenanceReassurance')}
            </Text>
          </View>
        </>
      ) : (
        /* ═══ SUMMARY MODE ═══ */
        <>
          <ScrollView
            style={{ flex: 1, marginTop: 20 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          >
            {/* Plan ready badge */}
            <Animated.View
              entering={FadeIn.duration(380)}
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: `${brandColor}24`,
                borderWidth: 1,
                borderColor: `${brandColor}59`,
                marginBottom: 16,
              }}
            >
              <Check size={11} color={brandColor} strokeWidth={3} />
              <Text
                style={{
                  fontFamily: 'GeistMono-Medium',
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 1.7,
                  textTransform: 'uppercase',
                  color: brandColor,
                }}
              >
                {t('onboarding.v2MaintenancePlanReady')}
              </Text>
            </Animated.View>

            {/* Summary headline */}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 30,
                lineHeight: 32,
                color: ONBOARDING_COLORS.textWhite,
                letterSpacing: -0.4,
                marginBottom: 6,
              }}
            >
              {t('onboarding.v2MaintenanceTaskCount', { count: accepted.length })}
              {'\n'}
              <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: brandColor }}>
                {accepted.length === 0
                  ? t('onboarding.v2MaintenanceAddLater')
                  : t('onboarding.v2MaintenanceOnRadar')}
              </Text>
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: ONBOARDING_COLORS.textSubtitle,
                lineHeight: 19,
                marginBottom: 18,
                maxWidth: 320,
              }}
            >
              {t('onboarding.v2MaintenanceReminders')}
            </Text>

            {/* Accepted tasks list */}
            {accepted.length > 0 && (
              <View style={{ gap: 6, marginBottom: 16 }}>
                {accepted.map((id, i) => {
                  const task = tasks.find((t) => t.id === id);
                  if (!task) return null;
                  return (
                    <Animated.View
                      key={id}
                      entering={FadeInUp.delay(i * 50).duration(380)}
                      style={{
                        padding: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderCurve: 'continuous',
                        backgroundColor: ONBOARDING_COLORS.surfaceInput,
                        borderWidth: 1,
                        borderColor: ONBOARDING_COLORS.borderSubtle,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 11,
                      }}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          borderCurve: 'continuous',
                          backgroundColor: `${brandColor}2E`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={15} color={brandColor} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            fontSize: 13.5,
                            fontWeight: '600',
                            color: ONBOARDING_COLORS.textWhite,
                            letterSpacing: -0.2,
                          }}
                        >
                          {task.taskName}
                        </Text>
                        <Text
                          style={{
                            fontFamily: 'GeistMono-Medium',
                            fontSize: 11,
                            color: ONBOARDING_COLORS.textSoft,
                            letterSpacing: 0.4,
                            marginTop: 2,
                          }}
                        >
                          {task.intervalKm ? `${task.intervalKm.toLocaleString()} km` : ''}
                          {task.intervalKm && task.intervalDays ? ' · ' : ''}
                          {task.intervalDays ? `${Math.round(task.intervalDays / 30)} mo` : ''}
                        </Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            )}

            {/* Reconsider link */}
            {skipped.length > 0 && (
              <Pressable
                onPress={() => {
                  setCurrentIdx(0);
                  setAccepted([]);
                  setSkipped([]);
                }}
                style={{ alignSelf: 'center', padding: 8 }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: ONBOARDING_COLORS.textMutedIcon,
                    textDecorationLine: 'underline',
                    textDecorationColor: ONBOARDING_COLORS.underlineFaint,
                  }}
                >
                  {t('onboarding.v2MaintenanceReconsider', { count: skipped.length })}
                </Text>
              </Pressable>
            )}
          </ScrollView>

          {/* Continue button */}
          <View
            style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 16 }}
          >
            <OnboardingContinueButton
              label={t('onboarding.continue', { defaultValue: 'Continue' })}
              onPress={handleContinue}
              disabled={false}
            />
          </View>
        </>
      )}
    </GestureHandlerRootView>
  );
}
