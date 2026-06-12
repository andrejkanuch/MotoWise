import { Bell, BookMarked, Check, DollarSign, Shield, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { getPrimaryConcern, OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerImpact } from '../../utils/haptics';

/** Concern ids — drive the Reveal emphasis + paywall value-prop ordering. */
export const STAY_ON_TOP_OPTIONS = [
  {
    id: 'never_miss_service',
    labelKey: 'obStayServiceLabel',
    subKey: 'obStayServiceSub',
    icon: Bell,
  },
  {
    id: 'avoid_surprise_costs',
    labelKey: 'obStayCostsLabel',
    subKey: 'obStayCostsSub',
    icon: DollarSign,
  },
  {
    id: 'keep_resale_value',
    labelKey: 'obStayResaleLabel',
    subKey: 'obStayResaleSub',
    icon: BookMarked,
  },
  {
    id: 'catch_issues_early',
    labelKey: 'obStayIssuesLabel',
    subKey: 'obStayIssuesSub',
    icon: Shield,
  },
  {
    id: 'just_enjoy',
    labelKey: 'obStayEnjoyLabel',
    subKey: 'obStayEnjoySub',
    icon: Sparkles,
    casual: true,
  },
] as const;

export default function StayOnTopScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const onBack = useOnboardingBack(OB_SCREEN.STAY_ON_TOP);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.STAY_ON_TOP);
  const goNext = useOnboardingNext(OB_SCREEN.STAY_ON_TOP);
  const setStayOnTopOf = useOnboardingStore((s) => s.setStayOnTopOf);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.STAY_ON_TOP);
  }, []);

  const toggle = (id: string) => {
    triggerImpact();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleContinue = () => {
    const ids = Array.from(selected);
    setStayOnTopOf(ids);
    setLastCompletedScreen(OB_SCREEN.STAY_ON_TOP);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.STAY_ON_TOP, {
      concerns: ids.join(','),
      concerns_count: ids.length,
      primary_concern: getPrimaryConcern(ids),
    });
    goNext();
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
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 72, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 11,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.warm2,
              marginBottom: 12,
            }}
          >
            {t('onboarding.obStayEyebrow')}
          </Text>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 32,
              lineHeight: 34,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.7,
            }}
          >
            {t('onboarding.obStayTitle')}{' '}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              {t('onboarding.obStayTitleItalic')}
            </Text>
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: ONBOARDING_COLORS.textSecondary,
              lineHeight: 20,
              marginTop: 10,
              marginBottom: 28,
              maxWidth: 320,
            }}
          >
            {t('onboarding.obStayWhy')}
          </Text>
        </Animated.View>

        <View style={{ gap: 10 }}>
          {STAY_ON_TOP_OPTIONS.map((option, index) => {
            const Icon = option.icon;
            const on = selected.has(option.id);
            return (
              <Animated.View
                key={option.id}
                entering={FadeInUp.delay(140 + index * 65).duration(320)}
              >
                <Pressable
                  onPress={() => toggle(option.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${t(`onboarding.${option.labelKey}`)}, ${t(`onboarding.${option.subKey}`)}`}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 13,
                    padding: 14,
                    minHeight: 62,
                    borderRadius: 15,
                    borderCurve: 'continuous',
                    backgroundColor: on ? ONBOARDING_COLORS.accentBg : ONBOARDING_COLORS.cardBg,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? ONBOARDING_COLORS.warm : ONBOARDING_COLORS.cardBorderDefault,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? ONBOARDING_COLORS.accentBg : ONBOARDING_COLORS.surface2,
                    }}
                  >
                    <Icon size={20} color={on ? ONBOARDING_COLORS.warm2 : ONBOARDING_COLORS.ink3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: ONBOARDING_COLORS.textPrimary,
                      }}
                    >
                      {t(`onboarding.${option.labelKey}`)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: ONBOARDING_COLORS.ink3,
                        lineHeight: 16,
                        marginTop: 2,
                        fontStyle: option.id === 'just_enjoy' ? 'italic' : 'normal',
                      }}
                    >
                      {t(`onboarding.${option.subKey}`)}
                    </Text>
                  </View>
                  {on ? (
                    <Animated.View
                      entering={ZoomIn.duration(200).springify()}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        borderCurve: 'continuous',
                        backgroundColor: ONBOARDING_COLORS.warm,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={16} color={ONBOARDING_COLORS.textOnAccent} strokeWidth={3} />
                    </Animated.View>
                  ) : (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        borderCurve: 'continuous',
                        borderWidth: 1.5,
                        borderColor: ONBOARDING_COLORS.cardBorderDefault,
                      }}
                    />
                  )}
                </Pressable>
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
          paddingHorizontal: 24,
          paddingTop: 14,
          paddingBottom: insets.bottom + 16,
          backgroundColor: ONBOARDING_COLORS.background,
        }}
      >
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 11,
            letterSpacing: 0.6,
            color: ONBOARDING_COLORS.ink3,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          {t('onboarding.obStayProof')}
        </Text>
        <OnboardingContinueButton
          label={t('onboarding.continue')}
          onPress={handleContinue}
          disabled={selected.size === 0}
        />
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 11,
            letterSpacing: 1,
            color: ONBOARDING_COLORS.textMuted,
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          {t('onboarding.obStayCount', { count: selected.size, total: STAY_ON_TOP_OPTIONS.length })}
        </Text>
      </View>
    </View>
  );
}
