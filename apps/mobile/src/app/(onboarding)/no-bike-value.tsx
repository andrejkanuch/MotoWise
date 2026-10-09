import { useRouter } from 'expo-router';
import { type LucideIcon, MapIcon, Receipt, Route, Wrench } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_ROUTE, OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { radius, space, type } from '../../theme/type';

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
  readonly titleKey: string;
  readonly bodyKey: string;
}

const VALUE_PILLARS: readonly ValuePillar[] = [
  {
    icon: Route,
    titleKey: 'onboarding.obNoBikeRidesTitle',
    bodyKey: 'onboarding.obNoBikeRidesBody',
  },
  {
    icon: Receipt,
    titleKey: 'onboarding.obNoBikeExpensesTitle',
    bodyKey: 'onboarding.obNoBikeExpensesBody',
  },
  {
    icon: Wrench,
    titleKey: 'onboarding.obNoBikeServiceTitle',
    bodyKey: 'onboarding.obNoBikeServiceBody',
  },
  {
    icon: MapIcon,
    titleKey: 'onboarding.obNoBikeRoutesTitle',
    bodyKey: 'onboarding.obNoBikeRoutesBody',
  },
] as const;

export default function NoBikeValueScreen() {
  const oc = useOnboardingColors();
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
    <View style={{ flex: 1, backgroundColor: oc.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <OnboardingBackButton
        onPress={onBack}
        style={{ position: 'absolute', top: insets.top + 40, left: space.md, zIndex: 10 }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: 72 + space.md,
          paddingBottom: 160,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeInUp.duration(280)}
          accessibilityRole="header"
          style={[type.largeTitle, { color: oc.textPrimary, marginBottom: space.sm }]}
        >
          {t('onboarding.obNoBikeTitleFull')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(60).duration(280)}
          style={[type.body, { color: oc.textSecondary, marginBottom: space.xl }]}
        >
          {t('onboarding.obNoBikeSubtitle')}
        </Animated.Text>

        <View
          style={{
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: oc.surface,
            overflow: 'hidden',
          }}
        >
          {VALUE_PILLARS.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <Animated.View
                key={pillar.titleKey}
                entering={FadeInUp.delay(index * 50).duration(280)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: space.sm,
                  padding: space.md,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: oc.line,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.control,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: oc.surface2,
                  }}
                >
                  <Icon size={18} color={oc.textSecondary} />
                </View>
                <View style={{ flex: 1, gap: space.xxs }}>
                  <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
                    {t(pillar.titleKey as never)}
                  </Text>
                  <Text style={[type.subhead, { color: oc.textSecondary }]}>
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
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.md,
          backgroundColor: oc.background,
        }}
      >
        <OnboardingContinueButton label={t('onboarding.continue')} onPress={handleContinue} />
        <Pressable
          onPress={handleAddBike}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.obNoBikeAddBike')}
          style={{
            marginTop: space.xxs,
            minHeight: 44,
            justifyContent: 'center',
            alignSelf: 'center',
          }}
        >
          <Text style={[type.bodyStrong, { color: oc.warm2 }]}>
            {t('onboarding.obNoBikeAddBike')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
