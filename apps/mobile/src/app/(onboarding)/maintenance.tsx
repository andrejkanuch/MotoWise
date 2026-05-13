import { OemSchedulesPreviewDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
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
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskCard } from '../../components/onboarding/maintenance/task-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { getBrandColor } from '../../config/brand-dna';
import { OB_ROUTE, TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { useOnboardingStore } from '../../stores/onboarding.store';

const SWIPE_THRESHOLD = 80;
const CARD_HEIGHT = 340;

export default function MaintenanceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const setAcceptedOemScheduleIds = useOnboardingStore((s) => s.setAcceptedOemScheduleIds);

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

      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(
          direction === 'right'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
        );
      }

      if (direction === 'right') {
        setAccepted((a) => [...a, currentTask.id]);
      } else {
        setSkipped((s) => [...s, currentTask.id]);
      }
      setCurrentIdx((i) => i + 1);
    },
    [currentTask],
  );

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.35;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(400, { duration: 300 });
        translateY.value = withTiming(-60, { duration: 300 });
        runOnJS(onSwipeComplete)('right');
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-400, { duration: 300 });
        translateY.value = withTiming(-60, { duration: 300 });
        runOnJS(onSwipeComplete)('left');
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
      }
    })
    .onFinalize(() => {
      // Reset for next card after animation (stay on UI thread)
      translateX.value = withDelay(320, withTiming(0, { duration: 0 }));
      translateY.value = withDelay(320, withTiming(0, { duration: 0 }));
    });

  const topCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-200, 0, 200], [-15, 0, 15])}deg` },
    ],
  }));

  const dragDirection = useDerivedValue(() => {
    if (translateX.value > 30) return 'right' as const;
    if (translateX.value < -30) return 'left' as const;
    return null;
  });

  const handleButtonSwipe = (direction: 'left' | 'right') => {
    translateX.value = withTiming(direction === 'right' ? 400 : -400, { duration: 300 });
    translateY.value = withTiming(-60, { duration: 300 });
    setTimeout(() => onSwipeComplete(direction), 300);
    translateX.value = withDelay(320, withTiming(0, { duration: 0 }));
    translateY.value = withDelay(320, withTiming(0, { duration: 0 }));
  };

  const handleContinue = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setAcceptedOemScheduleIds(accepted);
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'maintenance',
      step_index: 4,
      accepted_count: accepted.length,
      skipped_count: skipped.length,
      total_tasks: tasks.length,
    });
    router.push(OB_ROUTE.PAYWALL);
  };

  const handleSkipAll = useCallback(() => {
    setAcceptedOemScheduleIds([]);
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, {
      step: 'maintenance',
      step_index: 4,
    });
    router.push(OB_ROUTE.PAYWALL);
  }, [setAcceptedOemScheduleIds, router]);

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
      <OnboardingProgress screenIndex={4} totalScreens={TOTAL_SCREENS} />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
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
            {"Your bike's\n"}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              maintenance plan.
            </Text>
          </Text>
          <Text
            style={{
              fontSize: 13.5,
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 19,
              maxWidth: 320,
            }}
          >
            {done
              ? `Pre-loaded for ${bikeLabel}. Review your selection below.`
              : `Swipe each card right to add to ${bikeLabel}, left to skip.`}
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
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
              }}
            >
              {String(currentIdx + 1).padStart(2, '0')}{' '}
              <Text style={{ color: 'rgba(255,255,255,0.25)' }}>
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
                          ? '#4eba6f'
                          : 'rgba(196, 99, 74, 0.7)'
                        : i === currentIdx
                          ? brandColor
                          : 'rgba(255,255,255,0.12)',
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
              {/* Background cards */}
              {tasks.slice(currentIdx + 1, currentIdx + 3).map((task, i) => {
                const depth = i + 1;
                return (
                  <View
                    key={`bg-${task.id}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      transform: [{ scale: 1 - depth * 0.035 }, { translateY: depth * 12 }],
                      opacity: 1 - depth * 0.18,
                    }}
                  >
                    <TaskCard task={task} brandColor={brandColor} dragDirection={noDrag} />
                  </View>
                );
              })}

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
                backgroundColor: '#1a1812',
                borderWidth: 1.5,
                borderColor: 'rgba(196, 99, 74, 0.5)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={22} color="#C4634A" strokeWidth={2.5} />
            </Pressable>

            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 10,
                letterSpacing: 1.7,
                color: 'rgba(255,255,255,0.32)',
                textTransform: 'uppercase',
                textAlign: 'center',
                minWidth: 80,
              }}
            >
              {'Swipe\nor tap'}
            </Text>

            <Pressable
              onPress={() => handleButtonSwipe('right')}
              accessibilityRole="button"
              accessibilityLabel="Add this task"
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#1a1812',
                borderWidth: 1.5,
                borderColor: 'rgba(78, 186, 111, 0.5)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={22} color="#4eba6f" strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Skip all + reassurance */}
          <View style={{ alignItems: 'center', paddingBottom: insets.bottom + 16, gap: 6 }}>
            <Pressable onPress={handleSkipAll} style={{ padding: 8 }}>
              <Text
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.42)',
                  fontWeight: '500',
                  textDecorationLine: 'underline',
                  textDecorationColor: 'rgba(255,255,255,0.16)',
                }}
              >
                Skip — I'll set this up later
              </Text>
            </Pressable>
            <Text
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                textAlign: 'center',
                paddingHorizontal: 40,
              }}
            >
              Edit, customize, or remove anytime from your bike's details.
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
                Plan ready
              </Text>
            </Animated.View>

            {/* Summary headline */}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 30,
                lineHeight: 32,
                color: '#fff',
                letterSpacing: -0.4,
                marginBottom: 6,
              }}
            >
              {accepted.length} task{accepted.length === 1 ? '' : 's'}
              {'\n'}
              <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: brandColor }}>
                {accepted.length === 0 ? "— you'll add later." : 'on your radar.'}
              </Text>
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.55)',
                lineHeight: 19,
                marginBottom: 18,
                maxWidth: 320,
              }}
            >
              We'll send reminders before each one comes due. You can edit or remove any task later.
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
                        backgroundColor: '#1a1812',
                        borderWidth: 1,
                        borderColor: '#2a2520',
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
                            color: '#fff',
                            letterSpacing: -0.2,
                          }}
                        >
                          {task.taskName}
                        </Text>
                        <Text
                          style={{
                            fontFamily: 'GeistMono-Medium',
                            fontSize: 11,
                            color: 'rgba(255,255,255,0.5)',
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
                    color: 'rgba(255,255,255,0.4)',
                    textDecorationLine: 'underline',
                    textDecorationColor: 'rgba(255,255,255,0.15)',
                  }}
                >
                  Reconsider the {skipped.length} I skipped
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
