import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { OnboardingBikePlate } from '../../components/onboarding/onboarding-bike-plate';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { radius, space, type } from '../../theme/type';
import { triggerNotification } from '../../utils/haptics';

/** The pledge is a short press-and-hold — deliberate, but never a wait. */
const HOLD_MS = 500;
/** Beat on the sealed state before advancing. */
const SEAL_PAUSE_MS = 450;
/** `commitment_style` analytics value; kept so the event stays comparable with the retired signature arm. */
const COMMITMENT_STYLE_HOLD = 'hold';

export default function CommitmentScreen() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const onBack = useOnboardingBack(OB_SCREEN.COMMITMENT);
  const goNext = useOnboardingNext(OB_SCREEN.COMMITMENT);
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const make = bikeData?.make ?? '';
  const model = bikeData?.model || undefined;
  const year = bikeData?.year ?? new Date().getFullYear() - 3;
  const bikeName = `${year} ${make}${model ? ` ${model}` : ''}`;

  const [sealed, setSealed] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [holding, setHolding] = useState(false);
  const fill = useSharedValue(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.COMMITMENT);
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  /** Lock the pledge, celebrate, record, advance after the beat. */
  const seal = () => {
    if (sealed) return;
    setSealed(true);
    triggerNotification(Haptics.NotificationFeedbackType.Success);
    setLastCompletedScreen(OB_SCREEN.COMMITMENT);
    trackOnboardingEvent(AnalyticsEvent.COMMITMENT_COMPLETED, OB_SCREEN.COMMITMENT, {
      commitment_style: COMMITMENT_STYLE_HOLD,
    });
    advanceTimer.current = setTimeout(goNext, SEAL_PAUSE_MS);
  };

  const completeHold = () => {
    setHolding(false);
    fill.value = withTiming(1, { duration: reduceMotion ? 0 : 120 });
    seal();
  };

  const startHold = () => {
    if (sealed) return;
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Reduce Motion: no sweep; the fill lands when the hold completes.
    if (!reduceMotion) fill.value = withTiming(1, { duration: HOLD_MS });
    holdTimer.current = setTimeout(completeHold, HOLD_MS);
  };

  const cancelHold = () => {
    if (sealed) return;
    setHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    fill.value = withTiming(0, { duration: reduceMotion ? 0 : 200 });
  };

  const skip = () => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, OB_SCREEN.COMMITMENT);
    goNext();
  };

  return (
    <OnboardingShell
      screen={OB_SCREEN.COMMITMENT}
      onBack={onBack}
      title={`${t('onboarding.obCommitTitle')}\n${t('onboarding.obCommitTitleOf')} ${bikeName}.`}
      subtitle={t('onboarding.obCommitSupportA')}
      secondary={sealed ? undefined : { label: t('onboarding.obCommitNotNow'), onPress: skip }}
      footer={
        <View style={{ gap: space.xs }}>
          {/* press-and-hold pledge — the screen's one authored motion */}
          <Pressable
            onPressIn={startHold}
            onPressOut={cancelHold}
            disabled={sealed}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.obCommitButtonIdle')}
            // Screen readers activate with a single action, not a timed hold.
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'activate') seal();
            }}
            style={{
              minHeight: 52,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: oc.surface2,
            }}
          >
            <Animated.View
              style={[
                { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: oc.warm },
                fillStyle,
              ]}
            />
            <View
              style={{
                flex: 1,
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.xs,
              }}
            >
              {sealed ? (
                <>
                  <Text style={[type.bodyStrong, { color: oc.textOnAccent }]}>
                    {t('onboarding.obCommitButtonDone')}
                  </Text>
                  <Check size={19} color={oc.textOnAccent} strokeWidth={2.6} />
                </>
              ) : (
                <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
                  {holding
                    ? t('onboarding.obCommitButtonHolding')
                    : t('onboarding.obCommitButtonIdle')}
                </Text>
              )}
            </View>
          </Pressable>

          <Text
            style={[
              type.caption,
              { textAlign: 'center', color: sealed ? oc.textSecondary : oc.textMuted },
            ]}
          >
            {sealed ? t('onboarding.obCommitPledged') : t('onboarding.obCommitHint')}
          </Text>
        </View>
      }
    >
      {/* The same plate the rider set up — this is what they're committing to. */}
      <OnboardingBikePlate make={make} model={model} year={year} />
    </OnboardingShell>
  );
}
