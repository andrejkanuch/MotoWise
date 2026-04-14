import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Stop,
  LinearGradient as SvgGradient,
} from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);

// ── Tachometer geometry ──────────────────────────────────────────
const TACH_SIZE = 240;
const TACH_CENTER = TACH_SIZE / 2;
const TACH_RADIUS = 100;
const TACH_STROKE = 3;

// Arc spans 240° (from 150° to 390°, i.e. 7 o'clock to 5 o'clock)
const ARC_START_DEG = 150;
const ARC_SWEEP_DEG = 240;
const ARC_START_RAD = (ARC_START_DEG * Math.PI) / 180;
const ARC_END_RAD = ((ARC_START_DEG + ARC_SWEEP_DEG) * Math.PI) / 180;

// Arc circumference for dash animation
const ARC_LENGTH = (ARC_SWEEP_DEG / 360) * 2 * Math.PI * TACH_RADIUS;

// Needle geometry
const NEEDLE_LENGTH = 78;
const NEEDLE_INNER = 18;

// Tick marks (major at 0,2,4,6,8,10,12 — "x1000 RPM")
const TICK_COUNT = 13;
const TICKS = Array.from({ length: TICK_COUNT }, (_, i) => {
  const fraction = i / (TICK_COUNT - 1);
  const angle = ARC_START_RAD + fraction * (ARC_END_RAD - ARC_START_RAD);
  const isMajor = i % 2 === 0;
  const isRedzone = i >= 10; // Last 3 ticks are redline
  const innerR = isMajor ? TACH_RADIUS - 14 : TACH_RADIUS - 9;
  const outerR = TACH_RADIUS - 2;
  return {
    x1: TACH_CENTER + innerR * Math.cos(angle),
    y1: TACH_CENTER + innerR * Math.sin(angle),
    x2: TACH_CENTER + outerR * Math.cos(angle),
    y2: TACH_CENTER + outerR * Math.sin(angle),
    isMajor,
    isRedzone,
    label: isMajor ? `${i}` : null,
    labelX: TACH_CENTER + (TACH_RADIUS - 26) * Math.cos(angle),
    labelY: TACH_CENTER + (TACH_RADIUS - 26) * Math.sin(angle),
  };
});

// Redzone arc (last ~20% of sweep)
const REDZONE_START_FRAC = 10 / 12;
const REDZONE_START_RAD = ARC_START_RAD + REDZONE_START_FRAC * (ARC_END_RAD - ARC_START_RAD);

function describeArc(cx: number, cy: number, r: number, startRad: number, endRad: number): string {
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const sweep = endRad - startRad;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// Full arc path
const FULL_ARC_D = describeArc(TACH_CENTER, TACH_CENTER, TACH_RADIUS, ARC_START_RAD, ARC_END_RAD);
// Redzone arc path
const REDZONE_ARC_D = describeArc(
  TACH_CENTER,
  TACH_CENTER,
  TACH_RADIUS,
  REDZONE_START_RAD,
  ARC_END_RAD,
);

// Road lines for motion effect
const ROAD_LINES = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  y: SCREEN_HEIGHT * 0.55 + i * 45,
  width: 60 + Math.random() * 80,
  delay: i * 80,
  opacity: 0.04 + Math.random() * 0.06,
}));

interface AnimatedSplashProps {
  isReady: boolean;
  children: React.ReactNode;
}

export function AnimatedSplash({ isReady, children }: AnimatedSplashProps) {
  const [showApp, setShowApp] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // ── Shared values ──────────────────────────────────────────────
  const arcProgress = useSharedValue(0); // 0→1: arc draws in
  const needleAngle = useSharedValue(0); // 0→1: needle position (0=min, 1=redline)
  const tickOpacity = useSharedValue(0);
  const redzoneOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.7);
  const logoOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(12);
  const centerGlowOpacity = useSharedValue(0);
  const centerGlowScale = useSharedValue(0.3);
  const splashOpacity = useSharedValue(1);
  const splashScale = useSharedValue(1);
  const rpmTextOpacity = useSharedValue(0);
  const roadLineProgress = useSharedValue(0);
  const versionOpacity = useSharedValue(0);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  const triggerLightHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const onSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  // ── Entrance animation ─────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: animation shared values are stable refs
  useEffect(() => {
    SplashScreen.hideAsync();

    // Phase 1 (0-400ms): Arc draws in with ticks
    arcProgress.value = withTiming(1, {
      duration: 700,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    tickOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );

    // Phase 2 (200-900ms): Needle sweeps to redline then settles to idle
    needleAngle.value = withDelay(
      200,
      withSequence(
        // Sweep up to redline (0 → 0.92) — aggressive acceleration curve
        withTiming(0.92, {
          duration: 600,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
        // Haptic at redline — overshoot slightly
        withSpring(0.15, {
          damping: 10,
          stiffness: 120,
          mass: 0.6,
        }),
      ),
    );

    // Phase 2b: Redzone glows when needle arrives
    redzoneOpacity.value = withDelay(
      550,
      withSequence(
        withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withDelay(400, withTiming(0.5, { duration: 300 })),
      ),
    );

    // Haptic at redline peak
    setTimeout(() => triggerHaptic(), 800);
    setTimeout(() => triggerLightHaptic(), 200);

    // Phase 3 (500-1000ms): Center glow + logo appear
    centerGlowOpacity.value = withDelay(
      500,
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withTiming(0.4, { duration: 500 }),
      ),
    );
    centerGlowScale.value = withDelay(
      500,
      withSequence(
        withTiming(1.2, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 500 }),
      ),
    );

    logoOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    logoScale.value = withDelay(600, withSpring(1, { damping: 14, stiffness: 100, mass: 0.7 }));

    // Phase 4 (800-1200ms): Tagline + RPM label
    taglineOpacity.value = withDelay(800, withTiming(1, { duration: 350 }));
    taglineY.value = withDelay(
      800,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );
    rpmTextOpacity.value = withDelay(700, withTiming(0.3, { duration: 300 }));

    // Ambient: Road lines drift
    roadLineProgress.value = withDelay(
      300,
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }),
    );

    // Version
    versionOpacity.value = withDelay(900, withTiming(0.3, { duration: 300 }));
  }, []);

  // ── Exit animation (when app is ready) ─────────────────────────
  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(() => {
      setShowApp(true);
      // Accelerate out: scale up + fade (like launching forward)
      splashScale.value = withTiming(1.15, {
        duration: 500,
        easing: Easing.bezier(0.4, 0, 1, 1),
      });
      splashOpacity.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) }, () =>
        runOnJS(onSplashComplete)(),
      );
    }, 1400);
    return () => clearTimeout(timer);
  }, [isReady, splashOpacity, splashScale, onSplashComplete]);

  // ── Animated props ──────────────────────────────────────────────
  const arcAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LENGTH * (1 - arcProgress.value),
  }));

  const tickAnimatedProps = useAnimatedProps(() => ({
    opacity: tickOpacity.value,
  }));

  const redzoneAnimatedProps = useAnimatedProps(() => ({
    opacity: redzoneOpacity.value,
  }));

  // ── Animated styles ─────────────────────────────────────────────
  const needleStyle = useAnimatedStyle(() => {
    const angleDeg = ARC_START_DEG + needleAngle.value * ARC_SWEEP_DEG;
    return {
      transform: [{ rotate: `${angleDeg + 90}deg` }],
    };
  });

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: centerGlowOpacity.value,
    transform: [{ scale: centerGlowScale.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineY.value }],
  }));

  const splashStyle = useAnimatedStyle(() => ({
    opacity: splashOpacity.value,
    transform: [{ scale: splashScale.value }],
  }));

  const rpmStyle = useAnimatedStyle(() => ({
    opacity: rpmTextOpacity.value,
  }));

  const versionStyle = useAnimatedStyle(() => ({
    opacity: versionOpacity.value,
  }));

  if (splashDone) return <>{children}</>;

  return (
    <View style={styles.container}>
      {showApp && children}

      <Animated.View style={[styles.overlay, splashStyle]} pointerEvents="none">
        <LinearGradient
          colors={[
            palette.primary950,
            '#0c1a38',
            palette.primary900,
            '#0c1a38',
            palette.primary950,
          ]}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          style={styles.gradient}
        >
          {/* Subtle ambient glow behind tach */}
          <View style={styles.ambientGlow} />

          {/* Road lines drifting past */}
          {ROAD_LINES.map((line) => (
            <RoadLine key={line.id} line={line} progress={roadLineProgress} />
          ))}

          {/* ── Tachometer ─────────────────────────────── */}
          <View style={styles.tachContainer}>
            {/* Center glow pulse */}
            <Animated.View style={[styles.centerGlow, glowStyle]} />

            <Svg width={TACH_SIZE} height={TACH_SIZE}>
              <Defs>
                <SvgGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={palette.primary400} stopOpacity="0.6" />
                  <Stop offset="0.6" stopColor={palette.signature400} stopOpacity="0.9" />
                  <Stop offset="1" stopColor={palette.signature500} stopOpacity="0.7" />
                </SvgGradient>
                <SvgGradient id="redzoneGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={palette.signature500} stopOpacity="0.8" />
                  <Stop offset="1" stopColor={palette.danger500} stopOpacity="1" />
                </SvgGradient>
              </Defs>

              {/* Track (background arc) */}
              <Path
                d={FULL_ARC_D}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={TACH_STROKE}
                fill="none"
                strokeLinecap="round"
              />

              {/* Animated arc */}
              <AnimatedPath
                d={FULL_ARC_D}
                stroke="url(#arcGrad)"
                strokeWidth={TACH_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={ARC_LENGTH}
                animatedProps={arcAnimatedProps}
              />

              {/* Redzone arc overlay */}
              <AnimatedG animatedProps={redzoneAnimatedProps}>
                <Path
                  d={REDZONE_ARC_D}
                  stroke="url(#redzoneGrad)"
                  strokeWidth={TACH_STROKE + 1}
                  fill="none"
                  strokeLinecap="round"
                />
              </AnimatedG>

              {/* Tick marks */}
              <AnimatedG animatedProps={tickAnimatedProps}>
                {TICKS.map((tick) => (
                  <Line
                    key={`tick-${tick.x1.toFixed(2)}`}
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                    stroke={
                      tick.isRedzone
                        ? palette.danger500
                        : tick.isMajor
                          ? 'rgba(255,255,255,0.5)'
                          : 'rgba(255,255,255,0.2)'
                    }
                    strokeWidth={tick.isMajor ? 1.5 : 0.8}
                    strokeLinecap="round"
                  />
                ))}
              </AnimatedG>

              {/* Center hub dot */}
              <Circle
                cx={TACH_CENTER}
                cy={TACH_CENTER}
                r={4}
                fill={palette.signature500}
                opacity={0.8}
              />
            </Svg>

            {/* Needle (positioned over SVG center, rotated) */}
            <Animated.View style={[styles.needleContainer, needleStyle]}>
              <LinearGradient
                colors={[palette.signature400, palette.signature600]}
                style={styles.needle}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
              {/* Needle tail (below center) */}
              <View style={styles.needleTail} />
            </Animated.View>

            {/* RPM label below tach */}
            <Animated.View style={[styles.rpmLabel, rpmStyle]}>
              <Text style={styles.rpmText}>× 1000 r/min</Text>
            </Animated.View>
          </View>

          {/* ── Logo (centered in tach) ────────────────── */}
          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <Text style={styles.logoText}>
              Moto<Text style={styles.logoAccent}>Vault</Text>
            </Text>
          </Animated.View>

          {/* ── Tagline ────────────────────────────────── */}
          <Animated.View style={[styles.taglineWrap, taglineStyle]}>
            <View style={styles.accentDash} />
            <Text style={styles.tagline}>Your bike, understood</Text>
            <View style={styles.accentDash} />
          </Animated.View>

          {/* Version */}
          <Animated.View style={[styles.versionWrap, versionStyle]}>
            <Text style={styles.versionText}>v2.5.0</Text>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/** Drifting road line for ambient motion */
function RoadLine({
  line,
  progress,
}: {
  line: (typeof ROAD_LINES)[number];
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const delayed = Math.max(
      0,
      (progress.value - line.delay / 1800) * (1800 / (1800 - line.delay)),
    );
    return {
      opacity: interpolate(delayed, [0, 0.2, 0.7, 1], [0, line.opacity, line.opacity, 0]),
      transform: [
        {
          translateX: interpolate(delayed, [0, 1], [SCREEN_WIDTH * 0.6, -line.width * 2]),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: line.y,
          right: 0,
          width: line.width,
          height: 1,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={['transparent', `rgba(212,98,46,0.25)`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.45,
    backgroundColor: 'rgba(51,102,230,0.03)',
  },
  tachContainer: {
    width: TACH_SIZE,
    height: TACH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(212,98,46,0.08)',
  },
  needleContainer: {
    position: 'absolute',
    alignItems: 'center',
    width: 3,
    height: NEEDLE_LENGTH + NEEDLE_INNER,
    top: TACH_CENTER - NEEDLE_LENGTH,
    left: TACH_CENTER - 1.5,
    transformOrigin: `1.5px ${NEEDLE_LENGTH}px`,
  },
  needle: {
    width: 2.5,
    height: NEEDLE_LENGTH,
    borderRadius: 1.25,
  },
  needleTail: {
    width: 2,
    height: NEEDLE_INNER,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  rpmLabel: {
    position: 'absolute',
    bottom: 30,
  },
  rpmText: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  logoWrap: {
    marginTop: -10,
    alignItems: 'center',
  },
  logoText: {
    fontSize: 34,
    fontWeight: '800',
    color: palette.white,
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: palette.signature400,
  },
  taglineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  accentDash: {
    width: 20,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: palette.signature500,
    opacity: 0.4,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  versionWrap: {
    position: 'absolute',
    bottom: '10%',
  },
  versionText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 1,
  },
});
