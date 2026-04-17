/**
 * Small SVG progress ring for TripCard (P4.2).
 *
 * Sized down deliberately — a card-level nudge, not a dashboard.
 * Renders the percent in the middle and tints the stroke by completeness
 * (accent once the rider has ≥75%, amber in the middle, neutral below that).
 */
import { palette } from '@motovault/design-system';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface CompletenessRingProps {
  percent: number;
  size?: number;
  stroke?: number;
  dark?: boolean;
  showLabel?: boolean;
}

export function CompletenessRing({
  percent,
  size = 30,
  stroke = 3,
  dark = false,
  showLabel = true,
}: CompletenessRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const color =
    clamped >= 75 ? palette.success500 : clamped >= 50 ? palette.warning500 : palette.neutral400;

  const trackColor = dark ? palette.neutral700 : palette.neutral200;
  const labelColor = dark ? palette.neutral50 : palette.neutral950;

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={`Trip planning ${clamped}% complete`}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="transparent"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showLabel && (
        <View style={{ position: 'absolute' }}>
          <Text
            style={{
              fontSize: Math.max(8, Math.floor(size * 0.32)),
              fontWeight: '800',
              color: labelColor,
              letterSpacing: -0.2,
            }}
          >
            {clamped}
          </Text>
        </View>
      )}
    </View>
  );
}
