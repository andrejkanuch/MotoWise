import { CompleteOnboardingDocument, type CompleteOnboardingInput } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Bike, Check, LayoutDashboard, Search, Settings, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
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
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';

const STEP_ICONS = [Search, Bike, Settings, LayoutDashboard, Sparkles] as const;
const STEPS = [
  'personalizingStep1',
  'personalizingStep2',
  'personalizingStep3',
  'personalizingStep4',
  'personalizingStep5',
] as const;
const MIN_ANIMATION_MS = 4000;

export default function PersonalizingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [visibleSteps, setVisibleSteps] = useState(0);
  const {
    experienceLevel,
    bikeData,
    ridingGoals,
    ridingFrequency,
    maintenanceStyle,
    learningFormats,
    annualRepairSpend,
    maintenanceReminders,
    reminderChannel,
    seasonalTips,
    recallAlerts,
    weeklySummary,
    lastServiceDate,
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

  // Persist preferences to server
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire on mount and on manual retry
  useEffect(() => {
    const input: CompleteOnboardingInput = {
      experienceLevel: experienceLevel ?? 'beginner',
      ridingGoals: ridingGoals.length > 0 ? ridingGoals : [],
      learningFormats: learningFormats.length > 0 ? learningFormats : [],
      maintenanceReminders,
      seasonalTips,
      recallAlerts,
      weeklySummary,
      ...(ridingFrequency && { ridingFrequency }),
      ...(maintenanceStyle && { maintenanceStyle }),
      ...(annualRepairSpend && { annualRepairSpend }),
      ...(reminderChannel && { reminderChannel }),
      ...(lastServiceDate && { lastServiceDate }),
      ...(bikeData && {
        bikeMake: bikeData.make,
        bikeModel: bikeData.model,
        bikeYear: bikeData.year,
        bikeType: bikeData.type,
        bikeMileage: bikeData.currentMileage,
        ...(bikeData.nickname && { bikeNickname: bikeData.nickname }),
      }),
    };

    completeOnboarding(input)
      .then(() => {
        setOnboardingCompleted(true);
        setMutationDone(true);
      })
      .catch((error) => {
        console.error('[Personalizing] Attempt failed:', error);
        setShowRetry(true);
      });
  }, [retryCount]);

  // Animation steps + minimum display time
  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleSteps(1), 400),
      setTimeout(() => setVisibleSteps(2), 1000),
      setTimeout(() => setVisibleSteps(3), 1600),
      setTimeout(() => setVisibleSteps(4), 2400),
      setTimeout(() => setVisibleSteps(5), 3200),
      setTimeout(() => setAnimationDone(true), MIN_ANIMATION_MS),
    ];

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  // Navigate only when BOTH mutation succeeded AND animation finished
  useEffect(() => {
    if (mutationDone && animationDone) {
      reset();
      router.replace('/(tabs)/(home)');
    }
  }, [mutationDone, animationDone, router, reset]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0F172A',
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
              borderColor: '#818CF8',
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
            backgroundColor: '#818CF8',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={28} color="#FFFFFF" strokeWidth={2} />
        </View>
      </View>

      <Text
        style={{
          fontSize: 24,
          fontWeight: '800',
          color: '#FFFFFF',
          textAlign: 'center',
          marginBottom: 32,
        }}
      >
        {t('onboarding.personalizingTitle')}
      </Text>

      <View style={{ gap: 16, alignItems: 'flex-start' }}>
        {STEPS.map((stepKey, index) => {
          const StepIcon = STEP_ICONS[index];
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
              <StepIcon size={18} color="rgba(255,255,255,0.5)" />
              <Text
                style={{
                  fontSize: 16,
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                {t(`onboarding.${stepKey}`)}
              </Text>
              <Check size={16} color="#34D399" />
            </Animated.View>
          ) : null;
        })}
      </View>

      {showRetry && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ marginTop: 32, alignItems: 'center', gap: 12 }}
        >
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
            {t('onboarding.personalizingFailed')}
          </Text>
          {retryCount < 3 ? (
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
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Text style={{ color: '#818CF8', fontSize: 16, fontWeight: '600' }}>
                {t('common.retry')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                setOnboardingCompleted(true);
                reset();
                router.replace('/(tabs)/(home)');
              }}
              style={{
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Text style={{ color: '#818CF8', fontSize: 16, fontWeight: '600' }}>
                {t('onboarding.personalizingSkip')}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}
