/**
 * The rev gauge of the What's New boot: a 270° arc with ticks (the last ones
 * red), and a copper needle that sweeps to the stop and back to rest, the way
 * a dash tests itself at ignition. Under reduced motion the needle simply rests.
 *
 * Decorative: the boot hides it from the accessibility tree.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { tint, useEditorialTheme } from '@/theme/editorial';

/** Drawing units: the gauge is drawn on a square of this side and scaled. */
const VIEW = 340;
const CENTER = VIEW / 2;
const ARC_RADIUS = 146;
/** Needle rest and stop, in degrees from twelve o'clock. */
const REST_DEG = -135;
const STOP_DEG = 135;
const TICK_COUNT = 41;
const TICK_STEP_DEG = (STOP_DEG - REST_DEG) / (TICK_COUNT - 1);
/** Every fifth tick is long. */
const MAJOR_EVERY = 5;
/** Ticks from this index on mark the red zone. */
const RED_FROM = 34;
const TICK_OUTER = 138;
const TICK_INNER_MAJOR = 114;
const TICK_INNER_MINOR = 125;
const TICK_WIDTH_MAJOR = 3;
const TICK_WIDTH_MINOR = 2;
const TICK_ALPHA = 0.38;
const NEEDLE_TIP = 40;
const NEEDLE_TAIL = 12;
const NEEDLE_WIDTH = 3.5;
const HUB_RADIUS = 9;
const HUB_STROKE = 2.5;
const ARC_STROKE = 1.5;

const SWEEP_DELAY_MS = 150;
const SWEEP_UP_MS = 380;
const SWEEP_HOLD_MS = 90;
const SWEEP_DOWN_MS = 430;
const SWEEP_EASING = Easing.bezier(0.45, 0.05, 0.3, 1);

function polar(deg: number, radius: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

const ARC_START = polar(REST_DEG, ARC_RADIUS);
const ARC_END = polar(STOP_DEG, ARC_RADIUS);
const ARC_PATH = `M${ARC_START.x} ${ARC_START.y} A${ARC_RADIUS} ${ARC_RADIUS} 0 1 1 ${ARC_END.x} ${ARC_END.y}`;

const TICKS = Array.from({ length: TICK_COUNT }, (_, index) => {
  const deg = REST_DEG + index * TICK_STEP_DEG;
  const major = index % MAJOR_EVERY === 0;
  const inner = polar(deg, major ? TICK_INNER_MAJOR : TICK_INNER_MINOR);
  const outer = polar(deg, TICK_OUTER);
  return {
    key: index,
    inner,
    outer,
    width: major ? TICK_WIDTH_MAJOR : TICK_WIDTH_MINOR,
    red: index >= RED_FROM,
  };
});

export interface BootGaugeProps {
  /** Side of the square the gauge is drawn in. */
  size: number;
  reduceMotion: boolean;
}

function Needle({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      <Line
        x1={CENTER}
        y1={CENTER + NEEDLE_TAIL}
        x2={CENTER}
        y2={NEEDLE_TIP}
        stroke={color}
        strokeWidth={NEEDLE_WIDTH}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SweepingNeedle({ size, color }: { size: number; color: string }) {
  const angle = useSharedValue(REST_DEG);

  useEffect(() => {
    angle.value = withDelay(
      SWEEP_DELAY_MS,
      withSequence(
        withTiming(STOP_DEG, { duration: SWEEP_UP_MS, easing: SWEEP_EASING }),
        withDelay(
          SWEEP_HOLD_MS,
          withTiming(REST_DEG, { duration: SWEEP_DOWN_MS, easing: SWEEP_EASING }),
        ),
      ),
    );
  }, [angle]);

  const rotation = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  return (
    <Animated.View testID="whats-new-boot-needle-sweep" style={[StyleSheet.absoluteFill, rotation]}>
      <Needle size={size} color={color} />
    </Animated.View>
  );
}

export function BootGauge({ size, reduceMotion }: BootGaugeProps) {
  const { t } = useEditorialTheme();
  const tickColor = tint(t.ink, TICK_ALPHA);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <Path d={ARC_PATH} fill="none" stroke={t.line} strokeWidth={ARC_STROKE} />
        {TICKS.map((tick) => (
          <Line
            key={tick.key}
            x1={tick.inner.x}
            y1={tick.inner.y}
            x2={tick.outer.x}
            y2={tick.outer.y}
            stroke={tick.red ? t.danger : tickColor}
            strokeWidth={tick.width}
            strokeLinecap="round"
          />
        ))}
      </Svg>
      {reduceMotion ? (
        <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${REST_DEG}deg` }] }]}>
          <Needle size={size} color={t.warm} />
        </View>
      ) : (
        <SweepingNeedle size={size} color={t.warm} />
      )}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={HUB_RADIUS}
            fill={t.surface}
            stroke={t.warm}
            strokeWidth={HUB_STROKE}
          />
        </Svg>
      </View>
    </View>
  );
}
