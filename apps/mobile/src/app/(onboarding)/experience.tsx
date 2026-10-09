import type { ExperienceLevel } from '@motovault/types';
import { NotificationFeedbackType } from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { Bike, Check, Gauge, Medal } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingOptionList } from '../../components/onboarding/onboarding-option-list';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { space, type } from '../../theme/type';
import { triggerNotification } from '../../utils/haptics';

/** Pause after a pick before auto-advancing, so the affirmation registers. */
const AUTO_ADVANCE_MS = 600;

/* ─── Experience options ─── */

const EXPERIENCE_OPTIONS: {
  id: ExperienceLevel;
  labelKey: string;
  tenureKey: string;
  previewKey: string;
  affirmKey: string;
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
    icon: Medal,
  },
];

/* ═══════════════════════════════════════════════════════════
   Experience Screen
   ═══════════════════════════════════════════════════════════ */

export default function ExperienceScreen() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
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

  const pendingOption = EXPERIENCE_OPTIONS.find((o) => o.id === pendingId);

  return (
    <OnboardingShell
      screen={OB_SCREEN.EXPERIENCE}
      onBack={handleBack}
      title={t('onboarding.v2ExperienceHeadline')}
      subtitle={t('onboarding.v2ExperienceSubtitle')}
      footer={
        pendingOption ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xs,
              minHeight: 52,
            }}
          >
            <Check size={16} color={oc.success} strokeWidth={2.6} />
            <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
              {t(`onboarding.${pendingOption.affirmKey}` as never)}
            </Text>
          </Animated.View>
        ) : undefined
      }
    >
      <OnboardingOptionList
        options={EXPERIENCE_OPTIONS.map((option) => ({
          key: option.id,
          label: t(`onboarding.${option.labelKey}` as never),
          description: `${t(`onboarding.${option.tenureKey}` as never)} · ${t(`onboarding.${option.previewKey}` as never)}`,
          icon: option.icon,
        }))}
        isSelected={(id) => selected === id}
        onSelect={handleSelect}
      />
    </OnboardingShell>
  );
}
