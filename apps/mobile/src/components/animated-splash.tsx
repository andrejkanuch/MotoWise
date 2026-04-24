import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

const heroRider = require('../assets/images/hero-rider.jpg');

// ── MW mark path (zigzag script mark from logo) ──
const MW_MARK_PATH =
  'M 14 74 C 14 74, 20 40, 26 30 C 30 23, 36 24, 38 32 C 40 42, 42 62, 44 72 C 45 78, 50 78, 52 72 C 54 60, 58 42, 62 34 C 65 27, 71 27, 73 34 C 75 44, 77 62, 79 72 C 80 77, 85 77, 87 72 C 89 66, 90 58, 92 48';

// ── Ring arc geometry ──
const RING_SIZE = 200;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = 82;

function describeArc(cx: number, cy: number, r: number, startRad: number, endRad: number): string {
  const x1 = cx + Math.cos(startRad) * r;
  const y1 = cy + Math.sin(startRad) * r;
  const x2 = cx + Math.cos(endRad) * r;
  const y2 = cy + Math.sin(endRad) * r;
  const large = Math.abs(endRad - startRad) > Math.PI ? 1 : 0;
  const sweep = endRad > startRad ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

interface AnimatedSplashProps {
  isReady: boolean;
  children: React.ReactNode;
}

const DURATION = 3200;
const MAX_SPLASH_MS = 10000;

export function AnimatedSplash({ isReady, children }: AnimatedSplashProps) {
  const [showApp, setShowApp] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const forcedExit = useRef(false);

  // Master timeline 0→1 over DURATION ms
  const t = useSharedValue(0);
  const splashOpacity = useSharedValue(1);
  const splashScale = useSharedValue(1);

  const onSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  // Failsafe
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!forcedExit.current && !splashDone) {
        forcedExit.current = true;
        setShowApp(true);
        setSplashDone(true);
      }
    }, MAX_SPLASH_MS);
    return () => clearTimeout(timeout);
  }, [splashDone]);

  // Entrance animation — single timeline drives everything
  // biome-ignore lint/correctness/useExhaustiveDependencies: animation shared values are stable refs
  useEffect(() => {
    SplashScreen.hideAsync();

    t.value = withTiming(1, {
      duration: DURATION,
      easing: Easing.linear,
    });

    // Haptic at mark reveal (~40% of timeline)
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), DURATION * 0.45);
  }, []);

  // Exit animation
  useEffect(() => {
    if (!isReady) return;
    const minDelay = Math.max(0, DURATION + 200);
    const timer = setTimeout(() => {
      setShowApp(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      splashScale.value = withTiming(1.08, {
        duration: 400,
        easing: Easing.bezier(0.4, 0, 1, 1),
      });
      splashOpacity.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }, () =>
        runOnJS(onSplashComplete)(),
      );
    }, minDelay);
    return () => clearTimeout(timer);
  }, [isReady, splashOpacity, splashScale, onSplashComplete]);

  // ── Derived progress values ──
  const easeOut3 = (x: number) => {
    'worklet';
    return 1 - (1 - x) ** 3;
  };
  const easeInOut2 = (x: number) => {
    'worklet';
    return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
  };
  const clamp01 = (x: number) => {
    'worklet';
    return Math.max(0, Math.min(1, x));
  };

  // Ken-Burns: zoom starts tight, settles
  const heroScale = useDerivedValue(() => {
    const p = easeInOut2(t.value);
    return 1.18 + (1.02 - 1.18) * p;
  });
  const heroPanX = useDerivedValue(() => {
    const p = easeInOut2(t.value);
    return -40 + (10 - -40) * p;
  });

  // Element reveals
  const pMask = useDerivedValue(() => easeOut3(clamp01(t.value / 0.15)));
  const pMark = useDerivedValue(() => easeOut3(clamp01((t.value - 0.4) / 0.22)));
  const pWord = useDerivedValue(() => easeOut3(clamp01((t.value - 0.55) / 0.22)));
  const pEyebrow = useDerivedValue(() => easeOut3(clamp01((t.value - 0.72) / 0.22)));
  const pBar = useDerivedValue(() => easeInOut2(clamp01((t.value - 0.78) / 0.22)));

  // Ring sweep
  const ringArc = useDerivedValue(() => easeInOut2(clamp01((t.value - 0.25) / 0.35)));
  const ringSpin = useDerivedValue(() => ((t.value * DURATION) / 1000) * 90);

  // Warm light streak
  const warmLightOpacity = useDerivedValue(() => {
    const p = easeInOut2(t.value);
    return 0.3 + (1 - 0.3) * p;
  });

  // ── Animated styles ──
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }, { translateX: heroPanX.value }],
  }));

  const warmLightStyle = useAnimatedStyle(() => ({
    opacity: warmLightOpacity.value,
  }));

  const veilStyle = useAnimatedStyle(() => ({
    opacity: pMask.value,
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: pMark.value,
    transform: [{ scale: 0.55 + (1 - 0.55) * pMark.value }],
  }));

  const sweepRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ringArc.value, [0, 1], [0.2, 1]),
    transform: [{ rotate: `${ringSpin.value}deg` }],
  }));

  const treadRingStyle = useAnimatedStyle(() => ({
    opacity: pMark.value * 0.4,
    transform: [{ rotate: `${-ringSpin.value * 0.4}deg` }],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: pWord.value,
    transform: [{ translateY: interpolate(pWord.value, [0, 1], [14, 0]) }],
  }));

  const eyebrowStyle = useAnimatedStyle(() => ({
    opacity: pEyebrow.value,
    transform: [{ translateY: interpolate(pEyebrow.value, [0, 1], [8, 0]) }],
  }));

  const barTrackStyle = useAnimatedStyle(() => ({
    opacity: pEyebrow.value,
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    width: pBar.value * 120,
  }));

  const splashStyle = useAnimatedStyle(() => ({
    opacity: splashOpacity.value,
    transform: [{ scale: splashScale.value }],
  }));

  if (splashDone) return <>{children}</>;

  return (
    <View style={styles.container}>
      {showApp && children}

      <Animated.View style={[styles.overlay, splashStyle]} pointerEvents="none">
        {/* Hero image with Ken-Burns zoom/pan */}
        <Animated.View style={[styles.heroImageWrap, heroStyle]}>
          <Image source={heroRider} style={styles.heroImage} resizeMode="cover" />
        </Animated.View>

        {/* Warm directional light streak (top-right) */}
        <Animated.View style={[styles.warmLight, warmLightStyle]}>
          <LinearGradient
            colors={['rgba(212,136,74,0.25)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0, y: 1 }}
          />
        </Animated.View>

        {/* Dark veil gradient */}
        <Animated.View style={[StyleSheet.absoluteFill, veilStyle]}>
          <LinearGradient
            colors={[
              'rgba(17,14,10,0.8)',
              'rgba(17,14,10,0.25)',
              'rgba(17,14,10,0.12)',
              'rgba(17,14,10,0.8)',
              'rgba(17,14,10,1)',
            ]}
            locations={[0, 0.2, 0.45, 0.78, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Vignette */}
        <View style={styles.vignette}>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 0 }}
          />
        </View>

        {/* Center stack */}
        <View style={styles.centerStack}>
          {/* Ring cluster around MW mark */}
          <View style={styles.ringContainer}>
            <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
              <Defs>
                <SvgLinearGradient id="heroArc" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor={palette.editorialDarkWarm} stopOpacity={0} />
                  <Stop offset="50%" stopColor={palette.editorialDarkWarm} stopOpacity={1} />
                  <Stop offset="100%" stopColor={palette.editorialDarkWarm2} stopOpacity={1} />
                </SvgLinearGradient>
                <RadialGradient id="heroHub" cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0%" stopColor={palette.editorialDarkWarm} stopOpacity={0.5} />
                  <Stop offset="70%" stopColor={palette.editorialDarkWarm} stopOpacity={0.05} />
                  <Stop offset="100%" stopColor={palette.editorialDarkWarm} stopOpacity={0} />
                </RadialGradient>
              </Defs>

              {/* Hub glow */}
              <Circle cx={RING_CENTER} cy={RING_CENTER} r={90} fill="url(#heroHub)" opacity={0.9} />

              {/* Base ring */}
              <Circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
              />

              {/* Dark plate behind mark */}
              <Circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={56}
                fill="rgba(17,14,10,0.78)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
            </Svg>

            {/* Rotating sweep arc (animated separately) */}
            <Animated.View style={[styles.ringSvgOverlay, sweepRingStyle]}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <Defs>
                  <SvgLinearGradient id="sweepArc" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0%" stopColor={palette.editorialDarkWarm} stopOpacity={0} />
                    <Stop offset="50%" stopColor={palette.editorialDarkWarm} stopOpacity={1} />
                    <Stop offset="100%" stopColor={palette.editorialDarkWarm2} stopOpacity={1} />
                  </SvgLinearGradient>
                </Defs>
                <G transform={`translate(${RING_CENTER}, ${RING_CENTER})`}>
                  <Path
                    d={describeArc(0, 0, RING_RADIUS, -Math.PI * 0.85, -Math.PI * 0.15)}
                    stroke="url(#sweepArc)"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    fill="none"
                  />
                </G>
              </Svg>
            </Animated.View>

            {/* Counter-rotating dashed tread */}
            <Animated.View style={[styles.ringSvgOverlay, treadRingStyle]}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={68}
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1}
                  strokeDasharray="2 7"
                />
              </Svg>
            </Animated.View>

            {/* MW mark */}
            <Animated.View style={[styles.markOverlay, markStyle]}>
              <Svg width={100} height={100} viewBox="0 0 100 100">
                <G transform="translate(-3, -0.5)">
                  <Path
                    d={MW_MARK_PATH}
                    fill="none"
                    stroke={palette.editorialDarkInk}
                    strokeWidth={9.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </G>
              </Svg>
            </Animated.View>
          </View>

          {/* Wordmark */}
          <Animated.View style={[styles.wordmarkWrap, wordStyle]}>
            <Text style={styles.wordMoto}>Moto</Text>
            <Text style={styles.wordVault}>Vault</Text>
          </Animated.View>

          {/* Eyebrow tagline */}
          <Animated.View style={[styles.eyebrowWrap, eyebrowStyle]}>
            <View style={styles.eyebrowDash} />
            <Text style={styles.eyebrowText}>Every bike has a story</Text>
            <View style={styles.eyebrowDash} />
          </Animated.View>

          {/* Bottom progress bar */}
          <Animated.View style={[styles.barTrack, barTrackStyle]}>
            <Animated.View style={[styles.barFill, barFillStyle]}>
              <LinearGradient
                colors={[
                  palette.editorialDarkWarm2,
                  palette.editorialDarkWarm,
                  palette.editorialDarkWarm2,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: palette.editorialDarkBg2,
    overflow: 'hidden',
  },
  heroImageWrap: {
    position: 'absolute',
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  warmLight: {
    position: 'absolute',
    top: '-10%',
    right: '-15%',
    width: '65%',
    height: '70%',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
  centerStack: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ringSvgOverlay: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
  },
  markOverlay: {
    position: 'absolute',
    width: 100,
    height: 100,
  },
  wordmarkWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  wordMoto: {
    fontWeight: '600',
    fontSize: 36,
    letterSpacing: -0.8,
    color: '#fff',
  },
  wordVault: {
    fontFamily: 'InstrumentSerif-Italic',
    fontSize: 44,
    letterSpacing: -0.5,
    color: palette.editorialDarkWarm,
    marginLeft: 3,
  },
  eyebrowWrap: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eyebrowDash: {
    width: 22,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  eyebrowText: {
    fontSize: 10.5,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  barTrack: {
    position: 'absolute',
    bottom: 62,
    width: 120,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 2,
    overflow: 'hidden',
  },
});
