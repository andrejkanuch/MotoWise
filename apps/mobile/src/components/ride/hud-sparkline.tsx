import { palette } from '@motovault/design-system';
import type { MeasurementSystem } from '@motovault/types';
import { memo, useMemo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  elevationUnitLabel,
  formatElevationValue,
  formatSpeedValue,
  speedUnitLabel,
} from '../../utils/ride-formatters';

interface HudSparklineProps {
  data: number[];
  mode: 'altitude' | 'speed';
  isNightMode: boolean;
  /** Drives the mph/km-h and ft/m labels from the user's preference. */
  system: MeasurementSystem;
  onToggleMode?: () => void;
}

const CONTAINER_HEIGHT = 48;
const BORDER_RADIUS = 12;

function HudSparklineInner({ data, mode, isNightMode, system, onToggleMode }: HudSparklineProps) {
  const { width: screenWidth } = useWindowDimensions();
  const containerWidth = screenWidth - 40;

  const strokeColor = isNightMode
    ? palette.nightText
    : mode === 'altitude'
      ? palette.accent500
      : palette.signature500;

  const label = mode === 'altitude' ? 'ALT' : 'SPD';

  const lastValue = data.length > 0 ? data[data.length - 1] : 0;
  // `data` is m/s (speed) or metres (altitude); convert the label to the
  // user's unit. The plotted path uses relative scaling, so only the label
  // needs unit awareness.
  const formattedValue =
    mode === 'altitude'
      ? `${formatElevationValue(lastValue, system)} ${elevationUnitLabel(system)}`
      : `${formatSpeedValue(lastValue, system)} ${speedUnitLabel(system)}`;

  const { linePath, areaPath } = useMemo(() => {
    if (data.length < 2) return { linePath: '', areaPath: '' };

    const w = containerWidth;
    const h = CONTAINER_HEIGHT;

    let min = data[0];
    let max = data[0];
    for (const v of data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const rangePadding = (max - min) * 0.1 || 1;
    min -= rangePadding;
    max += rangePadding;
    const range = max - min;

    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((val - min) / range) * h;
      return { x, y };
    });

    const lineSegments = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

    const areaSegments = `${lineSegments} L ${w},${h} L 0,${h} Z`;

    return { linePath: lineSegments, areaPath: areaSegments };
  }, [data, containerWidth]);

  if (data.length < 2) {
    return (
      <Pressable onPress={onToggleMode}>
        <View
          style={{
            width: containerWidth,
            height: CONTAINER_HEIGHT,
            backgroundColor: palette.surfaceSubtle,
            borderRadius: BORDER_RADIUS,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: palette.neutral500,
            }}
          >
            Waiting for data...
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onToggleMode}>
      <View
        style={{
          width: containerWidth,
          height: CONTAINER_HEIGHT,
          backgroundColor: palette.surfaceSubtle,
          borderRadius: BORDER_RADIUS,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        <Svg width={containerWidth} height={CONTAINER_HEIGHT}>
          <Defs>
            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={strokeColor} stopOpacity={0.2} />
              <Stop offset="1" stopColor={strokeColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#areaFill)" />
          <Path d={linePath} stroke={strokeColor} strokeWidth={1.5} fill="none" />
        </Svg>

        <Text
          style={{
            position: 'absolute',
            top: 4,
            left: 8,
            fontSize: 10,
            fontWeight: '700',
            color: palette.neutral500,
          }}
        >
          {label}
        </Text>

        <Text
          style={{
            position: 'absolute',
            top: 4,
            right: 8,
            fontSize: 11,
            fontWeight: '600',
            color: isNightMode ? palette.nightText : palette.white,
          }}
        >
          {formattedValue}
        </Text>
      </View>
    </Pressable>
  );
}

export const HudSparkline = memo(HudSparklineInner);
