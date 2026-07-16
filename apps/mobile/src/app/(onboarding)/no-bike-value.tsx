import { useRouter } from 'expo-router';
import { Bike, type LucideIcon, MapIcon, Receipt, Route, Wrench } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_ROUTE, OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

/**
 * No-bike value screen (P2.3 / T4b). Riders who skip bike-setup would otherwise
 * be routed straight past the Reveal/Maintenance/Commitment payoff and dumped on
 * the paywall + an empty garage. This is the inverse payoff: it shows the
 * universal value MotoVault delivers and offers a one-tap path back to add a
 * bike. Shown ONLY when there's no bike (see NO_BIKE_SCREENS in config/onboarding).
 *
 * Goals aren't chosen until after this step in both flows, so the pillar order is
 * a fixed, data-grounded default (rides + expenses lead — the two most-selected
 * onboarding goals) rather than personalized.
 */

interface ValuePillar {
  readonly icon: LucideIcon;
  readonly color: string;
  readonly titleKey: string;
  readonly bodyKey: string;
}

const VALUE_PILLARS: readonly ValuePillar[] = [
  {
    icon: Route,
    color: ONBOARDING_COLORS.accentBlue,
    titleKey: 'onboarding.obNoBikeRidesTitle',
    bodyKey: 'onboarding.obNoBikeRidesBody',
  },
  {
    icon: Receipt,
    color: ONBOARDING_COLORS.warm2,
    titleKey: 'onboarding.obNoBikeExpensesTitle',
    bodyKey: 'onboarding.obNoBikeExpensesBody',
  },
  {
    icon: Wrench,
    color: ONBOARDING_COLORS.success,
    titleKey: 'onboarding.obNoBikeServiceTitle',
    bodyKey: 'onboarding.obNoBikeServiceBody',
  },
  {
    icon: MapIcon,
    color: ONBOARDING_COLORS.teal,
    titleKey: 'onboarding.obNoBikeRoutesTitle',
    bodyKey: 'onboarding.obNoBikeRoutesBody',
  },
] as const;

export default function NoBikeValueScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const onBack = useOnboardingBack(OB_SCREEN.NO_BIKE_VALUE);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.NO_BIKE_VALUE);
  const goNext = useOnboardingNext(OB_SCREEN.NO_BIKE_VALUE);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.NO_BIKE_VALUE);
  }, []);

  const handleContinue = () => {
    setLastCompletedScreen(OB_SCREEN.NO_BIKE_VALUE);
    goNext();
  };

  // Recovery path: navigate straight to bike-setup so a skipper can still add a
  // bike and unlock the full personalized flow. Using the typed route (not
  // onBack) is deterministic — in the invested flow the loader (building-plan)
  // sits between bike-setup and here, so a history pop could land on the loader
  // and bounce forward again.
  const handleAddBike = () => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, OB_SCREEN.NO_BIKE_VALUE, {
      action: 'add_bike',
    });
    router.navigate(OB_ROUTE.BIKE_SETUP);
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <OnboardingBackButton
        onPress={onBack}
        style={{ position: 'absolute', top: insets.top + 44, left: 16, zIndex: 10 }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 72, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* eyebrow */}
        <Animated.View
          entering={FadeInUp.duration(280)}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 5,
            paddingHorizontal: 11,
            borderRadius: 999,
            borderCurve: 'continuous',
            backgroundColor: ONBOARDING_COLORS.accentBg,
            borderWidth: 1,
            borderColor: ONBOARDING_COLORS.warm,
            marginBottom: 14,
          }}
        >
          <Bike size={13} color={ONBOARDING_COLORS.warm2} />
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 10,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.warm2,
            }}
          >
            {t('onboarding.obNoBikeEyebrow')}
          </Text>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(70).duration(280)}
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 34,
            lineHeight: 37,
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.7,
            marginBottom: 12,
          }}
        >
          {t('onboarding.obNoBikeTitle')}{' '}
          <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
            {t('onboarding.obNoBikeTitleAccent')}
          </Text>
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(130).duration(280)}
          style={{
            fontSize: 14.5,
            color: ONBOARDING_COLORS.textSecondary,
            lineHeight: 21,
            marginBottom: 22,
          }}
        >
          {t('onboarding.obNoBikeSubtitle')}
        </Animated.Text>

        <View style={{ gap: 12 }}>
          {VALUE_PILLARS.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <Animated.View
                key={pillar.titleKey}
                entering={FadeInUp.delay(150 + index * 50).duration(280)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 13,
                  borderRadius: 18,
                  borderCurve: 'continuous',
                  padding: 15,
                  backgroundColor: ONBOARDING_COLORS.cardBg,
                  borderWidth: 1,
                  borderColor: ONBOARDING_COLORS.cardBorderDefault,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${pillar.color}26`,
                  }}
                >
                  <Icon size={19} color={pillar.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: ONBOARDING_COLORS.textPrimary,
                      lineHeight: 20,
                    }}
                  >
                    {t(pillar.titleKey as never)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: ONBOARDING_COLORS.textSecondary,
                      lineHeight: 18,
                      marginTop: 3,
                    }}
                  >
                    {t(pillar.bodyKey as never)}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 22,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: ONBOARDING_COLORS.background,
        }}
      >
        <OnboardingContinueButton label={t('onboarding.continue')} onPress={handleContinue} />
        <Pressable
          onPress={handleAddBike}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.obNoBikeAddBike')}
          style={{ marginTop: 12, alignSelf: 'center' }}
        >
          <Text style={{ fontSize: 13.5, color: ONBOARDING_COLORS.textMuted }}>
            {t('onboarding.obNoBikeAddBike')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
