import { palette } from '@motovault/design-system';
import type { ExperienceLevel } from '@motovault/types';
import { NotificationFeedbackType } from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bike, Check, Flame, Gauge } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Line, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_ROUTE, OB_SCREEN, TOTAL_SCREENS } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerNotification } from '../../utils/haptics';

/* ─── Experience options matching V3 prototype ─── */

const EXPERIENCE_OPTIONS: {
  id: ExperienceLevel;
  labelKey: string;
  tenureKey: string;
  previewKey: string;
  affirmKey: string;
  icon: typeof Bike;
  accent: string;
}[] = [
  {
    id: 'beginner',
    labelKey: 'v2ExperienceBeginner',
    tenureKey: 'v2ExperienceBeginnerTenure',
    previewKey: 'v2ExperienceBeginnerPreview',
    affirmKey: 'v2AffirmBeginner',
    icon: Bike,
    accent: ONBOARDING_COLORS.accentBeginner,
  },
  {
    id: 'intermediate',
    labelKey: 'v2ExperienceIntermediate',
    tenureKey: 'v2ExperienceIntermediateTenure',
    previewKey: 'v2ExperienceIntermediatePreview',
    affirmKey: 'v2AffirmIntermediate',
    icon: Gauge,
    accent: ONBOARDING_COLORS.accentIntermediate,
  },
  {
    id: 'advanced',
    labelKey: 'v2ExperienceAdvanced',
    tenureKey: 'v2ExperienceAdvancedTenure',
    previewKey: 'v2ExperienceAdvancedPreview',
    affirmKey: 'v2AffirmAdvanced',
    icon: Flame,
    accent: ONBOARDING_COLORS.accentAdvanced,
  },
];

/* ─── Animated perspective road lines ─── */

function RoadLines({ accent }: { accent: string }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.4 }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 390 780" preserveAspectRatio="none">
        <Defs>
          <SvgLinearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={accent} stopOpacity={0} />
            <Stop offset="30%" stopColor={accent} stopOpacity={0.7} />
            <Stop offset="85%" stopColor={accent} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={accent} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        {/* Center line */}
        <Line
          x1="195"
          y1="190"
          x2="195"
          y2="800"
          stroke="url(#roadGrad)"
          strokeWidth={2}
          strokeDasharray="16,32"
        />
        {/* Left edge */}
        <Line
          x1="170"
          y1="190"
          x2="-30"
          y2="800"
          stroke="url(#roadGrad)"
          strokeWidth={1.2}
          strokeDasharray="12,26"
        />
        {/* Right edge */}
        <Line
          x1="220"
          y1="190"
          x2="420"
          y2="800"
          stroke="url(#roadGrad)"
          strokeWidth={1.2}
          strokeDasharray="12,26"
        />
        {/* Far outer guides */}
        <Line
          x1="155"
          y1="190"
          x2="-160"
          y2="800"
          stroke="url(#roadGrad)"
          strokeWidth={0.7}
          strokeDasharray="8,22"
          opacity={0.6}
        />
        <Line
          x1="235"
          y1="190"
          x2="550"
          y2="800"
          stroke="url(#roadGrad)"
          strokeWidth={0.7}
          strokeDasharray="8,22"
          opacity={0.6}
        />
      </Svg>
    </View>
  );
}

/* ─── Spark particle ─── */

function Spark({ accent, delay, left }: { accent: string; delay: number; left: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(withTiming(-900, { duration: 10000, easing: Easing.linear }), -1, false),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1200 }),
          withTiming(0.5, { duration: 7600 }),
          withTiming(0, { duration: 1200 }),
        ),
        -1,
        false,
      ),
    );
  }, [translateY, opacity, delay]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: -10,
          left: `${left}%`,
          width: 2.5,
          height: 2.5,
          borderRadius: 1.25,
          backgroundColor: accent,
        },
        animStyle,
      ]}
    />
  );
}

/* ─── Pulsing glow background ─── */

function PulsingGlow({ accent }: { accent: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: '-15%',
          left: '-20%',
          right: '-20%',
          height: '55%',
        },
        animStyle,
      ]}
    >
      <LinearGradient
        colors={[`${accent}40`, `${accent}10`, 'transparent']}
        locations={[0, 0.35, 0.7]}
        start={{ x: 0.5, y: 0.2 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1, borderRadius: 200 }}
      />
    </Animated.View>
  );
}

/* ─── Tachometer bars ─── */

function TachBars({ accent }: { accent: string }) {
  const bars = Array.from({ length: 7 });
  return (
    <View
      pointerEvents="none"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 4,
        height: 28,
        paddingBottom: 14,
        paddingHorizontal: 24,
      }}
    >
      {bars.map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static tach bar list
        <TachBar key={i} index={i} accent={accent} />
      ))}
    </View>
  );
}

function TachBar({ index, accent }: { index: number; accent: string }) {
  const scaleY = useSharedValue(0.7);
  const baseHeight = 6 + (index < 9 ? index * 1.2 : (13 - index) * 4);

  useEffect(() => {
    scaleY.value = withDelay(
      index * 50,
      withRepeat(
        withSequence(
          withTiming(1.15, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.7, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [scaleY, index]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 3,
          height: baseHeight,
          borderRadius: 1.5,
          backgroundColor: accent,
          opacity: 0.55,
        },
        animStyle,
      ]}
    />
  );
}

/* ─── Eyebrow pill ─── */

function EyebrowPill({ accent, label }: { accent: string; label: string }) {
  const dotScale = useSharedValue(1);

  useEffect(() => {
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [dotScale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(500)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: `${accent}1F`,
        borderWidth: 1,
        borderColor: `${accent}4D`,
        marginBottom: 14,
      }}
    >
      <Animated.View
        style={[{ width: 4, height: 4, borderRadius: 2, backgroundColor: accent }, dotStyle]}
      />
      <Text
        style={{
          fontFamily: 'GeistMono-Medium',
          fontSize: 9.5,
          fontWeight: '600',
          letterSpacing: 1.7,
          textTransform: 'uppercase',
          color: accent,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

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
  const { t } = useTranslation();
  const Icon = option.icon;

  // Shine sweep animation on selection
  const shineX = useSharedValue(-1.1);
  useEffect(() => {
    if (selected) {
      shineX.value = -1.1;
      shineX.value = withDelay(
        200,
        withTiming(1.1, { duration: 700, easing: Easing.out(Easing.ease) }),
      );
    }
  }, [selected, shineX]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shineX.value * 200 }],
    opacity: interpolate(shineX.value, [-1.1, -0.3, 0, 0.3, 1.1], [0, 0.5, 1, 0.5, 0]),
  }));

  return (
    <Animated.View entering={FadeIn.delay(300 + index * 110).duration(400)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${t(`onboarding.${option.labelKey}` as never)}, ${t(`onboarding.${option.tenureKey}` as never)}`}
        accessibilityState={{ selected }}
        style={{
          position: 'relative',
          padding: 15,
          paddingBottom: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: selected
            ? `${option.accent}1A`
            : ONBOARDING_COLORS.surfaceCardTranslucent,
          borderWidth: 1,
          borderColor: selected ? option.accent : ONBOARDING_COLORS.borderDefault,
          overflow: 'hidden',
          opacity: dimmed ? 0.35 : 1,
          transform: [{ scale: isPending ? 0.98 : 1 }],
          ...(process.env.EXPO_OS === 'ios'
            ? selected
              ? {
                  shadowColor: option.accent,
                  shadowOffset: { width: 0, height: 7 },
                  shadowOpacity: 0.22,
                  shadowRadius: 18,
                }
              : {
                  shadowColor: palette.black,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 6,
                }
            : {}),
        }}
      >
        {/* Shine sweep */}
        {selected && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 18,
                backgroundColor: `${option.accent}33`,
              },
              shineStyle,
            ]}
          />
        )}

        {/* Top row: icon + title + tenure + check */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              borderCurve: 'continuous',
              backgroundColor: selected ? option.accent : `${option.accent}21`,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: selected ? 0 : 1,
              borderColor: `${option.accent}3D`,
              ...(process.env.EXPO_OS === 'ios' && selected
                ? {
                    shadowColor: option.accent,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.55,
                    shadowRadius: 7,
                  }
                : {}),
            }}
          >
            <Icon size={23} color={selected ? ONBOARDING_COLORS.textOnAccent : option.accent} />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: ONBOARDING_COLORS.textPrimary,
                letterSpacing: -0.2,
                marginBottom: 4,
              }}
            >
              {t(`onboarding.${option.labelKey}` as never)}
            </Text>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 10,
                fontWeight: '500',
                letterSpacing: 1.3,
                textTransform: 'uppercase',
                color: selected ? option.accent : ONBOARDING_COLORS.textLabel,
              }}
            >
              {t(`onboarding.${option.tenureKey}` as never)}
            </Text>
          </View>

          {selected && (
            <Animated.View
              entering={FadeIn.duration(200).springify()}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: option.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={14} color={ONBOARDING_COLORS.textOnAccent} strokeWidth={3} />
            </Animated.View>
          )}
        </View>

        {/* Preview text — always visible */}
        <Text
          style={{
            fontSize: 12.5,
            lineHeight: 18,
            fontStyle: 'italic',
            color: selected ? ONBOARDING_COLORS.textBright : ONBOARDING_COLORS.textSoft,
            marginTop: 10,
            paddingLeft: 60,
          }}
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
              gap: 6,
              marginTop: 10,
              paddingLeft: 60,
            }}
          >
            <AffirmDot accent={option.accent} />
            <Text style={{ fontSize: 13, color: option.accent, fontWeight: '500' }}>
              {t(`onboarding.${option.affirmKey}` as never)}
            </Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function AffirmDot({ accent }: { accent: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: accent }, animStyle]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════
   Experience Screen
   ═══════════════════════════════════════════════════════════ */

export default function ExperienceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setExperienceLevel = useOnboardingStore((s) => s.setExperienceLevel);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);
  const storedLevel = useOnboardingStore((s) => s.experienceLevel);
  const [selected, setSelected] = useState<ExperienceLevel | null>(storedLevel);
  const [pendingId, setPendingId] = useState<ExperienceLevel | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeAccent =
    EXPERIENCE_OPTIONS.find((o) => o.id === (pendingId ?? selected))?.accent ??
    ONBOARDING_COLORS.accentIntermediate;

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

    // Longer delay so the affirmation text can be read
    autoAdvanceRef.current = setTimeout(() => {
      router.push(OB_ROUTE.GOALS);
    }, 1400);
  };

  const onBack = useOnboardingBack(OB_SCREEN.EXPERIENCE);
  const handleBack = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    onBack();
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: ONBOARDING_COLORS.background,
      }}
    >
      {/* ═══ Animated background ═══ */}
      <PulsingGlow accent={activeAccent} />
      <RoadLines accent={activeAccent} />

      {/* Sparks */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Spark accent={activeAccent} delay={0} left={14} />
        <Spark accent={activeAccent} delay={2500} left={32} />
        <Spark accent={activeAccent} delay={5500} left={48} />
        <Spark accent={activeAccent} delay={1200} left={64} />
        <Spark accent={activeAccent} delay={4000} left={82} />
      </View>

      {/* Grain overlay */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundColor: palette.neutral500,
        }}
      />

      {/* ═══ Content ═══ */}
      <OnboardingProgress screenIndex={1} totalScreens={TOTAL_SCREENS} />

      {/* Back button */}
      <Pressable
        onPress={handleBack}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: insets.top + 44,
          left: 16,
          zIndex: 10,
          width: 36,
          height: 36,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: ONBOARDING_COLORS.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={{ fontSize: 18, color: ONBOARDING_COLORS.textPrimary }}>‹</Text>
        </Animated.View>
      </Pressable>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Eyebrow pill */}
        <EyebrowPill accent={activeAccent} label={t('onboarding.v2ExperienceEyebrow')} />

        {/* Headline */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 38,
              lineHeight: 40,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.7,
              marginBottom: 6,
            }}
          >
            {t('onboarding.v2ExperienceTitle')}
            {'\n'}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                color: ONBOARDING_COLORS.warm2,
              }}
            >
              {t('onboarding.v2ExperienceTitleItalic')}
            </Text>
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <Text
            style={{
              fontSize: 14,
              color: ONBOARDING_COLORS.textSubtitle,
              lineHeight: 21,
              marginBottom: 24,
              maxWidth: 320,
            }}
          >
            {t('onboarding.v2ExperienceSubtitle')}
          </Text>
        </Animated.View>

        {/* Cards */}
        <View style={{ gap: 10 }}>
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

      {/* Tachometer bars */}
      <TachBars accent={activeAccent} />
    </View>
  );
}
