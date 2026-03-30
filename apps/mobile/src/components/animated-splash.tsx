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
import Svg, { Circle, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Ring config
const RING_SIZE = 170;
const RING_STROKE = 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Floating particles for depth
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  startX: Math.random() * SCREEN_WIDTH,
  startY: SCREEN_HEIGHT * 0.3 + Math.random() * SCREEN_HEIGHT * 0.4,
  size: 2 + Math.random() * 3,
  delay: Math.random() * 800,
  duration: 1500 + Math.random() * 1000,
  drift: -30 + Math.random() * 60,
}));

// Speed lines — horizontal streaks
const SPEED_LINES = [
  { top: 0.2, width: 140, delay: 300, opacity: 0.12 },
  { top: 0.35, width: 200, delay: 100, opacity: 0.08 },
  { top: 0.5, width: 120, delay: 500, opacity: 0.15 },
  { top: 0.65, width: 180, delay: 200, opacity: 0.1 },
  { top: 0.78, width: 150, delay: 400, opacity: 0.06 },
] as const;

interface AnimatedSplashProps {
  isReady: boolean;
  children: React.ReactNode;
}

export function AnimatedSplash({ isReady, children }: AnimatedSplashProps) {
  const [showApp, setShowApp] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // Core animation values
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const ringProgress = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(16);
  const accentLineWidth = useSharedValue(0);
  const glowScale = useSharedValue(0.5);
  const glowOpacity = useSharedValue(0);
  const splashOpacity = useSharedValue(1);
  const versionOpacity = useSharedValue(0);

  // Particle values
  const particleProgress = useSharedValue(0);

  // Speed line values (fixed count — hooks can't be in loops)
  const lp0 = useSharedValue(0);
  const lp1 = useSharedValue(0);
  const lp2 = useSharedValue(0);
  const lp3 = useSharedValue(0);
  const lp4 = useSharedValue(0);
  const lineProgress = [lp0, lp1, lp2, lp3, lp4];

  const onSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: animation shared values are stable refs, only run on mount
  useEffect(() => {
    SplashScreen.hideAsync();

    // === Phase 1: Ring draws in (0-600ms) ===
    ringOpacity.value = withTiming(1, { duration: 300 });
    ringProgress.value = withTiming(1, {
      duration: 1000,
      easing: Easing.bezier(0.16, 1, 0.3, 1), // expo out
    });

    // === Phase 2: Logo entrance (200ms-700ms) ===
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    logoScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100, mass: 0.8 }));

    // === Phase 3: Glow pulses (300ms-900ms) ===
    glowOpacity.value = withDelay(
      300,
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 600 }),
      ),
    );
    glowScale.value = withDelay(
      300,
      withSequence(
        withTiming(1.15, { duration: 500, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 600 }),
      ),
    );

    // === Phase 4: Accent line draws (500ms) ===
    accentLineWidth.value = withDelay(
      500,
      withTiming(48, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );

    // === Phase 5: Tagline fades up (600ms) ===
    taglineOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    taglineY.value = withDelay(
      600,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );

    // === Phase 6: Version number (700ms) ===
    versionOpacity.value = withDelay(700, withTiming(0.4, { duration: 300 }));

    // === Ambient: Particles float up ===
    particleProgress.value = withDelay(
      200,
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.cubic) }),
    );

    // === Ambient: Speed lines sweep ===
    for (let i = 0; i < SPEED_LINES.length; i++) {
      lineProgress[i].value = withDelay(
        SPEED_LINES[i].delay,
        withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, []);

  // Phase: Fade out when ready
  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(() => {
      setShowApp(true);
      splashOpacity.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) }, () =>
        runOnJS(onSplashComplete)(),
      );
    }, 1400);
    return () => clearTimeout(timer);
  }, [isReady, splashOpacity, onSplashComplete]);

  // Animated styles
  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineY.value }],
  }));

  const accentStyle = useAnimatedStyle(() => ({
    width: accentLineWidth.value,
  }));

  const splashStyle = useAnimatedStyle(() => ({
    opacity: splashOpacity.value,
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
          colors={['#04070e', '#091428', '#0d1e3a', '#091428', '#04070e']}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          style={styles.gradient}
        >
          {/* Subtle radial light at center */}
          <View style={styles.radialLight} />

          {/* Floating particles */}
          {PARTICLES.map((p) => (
            <ParticleView key={p.id} particle={p} progress={particleProgress} />
          ))}

          {/* Speed lines */}
          {SPEED_LINES.map((line, i) => (
            <SpeedLineView key={`sl-${line.top}`} line={line} progress={lineProgress[i]} />
          ))}

          {/* Center composition */}
          <View style={styles.center}>
            {/* Glow */}
            <Animated.View style={[styles.glow, glowStyle]} />

            {/* Tachometer ring */}
            <Animated.View style={{ opacity: ringOpacity }}>
              <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ring}>
                <Defs>
                  <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#4F7BFF" stopOpacity="0.6" />
                    <Stop offset="0.5" stopColor="#D4A26E" stopOpacity="0.8" />
                    <Stop offset="1" stopColor="#D4622E" stopOpacity="0.6" />
                  </SvgGradient>
                </Defs>
                {/* Track */}
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                {/* Animated arc */}
                <AnimatedCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke="url(#ringGrad)"
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  animatedProps={ringAnimatedProps}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              </Svg>
            </Animated.View>

            {/* Logo inside ring */}
            <Animated.View style={[styles.logoWrap, logoStyle]}>
              <Text style={styles.logoText}>
                Moto<Text style={styles.logoAccent}>Vault</Text>
              </Text>
            </Animated.View>

            {/* Accent line */}
            <Animated.View style={[styles.accentLine, accentStyle]} />

            {/* Tagline */}
            <Animated.View style={taglineStyle}>
              <Text style={styles.tagline}>Your bike, understood</Text>
            </Animated.View>
          </View>

          {/* Version at bottom */}
          <Animated.View style={[styles.versionWrap, versionStyle]}>
            <Text style={styles.versionText}>v2.4.0</Text>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/** Floating particle component */
function ParticleView({
  particle: p,
  progress,
}: {
  particle: (typeof PARTICLES)[number];
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(progress.value, [0, 1], [0, 1]);
    const delayedT = Math.max(0, (t - p.delay / 2000) * (2000 / (2000 - p.delay)));
    return {
      opacity: interpolate(delayedT, [0, 0.3, 0.7, 1], [0, 0.4, 0.4, 0]),
      transform: [
        { translateY: interpolate(delayedT, [0, 1], [0, -60]) },
        { translateX: interpolate(delayedT, [0, 1], [0, p.drift]) },
        { scale: interpolate(delayedT, [0, 0.5, 1], [0, 1, 0.5]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: p.startX,
          top: p.startY,
          width: p.size,
          height: p.size,
          borderRadius: p.size / 2,
          backgroundColor: p.id % 3 === 0 ? '#D4A26E' : 'rgba(255,255,255,0.6)',
        },
        style,
      ]}
    />
  );
}

/** Speed line component */
function SpeedLineView({
  line,
  progress,
}: {
  line: (typeof SPEED_LINES)[number];
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2, 0.6, 1], [0, line.opacity, line.opacity, 0]),
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [SCREEN_WIDTH, -line.width * 2]),
      },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: line.top * SCREEN_HEIGHT,
          right: 0,
          width: line.width,
          height: 1,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={['transparent', 'rgba(212,162,110,0.4)', 'transparent']}
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
  radialLight: {
    position: 'absolute',
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    borderRadius: SCREEN_WIDTH * 0.6,
    backgroundColor: 'rgba(51,102,230,0.025)',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(51,102,230,0.08)',
  },
  ring: {
    position: 'absolute',
  },
  logoWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: '#D4A26E',
  },
  accentLine: {
    height: 2,
    borderRadius: 1,
    marginTop: 20,
    backgroundColor: '#D4A26E',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  versionWrap: {
    position: 'absolute',
    bottom: '10%',
  },
  versionText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1,
  },
});
