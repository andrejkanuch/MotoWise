import { GetOnboardingRevealDocument } from '@motovault/graphql';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingNext } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { queryKeys } from '../../lib/query-keys';
import { useOnboardingStore } from '../../stores/onboarding.store';

/** Hard cap — never spin past the day-0 budget; advance even if data is slow. */
const MAX_DURATION_MS = 2500;
const STEP_INTERVAL_MS = 520;

const STEP_KEYS = ['obBuildRecalls', 'obBuildSchedule', 'obBuildCosts', 'obBuildRiders'] as const;

export default function BuildingPlanScreen() {
  const { t } = useTranslation();
  const goNext = useOnboardingNext(OB_SCREEN.BUILDING_PLAN);
  const queryClient = useQueryClient();
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const [activeStep, setActiveStep] = useState(0);
  const advancedRef = useRef(false);

  const pulse = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.3, { duration: 1200 }), -1, true);
    pulseOpacity.value = withRepeat(withTiming(0.2, { duration: 1200 }), -1, true);
  }, [pulse, pulseOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: pulseOpacity.value,
  }));

  // Warm the Reveal cache so the next screen renders instantly when possible.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.BUILDING_PLAN);
    setLastCompletedScreen(OB_SCREEN.BUILDING_PLAN);

    if (bikeData?.make) {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.onboarding.reveal(bikeData.make, bikeData.year, bikeData.model),
        queryFn: () =>
          gqlFetcher(GetOnboardingRevealDocument, {
            make: bikeData.make,
            year: bikeData.year,
            model: bikeData.model || undefined,
          }),
      });
    }

    const stepTimers = STEP_KEYS.map((_, i) =>
      setTimeout(() => setActiveStep(i + 1), STEP_INTERVAL_MS * (i + 1)),
    );
    const advance = () => {
      if (advancedRef.current) return;
      advancedRef.current = true;
      // Pass-through loader: replace (don't push) so it drops out of history.
      // Otherwise Back from the Reveal pops here, the loader re-runs and pushes
      // Reveal again — an inescapable building-plan↔reveal loop.
      goNext({ replace: true });
    };
    const capTimer = setTimeout(advance, MAX_DURATION_MS);

    return () => {
      for (const timer of stepTimers) clearTimeout(timer);
      clearTimeout(capTimer);
    };
  }, []);

  const make = bikeData?.make || t('onboarding.obBuildYourBike');

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: ONBOARDING_COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
      }}
    >
      <View
        style={{
          width: 120,
          height: 120,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 30,
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: 60,
              borderWidth: 3,
              borderColor: ONBOARDING_COLORS.accent,
            },
            ringStyle,
          ]}
        />
        <View
          style={{
            width: 62,
            height: 62,
            borderRadius: 20,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: ONBOARDING_COLORS.accentBg,
          }}
        >
          <Sparkles size={30} color={ONBOARDING_COLORS.warm2} />
        </View>
      </View>

      <Text
        style={{
          fontFamily: 'InstrumentSerif-Regular',
          fontSize: 30,
          lineHeight: 32,
          textAlign: 'center',
          color: ONBOARDING_COLORS.textPrimary,
          marginBottom: 8,
        }}
      >
        {t('onboarding.obBuildTitle')}{' '}
        <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
          {t('onboarding.obBuildTitleItalic')}
        </Text>
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: ONBOARDING_COLORS.ink3,
          textAlign: 'center',
          marginBottom: 30,
        }}
      >
        {t('onboarding.obBuildSubtitle')}
      </Text>

      <View style={{ width: '100%', maxWidth: 300, gap: 12 }}>
        {STEP_KEYS.map((key, i) => {
          const done = i < activeStep;
          const current = i === activeStep;
          return (
            <View
              key={key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: done || current ? 1 : 0.32,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? ONBOARDING_COLORS.success : 'transparent',
                  borderWidth: done ? 0 : current ? 2 : 1,
                  borderColor: current
                    ? ONBOARDING_COLORS.warm
                    : ONBOARDING_COLORS.cardBorderDefault,
                }}
              >
                {done ? (
                  <Check size={13} color={ONBOARDING_COLORS.background} strokeWidth={3} />
                ) : null}
              </View>
              <Text
                style={{
                  fontFamily: 'GeistMono-Medium',
                  fontSize: 12.5,
                  color: done
                    ? ONBOARDING_COLORS.textSecondary
                    : current
                      ? ONBOARDING_COLORS.textPrimary
                      : ONBOARDING_COLORS.ink3,
                }}
              >
                {t(`onboarding.${key}`, { make })}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
