import { useRouter } from 'expo-router';
import { type LucideIcon, MapIcon, Receipt, Route, Wrench } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { OB_ROUTE, OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext } from '../../hooks/use-onboarding-flow';
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
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const onBack = useOnboardingBack(OB_SCREEN.NO_BIKE_VALUE);
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
    <OnboardingShell
      screen={OB_SCREEN.NO_BIKE_VALUE}
      onBack={onBack}
      title={t('onboarding.obNoBikeTitleFull')}
      subtitle={t('onboarding.obNoBikeSubtitle')}
      primary={{ label: t('onboarding.continue'), onPress: handleContinue }}
      secondary={{ label: t('onboarding.obNoBikeAddBike'), onPress: handleAddBike }}
    >
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
              entering={reduceMotion ? undefined : FadeInUp.delay(index * 50).duration(240)}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: space.sm,
                padding: space.md,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: oc.line,
              }}
            >
              <Icon size={20} color={oc.textMuted} style={{ marginTop: 1 }} />
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
    </OnboardingShell>
  );
}
