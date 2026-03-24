import { palette } from '@motovault/design-system';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path as SvgPath } from 'react-native-svg';

/** Compact lean gauge: small arc (left side) + digital readout (right side), all in one row */

const SVG_W = 80;
const SVG_H = 50;
const CX = 40;
const CY = 45;
const RADIUS = 36;

const ARC_START_DEG = 160;
const ARC_SWEEP = 140;
const MAX_LEAN = 60;

const TICK_ANGLES = [0, 20, 40];

/** Pre-computed tick data (static — never changes) */
const TICKS = TICK_ANGLES.flatMap((a) =>
  a === 0
    ? [{ lean: 0, isCenter: true }]
    : [
        { lean: a, isCenter: false },
        { lean: -a, isCenter: false },
      ],
);

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function pointOnArc(angleDeg: number, r: number): { x: number; y: number } {
  const rad = degToRad(angleDeg);
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
}

function arcPath(): string {
  const steps = 40;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = ARC_START_DEG - (i / steps) * ARC_SWEEP;
    const { x, y } = pointOnArc(angle, RADIUS);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return parts.join(' ');
}

const ARC_PATH_D = arcPath();

interface Props {
  smoothLean: SharedValue<number>;
  peakLeft: SharedValue<number>;
  peakRight: SharedValue<number>;
  isNightMode: boolean;
}

export function HudLeanGauge({ smoothLean, peakLeft, peakRight, isNightMode }: Props) {
  const arcColor = isNightMode ? palette.nightArcTrack : palette.neutral700;
  const needleColor = isNightMode ? palette.nightText : palette.accent500;
  const tickColor = isNightMode ? palette.nightTickMark : palette.neutral600;
  const brightTick = isNightMode ? palette.nightText : palette.neutral400;
  const textColor = isNightMode ? palette.nightText : palette.white;
  const mutedColor = isNightMode ? palette.nightAccent : palette.neutral500;

  const [displayText, setDisplayText] = useState('0\u00B0');
  const [peakDisplay, setPeakDisplay] = useState('MAX 0\u00B0');

  useAnimatedReaction(
    () => smoothLean.value,
    (lean) => {
      const abs = Math.round(Math.abs(lean));
      const text = abs < 2 ? '0\u00B0' : `${abs}\u00B0 ${lean < 0 ? 'L' : 'R'}`;
      runOnJS(setDisplayText)(text);
    },
  );

  useAnimatedReaction(
    () => Math.max(Math.abs(peakLeft.value), Math.abs(peakRight.value)),
    (peak) => {
      runOnJS(setPeakDisplay)(`MAX ${Math.round(peak)}\u00B0`);
    },
  );

  const needleStyle = useAnimatedStyle(() => {
    const clamped = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, smoothLean.value));
    return {
      transform: [{ rotate: `${clamped}deg` }],
    };
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.surfaceHover,
        borderRadius: 14,
        borderCurve: 'continuous',
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 10,
        marginHorizontal: 20,
      }}
    >
      {/* Mini arc gauge */}
      <View style={{ width: SVG_W, height: SVG_H }}>
        <Svg width={SVG_W} height={SVG_H}>
          <SvgPath
            d={ARC_PATH_D}
            stroke={arcColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <G>
            {TICKS.map((t) => {
              const arcDeg = 90 - t.lean * (ARC_SWEEP / 2 / MAX_LEAN);
              const innerR = t.isCenter ? RADIUS - 8 : RADIUS - 5;
              const p1 = pointOnArc(arcDeg, innerR);
              const p2 = pointOnArc(arcDeg, RADIUS + 1);
              return (
                <Line
                  key={t.lean}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={t.isCenter ? brightTick : tickColor}
                  strokeWidth={t.isCenter ? 1.5 : 1}
                  strokeLinecap="round"
                />
              );
            })}
          </G>
          <Circle cx={CX} cy={CY} r={3} fill={needleColor} />
        </Svg>

        {/* Needle */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: CX - 1,
              bottom: SVG_H - CY,
              width: 2,
              height: RADIUS - 6,
              transformOrigin: 'center bottom',
              borderRadius: 1,
              backgroundColor: needleColor,
            },
            needleStyle,
          ]}
        />
      </View>

      {/* Digital readout */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: mutedColor,
            letterSpacing: 1,
          }}
        >
          LEAN
        </Text>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
            color: textColor,
            marginTop: 1,
          }}
        >
          {displayText}
        </Text>
      </View>

      {/* Peak */}
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          color: mutedColor,
        }}
      >
        {peakDisplay}
      </Text>
    </View>
  );
}
