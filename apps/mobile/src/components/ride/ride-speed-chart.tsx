import { palette } from '@motovault/design-system';
import type { GetRideWaypointsQuery } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import { memo, useMemo } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { haversineDistance } from '../../utils/geo-utils';
import { distanceUnitLabel, formatSpeedValue, speedUnitLabel } from '../../utils/ride-formatters';

type Waypoint = GetRideWaypointsQuery['rideWaypoints'][number];

interface RideSpeedChartProps {
  waypoints: Waypoint[];
  system: MeasurementSystem;
}

interface SpeedChartItem {
  value: number;
  dist: number;
}

const CHART_HEIGHT = 180;

// Tooltip styles — defined outside the component to avoid re-creation
const tooltipContainer = {
  backgroundColor: palette.surfaceElevated,
  borderRadius: 8,
  borderCurve: 'continuous' as const,
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderWidth: 1,
  borderColor: palette.neutral700,
};

const tooltipValueText = {
  fontFamily: 'PlusJakartaSans-SemiBold' as const,
  fontSize: 13,
  color: palette.white,
};

const tooltipSecondaryText = {
  fontFamily: 'PlusJakartaSans-Regular' as const,
  fontSize: 11,
  color: palette.neutral400,
  marginTop: 2,
};

export const RideSpeedChart = memo(function RideSpeedChart({
  waypoints,
  system,
}: RideSpeedChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 140;
  const unit = speedUnitLabel(system);
  const isImperial = system === 'imperial';
  const distUnit = distanceUnitLabel(system);

  const { chartData, xLabels, maxVal, spacing } = useMemo(() => {
    const valid = waypoints.filter((wp) => wp.speedMps != null);
    if (valid.length < 2)
      return { chartData: [] as SpeedChartItem[], xLabels: [], maxVal: 0, spacing: 0 };

    // Find peak speed index for preservation during downsampling
    let maxSpeedIdx = 0;
    for (let i = 1; i < valid.length; i++) {
      if ((valid[i].speedMps ?? 0) > (valid[maxSpeedIdx].speedMps ?? 0)) {
        maxSpeedIdx = i;
      }
    }

    // Downsample to ~60 points for smooth chart rendering, preserving peak
    const step = Math.max(1, Math.floor(valid.length / 60));
    const sampled = valid.filter(
      (_, i) => i % step === 0 || i === valid.length - 1 || i === maxSpeedIdx,
    );

    // Compute cumulative haversine distance for each sampled waypoint
    const cumulativeDistM: number[] = [0];
    for (let i = 1; i < sampled.length; i++) {
      const prev = sampled[i - 1];
      const curr = sampled[i];
      const segDist = haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude,
      );
      cumulativeDistM[i] = cumulativeDistM[i - 1] + segDist;
    }

    const data: SpeedChartItem[] = sampled.map((wp, i) => {
      const distKm = cumulativeDistM[i] / 1000;
      const dist = isImperial ? distKm * 0.621371 : distKm;
      return {
        value: formatSpeedValue(wp.speedMps ?? 0, system),
        dist: Math.round(dist * 100) / 100,
      };
    });

    // Build ~5-6 evenly spaced x-axis labels showing distance
    const totalDist = data[data.length - 1].dist;
    const labelCount = Math.min(6, Math.max(2, Math.ceil(totalDist / 5) + 1));
    const labels = new Array(sampled.length).fill('');
    const labelStep = Math.max(1, Math.floor(sampled.length / (labelCount - 1)));

    for (let i = 0; i < sampled.length; i += labelStep) {
      labels[i] = `${data[i].dist.toFixed(1)} ${distUnit}`;
    }
    labels[sampled.length - 1] = `${data[data.length - 1].dist.toFixed(1)} ${distUnit}`;

    const peak = Math.max(...data.map((d) => d.value), 1);
    const rounded = Math.ceil(peak / 20) * 20 || 80;
    const sp = sampled.length > 1 ? (chartWidth - 16) / (sampled.length - 1) : 4;

    return { chartData: data, xLabels: labels, maxVal: rounded, spacing: sp };
  }, [waypoints, system, chartWidth, isImperial, distUnit]);

  if (chartData.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      style={{
        backgroundColor: palette.surfaceSubtle,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 16,
        borderWidth: 1,
        borderColor: palette.surfaceElevated,
      }}
    >
      <Text
        style={{
          fontFamily: 'PlusJakartaSans-SemiBold',
          fontWeight: '600',
          fontSize: 15,
          color: palette.white,
          marginBottom: 12,
        }}
      >
        Speed ({unit})
      </Text>
      <LineChart
        areaChart
        curved
        data={chartData}
        height={CHART_HEIGHT}
        width={chartWidth}
        hideDataPoints
        thickness={2}
        color={palette.accent500}
        startFillColor={palette.accentTint}
        endFillColor={palette.accentTintZero}
        startOpacity={0.4}
        endOpacity={0}
        isAnimated
        animationDuration={300}
        noOfSections={4}
        maxValue={maxVal}
        rulesColor={palette.surfaceElevated}
        rulesType="dashed"
        yAxisColor="transparent"
        xAxisColor={palette.surfaceElevated}
        backgroundColor="transparent"
        yAxisTextStyle={{
          fontFamily: 'PlusJakartaSans-Regular',
          color: palette.neutral500,
          fontSize: 10,
          fontVariant: ['tabular-nums'],
        }}
        xAxisLabelTextStyle={{
          fontFamily: 'PlusJakartaSans-Regular',
          color: palette.neutral500,
          fontSize: 9,
        }}
        xAxisLabelTexts={xLabels}
        spacing={spacing}
        initialSpacing={8}
        endSpacing={8}
        pointerConfig={{
          activatePointersOnLongPress: true,
          autoAdjustPointerLabelPosition: true,
          pointerStripHeight: CHART_HEIGHT,
          pointerStripColor: palette.neutral500,
          pointerStripWidth: 1,
          pointerColor: palette.accent500,
          radius: 5,
          pointerLabelWidth: 120,
          pointerLabelHeight: 50,
          shiftPointerLabelX: -40,
          shiftPointerLabelY: -55,
          pointerLabelComponent: (items: SpeedChartItem[]) => {
            const item = items[0];
            if (!item) return null;
            return (
              <View style={tooltipContainer}>
                <Text style={tooltipValueText}>
                  {item.value} {unit}
                </Text>
                <Text style={tooltipSecondaryText}>
                  {item.dist.toFixed(1)} {distUnit}
                </Text>
              </View>
            );
          },
        }}
      />
    </Animated.View>
  );
});
