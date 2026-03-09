import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { gql } from 'graphql-request';
import { Bike, Check, LayoutDashboard, Search, Settings, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, {
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
    reset,
  } = useOnboardingStore();
  const queryClient = useQueryClient();

  const { mutateAsync: completeOnboarding } = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      gqlFetcher(
        gql`
          mutation CompleteOnboarding($input: CompleteOnboardingInput!) {
            completeOnboarding(input: $input) {
              id
              preferences
              createdAt
              updatedAt
            }
          }
        ` as unknown as Parameters<typeof gqlFetcher>[0],
        { input },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
  });

  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);
  const persisted = useRef(false);
  const [mutationDone, setMutationDone] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);

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
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once on mount only
  useEffect(() => {
    if (persisted.current) return;
    persisted.current = true;

    const input: Record<string, unknown> = {
      experienceLevel: experienceLevel ?? 'beginner',
      ridingGoals: ridingGoals.length > 0 ? ridingGoals : [],
      learningFormats: learningFormats.length > 0 ? learningFormats : [],
    };

    if (ridingFrequency) input.ridingFrequency = ridingFrequency;
    if (maintenanceStyle) input.maintenanceStyle = maintenanceStyle;

    if (bikeData) {
      input.bikeMake = bikeData.make;
      input.bikeModel = bikeData.model;
      input.bikeYear = bikeData.year;
      input.bikeType = bikeData.type;
      input.bikeMileage = bikeData.currentMileage;
      if (bikeData.nickname) input.bikeNickname = bikeData.nickname;
    }

    completeOnboarding(input)
      .then(() => {
        reset();
        setOnboardingCompleted(true);
        setMutationDone(true);
      })
      .catch((firstError) => {
        console.error('[Personalizing] First attempt failed:', firstError);
        // Retry once on failure, proceed regardless so user isn't stuck
        completeOnboarding(input)
          .then(() => {
            reset();
            setOnboardingCompleted(true);
            setMutationDone(true);
          })
          .catch((retryError) => {
            console.error('[Personalizing] Retry also failed:', retryError);
            // Don't reset() — preserve onboarding data so it can be retried later
            setOnboardingCompleted(true);
            setMutationDone(true);
          });
      });
  }, []);

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
      router.replace('/(tabs)/(home)');
    }
  }, [mutationDone, animationDone, router]);

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
    </View>
  );
}
