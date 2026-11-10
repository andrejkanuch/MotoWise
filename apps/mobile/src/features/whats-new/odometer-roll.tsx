/**
 * A mechanical odometer: one wheel per digit, each rolling up to its digit,
 * the right-hand wheels turning over more often like a real counter. Leading
 * zeros are dimmed. Under reduced motion the digits are printed in place.
 *
 * Decorative: the boot states the figure in its accessibility summary.
 */

import { useEffect } from 'react';
import { Text, type TextStyle, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';

/** At least this many wheels, so a short figure still reads as an odometer. */
const MIN_WHEELS = 5;
const DIGITS = 10;
const LABEL_TRACKING = 1.2;
const CELL_WIDTH = 26;
const CELL_HEIGHT = 40;
const ROLL_DELAY_MS = 500;
const ROLL_STAGGER_MS = 50;
const ROLL_MS = 800;
const ROLL_STEP_MS = 80;
const ROLL_EASING = Easing.bezier(0.15, 0.75, 0.25, 1.04);
/** Full turns before settling: the rightmost wheel turns most. */
const TURNS_FROM_RIGHT = [2, 1, 1] as const;

const DIGIT_STYLE: TextStyle = {
  ...type.figure,
  height: CELL_HEIGHT,
  lineHeight: CELL_HEIGHT,
  textAlign: 'center',
};

function turnsFor(indexFromRight: number): number {
  return TURNS_FROM_RIGHT[indexFromRight] ?? 0;
}

interface WheelProps {
  digit: number;
  turns: number;
  index: number;
  color: string;
}

function RollingWheel({ digit, turns, index, color }: WheelProps) {
  const offset = useSharedValue(0);
  const strip = Array.from({ length: (turns + 1) * DIGITS }, (_, n) => n % DIGITS);

  useEffect(() => {
    offset.value = withDelay(
      ROLL_DELAY_MS + index * ROLL_STAGGER_MS,
      withTiming(-(turns * DIGITS + digit) * CELL_HEIGHT, {
        duration: ROLL_MS + index * ROLL_STEP_MS,
        easing: ROLL_EASING,
      }),
    );
  }, [offset, digit, turns, index]);

  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <Animated.View testID="whats-new-boot-odometer-wheel" style={roll}>
      {strip.map((n, position) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the strip is fixed; its digits repeat.
        <Text key={position} style={[DIGIT_STYLE, { color }]}>
          {n}
        </Text>
      ))}
    </Animated.View>
  );
}

export interface OdometerRollProps {
  /** Whole units the wheels roll to. */
  value: number;
  /** "SEASON" or "ODO". */
  label: string;
  /** "km" or "mi". */
  unitLabel: string;
  reduceMotion: boolean;
}

export function OdometerRoll({ value, label, unitLabel, reduceMotion }: OdometerRollProps) {
  const { t } = useEditorialTheme();
  const raw = String(Math.max(0, Math.round(value)));
  const digits = raw.padStart(MIN_WHEELS, '0').split('').map(Number);
  const padding = digits.length - raw.length;

  return (
    <View
      testID="whats-new-boot-odometer"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
    >
      <Text style={[type.label, { color: t.ink3, letterSpacing: LABEL_TRACKING }]}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          gap: space.xxs / 2,
          padding: space.xxs,
          borderRadius: radius.chip,
          backgroundColor: t.surface,
        }}
      >
        {digits.map((digit, index) => {
          const color = index < padding ? t.ink3 : t.ink;
          return (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: one wheel per digit position.
              key={index}
              style={{
                width: CELL_WIDTH,
                height: CELL_HEIGHT,
                overflow: 'hidden',
                borderRadius: radius.chip / 2,
                backgroundColor: t.surface2,
              }}
            >
              {reduceMotion ? (
                <Text style={[DIGIT_STYLE, { color }]}>{digit}</Text>
              ) : (
                <RollingWheel
                  digit={digit}
                  turns={turnsFor(digits.length - 1 - index)}
                  index={index}
                  color={color}
                />
              )}
            </View>
          );
        })}
      </View>
      <Text style={[type.figureSmall, { color: t.ink2 }]}>{unitLabel}</Text>
    </View>
  );
}
