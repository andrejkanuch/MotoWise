import { CompleteOnboardingDocument, type CompleteOnboardingInput } from '@motovault/graphql';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { uploadBikePhoto } from '../../lib/image-upload';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';

const MIN_ANIMATION_MS = 3000;
const MAX_RETRIES = 3;

const PROGRESS_STEPS = [
  { key: 'buildingStep1', delayMs: 0 },
  { key: 'buildingStep2', delayMs: 800 },
  { key: 'buildingStep3', delayMs: 1600 },
  { key: 'buildingStep4', delayMs: 2400 },
] as const;

export default function BuildingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const bikeData = useOnboardingStore((s) => s.bikeData);
  const riderType = useOnboardingStore((s) => s.riderType);
  const goals = useOnboardingStore((s) => s.goals);
  const measurementSystem = useOnboardingStore((s) => s.measurementSystem);
  const maintenanceReminders = useOnboardingStore((s) => s.maintenanceReminders);
  const seasonalTips = useOnboardingStore((s) => s.seasonalTips);
  const recallAlerts = useOnboardingStore((s) => s.recallAlerts);
  const currency = useOnboardingStore((s) => s.currency);
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);

  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const [mutationDone, setMutationDone] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const hasNavigated = useRef(false);

  // Pulsing ring animation
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.6);

  useEffect(() => {
    ringScale.value = withRepeat(withTiming(1.4, { duration: 1200 }), -1, true);
    ringOpacity.value = withRepeat(withTiming(0.15, { duration: 1200 }), -1, true);
  }, [ringScale, ringOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  // Stagger progress steps
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const step of PROGRESS_STEPS) {
      timers.push(
        setTimeout(() => {
          setVisibleSteps((prev) => [...prev, PROGRESS_STEPS.indexOf(step)]);
        }, step.delayMs),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  // Minimum animation timer
  useEffect(() => {
    const timer = setTimeout(() => setAnimationDone(true), MIN_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, []);

  // Fire mutation
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire on mount and on manual retry
  useEffect(() => {
    if (mutationDone || failed) return;

    let cancelled = false;

    const run = async () => {
      try {
        // Upload photo if available
        let bikePhotoUrl: string | undefined;
        if (bikeData?.photoUri) {
          try {
            // Use a temporary ID for onboarding upload
            const result = await uploadBikePhoto(bikeData.photoUri, 'onboarding', 'temp');
            bikePhotoUrl = result.publicUrl;
          } catch (photoError) {
            console.warn('Photo upload failed, continuing without photo:', photoError);
          }
        }

        const input: CompleteOnboardingInput = {
          riderType: riderType ?? 'daily_rider',
          goals: goals.length > 0 ? goals : ['maintenance'],
          measurementSystem: measurementSystem ?? undefined,
          maintenanceReminders,
          seasonalTips,
          recallAlerts,
          currency: currency ?? undefined,
          bikeMake: bikeData?.make ?? undefined,
          bikeModel: bikeData?.model ?? undefined,
          bikeYear: bikeData?.year ?? undefined,
          bikePhotoUrl,
        };

        await gqlFetcher(CompleteOnboardingDocument, { input });

        if (cancelled) return;

        await queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
        await queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });

        trackEvent(AnalyticsEvent.ONBOARDING_COMPLETED, {
          has_bike: !!bikeData,
          has_photo: !!bikePhotoUrl,
          rider_type: riderType,
          goals_count: goals.length,
        });

        setMutationDone(true);
      } catch (error) {
        if (cancelled) return;
        console.warn(`Onboarding mutation attempt ${retryCount + 1} failed:`, error);

        if (retryCount < MAX_RETRIES - 1) {
          setRetryCount((prev) => prev + 1);
        } else {
          setFailed(true);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [retryCount, mutationDone, failed]);

  // Auto-advance when both mutation and animation are done
  useEffect(() => {
    if (mutationDone && animationDone && !hasNavigated.current) {
      hasNavigated.current = true;
      router.replace('/(onboarding)/paywall');
    }
  }, [mutationDone, animationDone, router]);

  const handleSkipAndContinue = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    setOnboardingCompleted(true);
    router.replace('/(onboarding)/paywall');
  };

  const bikeLabel = bikeData
    ? [bikeData.year, bikeData.make, bikeData.model].filter(Boolean).join(' ')
    : null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: ONBOARDING_COLORS.background,
        paddingTop: insets.top,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
      }}
    >
      {/* App icon with pulsing ring */}
      <View
        style={{
          width: 140,
          height: 140,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 40,
        }}
      >
        {/* Pulsing outer ring */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 140,
              height: 140,
              borderRadius: 70,
              borderCurve: 'continuous',
              borderWidth: 1.5,
              borderColor: ONBOARDING_COLORS.warm,
            },
            ringStyle,
          ]}
        />
        {/* Static inner ring */}
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            borderCurve: 'continuous',
            borderWidth: 1.5,
            borderColor: `${ONBOARDING_COLORS.warm}60`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* App icon */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 22,
              borderCurve: 'continuous',
              overflow: 'hidden',
            }}
          >
            <Image
              source={require('../../assets/images/MotoVault.png')}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          </View>
        </View>
      </View>

      {/* Title */}
      <Animated.View entering={FadeIn.duration(300)}>
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 42,
            lineHeight: 48,
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.8,
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          Building your{'\n'}
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Italic',
              color: ONBOARDING_COLORS.warm2,
            }}
          >
            garage.
          </Text>
        </Text>
      </Animated.View>

      {/* Subtitle with bold bike name */}
      <Animated.View entering={FadeIn.delay(100).duration(250)}>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 21,
            color: ONBOARDING_COLORS.textSecondary,
            textAlign: 'center',
            marginBottom: 48,
          }}
        >
          Setting up{' '}
          {bikeLabel ? (
            <Text style={{ fontWeight: '700', color: ONBOARDING_COLORS.textPrimary }}>
              {bikeLabel}
            </Text>
          ) : (
            t('onboarding.buildingSubtitleDefault')
          )}
        </Text>
      </Animated.View>

      {/* Progress steps */}
      <View style={{ alignSelf: 'stretch', gap: 20, paddingHorizontal: 8 }}>
        {PROGRESS_STEPS.map((step, index) =>
          visibleSteps.includes(index) ? (
            <Animated.View
              key={step.key}
              entering={FadeInUp.duration(300)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  backgroundColor: ONBOARDING_COLORS.warm,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={18} color="#fff" strokeWidth={3} />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '500',
                  color: ONBOARDING_COLORS.textSecondary,
                }}
              >
                {t(`onboarding.${step.key}`)}
              </Text>
            </Animated.View>
          ) : null,
        )}
      </View>

      {/* Retry fallback */}
      {failed && (
        <Animated.View entering={FadeIn.duration(300)} style={{ marginTop: 32 }}>
          <Text
            onPress={handleSkipAndContinue}
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: ONBOARDING_COLORS.warm,
              textAlign: 'center',
            }}
          >
            {t('onboarding.buildingSkip')}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
