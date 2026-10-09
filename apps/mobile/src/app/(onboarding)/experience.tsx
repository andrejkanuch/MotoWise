import type { ExperienceLevel } from '@motovault/types';
import { NotificationFeedbackType } from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { Bike, Check, Gauge, Medal } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { radius, space, type } from '../../theme/type';
import { triggerNotification } from '../../utils/haptics';

/** Pause after a pick before auto-advancing, so the affirmation registers. */
const AUTO_ADVANCE_MS = 600;

/** Icon tile beside each option; the card's row padding aligns the copy to it. */
const ICON_TILE = 44;

/* ─── Experience options ─── */

const EXPERIENCE_OPTIONS: {
  id: ExperienceLevel;
  labelKey: string;
  tenureKey: string;
  previewKey: string;
  affirmKey: string;
  badgeKey?: string;
  icon: typeof Bike;
}[] = [
  {
    id: 'beginner',
    labelKey: 'v2ExperienceBeginner',
    tenureKey: 'v2ExperienceBeginnerTenure',
    previewKey: 'v2ExperienceBeginnerPreview',
    affirmKey: 'v2AffirmBeginner',
    icon: Bike,
  },
  {
    id: 'intermediate',
    labelKey: 'v2ExperienceIntermediate',
    tenureKey: 'v2ExperienceIntermediateTenure',
    previewKey: 'v2ExperienceIntermediatePreview',
    affirmKey: 'v2AffirmIntermediate',
    icon: Gauge,
  },
  {
    id: 'advanced',
    labelKey: 'v2ExperienceAdvanced',
    tenureKey: 'expAdvancedTenure',
    previewKey: 'v2ExperienceAdvancedPreview',
    affirmKey: 'expAffirmAdvanced',
    badgeKey: 'expPowerMode',
    icon: Medal,
  },
];

/* ─── Experience card ─── */

function ExperienceCard({
  option,
  selected,
  isPending,
  dimmed,
  onPress,
  index,
}: {
  option: (typeof EXPERIENCE_OPTIONS)[number];
  selected: boolean;
  isPending: boolean;
  dimmed: boolean;
  onPress: () => void;
  index: number;
}) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const Icon = option.icon;

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(260)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${t(`onboarding.${option.labelKey}` as never)}, ${t(`onboarding.${option.tenureKey}` as never)}${option.badgeKey ? `, ${t(`onboarding.${option.badgeKey}` as never)}` : ''}`}
        accessibilityState={{ selected }}
        android_ripple={{ color: oc.surface3 }}
        style={{
          padding: space.md,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: selected ? oc.cardBgSelected : oc.cardBg,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? oc.warm : oc.cardBorderDefault,
          overflow: 'hidden',
          opacity: dimmed ? 0.4 : 1,
          transform: [{ scale: isPending ? 0.98 : 1 }],
        }}
      >
        {/* Top row: icon + title + tenure + check */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View
            style={{
              width: ICON_TILE,
              height: ICON_TILE,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              backgroundColor: oc.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={22} color={selected ? oc.textPrimary : oc.textSecondary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
              {t(`onboarding.${option.labelKey}` as never)}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xs,
                marginTop: 2,
              }}
            >
              <Text style={[type.label, { color: oc.textMuted, fontVariant: ['tabular-nums'] }]}>
                {t(`onboarding.${option.tenureKey}` as never)}
              </Text>
              {option.badgeKey && (
                <View
                  style={{
                    paddingVertical: 2,
                    paddingHorizontal: space.xs,
                    borderRadius: radius.pill,
                    borderCurve: 'continuous',
                    backgroundColor: oc.surface3,
                  }}
                >
                  <Text style={[type.caption, { color: oc.textSecondary }]}>
                    {t(`onboarding.${option.badgeKey}` as never)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {selected && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{
                width: 24,
                height: 24,
                borderRadius: radius.pill,
                backgroundColor: oc.warm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={14} color={oc.textOnAccent} strokeWidth={3} />
            </Animated.View>
          )}
        </View>

        {/* Preview text — always visible */}
        <Text
          style={[
            type.subhead,
            {
              color: selected ? oc.textSecondary : oc.textMuted,
              marginTop: space.xs,
              paddingLeft: ICON_TILE + space.sm,
            },
          ]}
        >
          {t(`onboarding.${option.previewKey}` as never)}
        </Text>

        {/* Affirmation — only after selection */}
        {isPending && (
          <Animated.View
            entering={FadeInUp.duration(260)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xxs,
              marginTop: space.xs,
              paddingLeft: ICON_TILE + space.sm,
            }}
          >
            <Check size={14} color={oc.success} strokeWidth={2.6} />
            <Text style={[type.label, { color: oc.textPrimary }]}>
              {t(`onboarding.${option.affirmKey}` as never)}
            </Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════
   Experience Screen
   ═══════════════════════════════════════════════════════════ */

export default function ExperienceScreen() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.EXPERIENCE);
  const goNext = useOnboardingNext(OB_SCREEN.EXPERIENCE);
  const setExperienceLevel = useOnboardingStore((s) => s.setExperienceLevel);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);
  const storedLevel = useOnboardingStore((s) => s.experienceLevel);
  const [selected, setSelected] = useState<ExperienceLevel | null>(storedLevel);
  const [pendingId, setPendingId] = useState<ExperienceLevel | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.EXPERIENCE);
  }, []);

  // Reset pending state when returning to this screen
  useFocusEffect(
    useCallback(() => {
      setPendingId(null);
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    }, []),
  );

  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  const handleSelect = (id: ExperienceLevel) => {
    if (pendingId) return;

    triggerNotification(NotificationFeedbackType.Success);

    setPendingId(id);
    setSelected(id);
    setExperienceLevel(id);

    setLastCompletedScreen(OB_SCREEN.EXPERIENCE);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.EXPERIENCE, {
      experience_level: id,
    });

    // Long enough for the affirmation to land, short enough not to stall the flow.
    autoAdvanceRef.current = setTimeout(() => {
      goNext();
    }, AUTO_ADVANCE_MS);
  };

  const onBack = useOnboardingBack(OB_SCREEN.EXPERIENCE);
  const handleBack = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    onBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: oc.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      {/* Back button */}
      <OnboardingBackButton
        onPress={handleBack}
        style={{ position: 'absolute', top: insets.top + 44, left: 16, zIndex: 10 }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: 72,
          paddingBottom: space.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Headline */}
        <Animated.View entering={FadeInDown.duration(260)}>
          <Text
            accessibilityRole="header"
            style={[type.largeTitle, { color: oc.textPrimary, marginBottom: space.xs }]}
          >
            {t('onboarding.v2ExperienceHeadline')}
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Text
          style={[type.subhead, { color: oc.textSecondary, marginBottom: space.xl, maxWidth: 320 }]}
        >
          {t('onboarding.v2ExperienceSubtitle')}
        </Text>

        {/* Cards */}
        <View style={{ gap: space.xs }}>
          {EXPERIENCE_OPTIONS.map((option, index) => (
            <ExperienceCard
              key={option.id}
              option={option}
              selected={selected === option.id}
              isPending={pendingId === option.id}
              dimmed={!!pendingId && pendingId !== option.id}
              onPress={() => handleSelect(option.id)}
              index={index}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
