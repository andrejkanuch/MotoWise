import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Eraser } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { SignaturePad, type SignaturePadHandle } from '../../components/onboarding/signature-pad';
import { getBikeImage } from '../../config/bike-images';
import { getBrandColor } from '../../config/brand-dna';
import { OB_SCREEN, OB_VARIANT } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import {
  useOnboardingNext,
  useOnboardingStep,
  useOnboardingVariant,
} from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerNotification } from '../../utils/haptics';

/** A's pledge is a single press-and-hold; B signs (a deliberately higher-effort gesture). */
const HOLD_MS = 850;
const SEAL_PAUSE_MS = 950;

/** B's commitment style; A keeps the press-and-hold. */
type CommitmentStyle = 'hold' | 'signature';

export default function CommitmentScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const variant = useOnboardingVariant();
  const onBack = useOnboardingBack(OB_SCREEN.COMMITMENT);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.COMMITMENT);
  const goNext = useOnboardingNext(OB_SCREEN.COMMITMENT);
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const isInvested = variant === OB_VARIANT.INVESTED;

  const make = bikeData?.make ?? '';
  const model = bikeData?.model || undefined;
  const year = bikeData?.year ?? new Date().getFullYear() - 3;
  const brandColor = getBrandColor(make);
  const bikeName = `${year} ${make}${model ? ` ${model}` : ''}`;

  const [sealed, setSealed] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A — press-and-hold state
  const [holding, setHolding] = useState(false);
  const fill = useSharedValue(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // B — signature state
  const [signed, setSigned] = useState(false);
  const signatureRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.COMMITMENT);
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  /** Shared seal: lock the pledge, celebrate, record, advance after the beat. */
  const seal = (style: CommitmentStyle) => {
    if (sealed) return;
    setSealed(true);
    triggerNotification(Haptics.NotificationFeedbackType.Success);
    setLastCompletedScreen(OB_SCREEN.COMMITMENT);
    trackOnboardingEvent(AnalyticsEvent.COMMITMENT_COMPLETED, OB_SCREEN.COMMITMENT, {
      commitment_style: style,
    });
    advanceTimer.current = setTimeout(goNext, SEAL_PAUSE_MS);
  };

  // --- A: press-and-hold ---
  const completeHold = () => {
    setHolding(false);
    fill.value = withTiming(1, { duration: 120 });
    seal('hold');
  };

  const startHold = () => {
    if (sealed) return;
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fill.value = withTiming(1, { duration: HOLD_MS });
    holdTimer.current = setTimeout(completeHold, HOLD_MS);
  };

  const cancelHold = () => {
    if (sealed) return;
    setHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    fill.value = withTiming(0, { duration: 280 });
  };

  // --- B: signature ---
  const clearSignature = () => {
    signatureRef.current?.clear();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const sealSignature = () => {
    if (!signed) return;
    seal('signature');
  };

  const skip = () => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, OB_SCREEN.COMMITMENT);
    goNext();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 12,
          paddingHorizontal: 16,
          gap: 8,
        }}
      >
        <OnboardingBackButton onPress={onBack} />
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 11,
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            color: ONBOARDING_COLORS.warm2,
          }}
        >
          {t('onboarding.obCommitEyebrow')}
        </Text>
      </View>

      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}
      >
        {/* bike medallion — the rider's actual bike */}
        <Animated.View
          entering={FadeInUp.duration(400)}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            marginBottom: 26,
            borderWidth: 2,
            borderColor: `${brandColor}88`,
            shadowColor: brandColor,
            shadowOpacity: 0.5,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <View style={{ width: '100%', height: '100%', borderRadius: 60, overflow: 'hidden' }}>
            <Image
              source={bikeData?.photoUri ? { uri: bikeData.photoUri } : getBikeImage(make)}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={250}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.45)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 }}
            />
          </View>
          {/* brand-letter badge */}
          <View
            style={{
              position: 'absolute',
              bottom: -6,
              left: 43,
              width: 34,
              height: 34,
              borderRadius: 11,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: brandColor,
              borderWidth: 2,
              borderColor: ONBOARDING_COLORS.background,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: ONBOARDING_COLORS.textWhite }}>
              {make.charAt(0).toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(90).duration(400)}
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 30,
            lineHeight: 34,
            textAlign: 'center',
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.5,
          }}
        >
          {t('onboarding.obCommitTitle')}
          {'\n'}
          {t('onboarding.obCommitTitleOf')}{' '}
          <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
            {bikeName}
          </Text>
          .
        </Animated.Text>
        <Animated.Text
          entering={FadeInUp.delay(160).duration(400)}
          style={{
            fontSize: 14,
            color: ONBOARDING_COLORS.textSecondary,
            lineHeight: 21,
            textAlign: 'center',
            maxWidth: 320,
            marginTop: 13,
          }}
        >
          {isInvested ? t('onboarding.obCommitSupportB') : t('onboarding.obCommitSupportA')}
        </Animated.Text>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        {isInvested ? (
          <Animated.View entering={FadeInUp.delay(220).duration(400)}>
            {/* B — drawn signature */}
            <SignaturePad
              ref={signatureRef}
              color={brandColor}
              hint={t('onboarding.obCommitSignHint')}
              disabled={sealed}
              onSignedChange={setSigned}
            />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 12,
                marginBottom: 14,
                minHeight: 20,
              }}
            >
              <Text
                style={{
                  fontFamily: 'GeistMono-Medium',
                  fontSize: 10,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  color: sealed ? ONBOARDING_COLORS.warm2 : ONBOARDING_COLORS.textMuted,
                }}
              >
                {sealed ? t('onboarding.obCommitPledged') : t('onboarding.obCommitSignCaption')}
              </Text>
              {signed && !sealed ? (
                <Pressable
                  onPress={clearSignature}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.obCommitClear')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Eraser size={13} color={ONBOARDING_COLORS.textMuted} />
                  <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.textMuted }}>
                    {t('onboarding.obCommitClear')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={sealSignature}
              disabled={!signed || sealed}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.obCommitSeal')}
              style={{
                height: 58,
                borderRadius: 16,
                borderCurve: 'continuous',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                backgroundColor:
                  signed || sealed ? ONBOARDING_COLORS.warm : ONBOARDING_COLORS.cardBg,
                borderWidth: 1,
                borderColor: signed || sealed ? 'transparent' : ONBOARDING_COLORS.cardBorderDefault,
                opacity: signed || sealed ? 1 : 0.6,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color:
                    signed || sealed ? ONBOARDING_COLORS.textOnAccent : ONBOARDING_COLORS.textMuted,
                }}
              >
                {sealed ? t('onboarding.obCommitButtonDone') : t('onboarding.obCommitSeal')}
              </Text>
              {sealed ? (
                <Check size={19} color={ONBOARDING_COLORS.textOnAccent} strokeWidth={2.6} />
              ) : null}
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* A — press-and-hold pledge */}
            <Pressable
              onPressIn={startHold}
              onPressOut={cancelHold}
              disabled={sealed}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.obCommitButtonIdle')}
              style={{
                height: 58,
                borderRadius: 16,
                borderCurve: 'continuous',
                overflow: 'hidden',
                backgroundColor: ONBOARDING_COLORS.cardBg,
                borderWidth: 1,
                borderColor: sealed ? 'transparent' : ONBOARDING_COLORS.warm,
              }}
            >
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    backgroundColor: ONBOARDING_COLORS.warm,
                  },
                  fillStyle,
                ]}
              />
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                }}
              >
                {sealed ? (
                  <>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: ONBOARDING_COLORS.textOnAccent,
                      }}
                    >
                      {t('onboarding.obCommitButtonDone')}
                    </Text>
                    <Check size={19} color={ONBOARDING_COLORS.textOnAccent} strokeWidth={2.6} />
                  </>
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: ONBOARDING_COLORS.textPrimary,
                    }}
                  >
                    {holding
                      ? t('onboarding.obCommitButtonHolding')
                      : t('onboarding.obCommitButtonIdle')}
                  </Text>
                )}
              </View>
            </Pressable>

            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 10,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                textAlign: 'center',
                color: sealed ? ONBOARDING_COLORS.warm2 : ONBOARDING_COLORS.textMuted,
                marginTop: 11,
              }}
            >
              {sealed ? t('onboarding.obCommitPledged') : t('onboarding.obCommitHint')}
            </Text>
          </>
        )}

        {!sealed ? (
          <Pressable onPress={skip} hitSlop={8} style={{ marginTop: 10, alignSelf: 'center' }}>
            <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.textMuted }}>
              {t('onboarding.obCommitNotNow')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
