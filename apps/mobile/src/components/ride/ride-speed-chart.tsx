import { palette } from '@motovault/design-system';
import type { GetRideWaypointsQuery } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import { memo, useMemo } from 'react';
import { Dimensions, Text } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { formatSpeedValue, speedUnitLabel } from '../../utils/ride-formatters';

type Waypoint = GetRideWaypointsQuery['rideWaypoints'][number];

interface RideSpeedChartProps {
  waypoints: Waypoint[];
  system: MeasurementSystem;
}

const CHART_HEIGHT = 180;
const CHART_WIDTH = Dimensions.get('window').width - 72;

export const RideSpeedChart = memo(function RideSpeedChart({
  waypoints,
  system,
}: RideSpeedChartProps) {
  const unit = speedUnitLabel(system);

  const { chartData, xLabels, maxVal, spacing } = useMemo(() => {
    const valid = waypoints.filter((wp) => wp.speedMps != null);
    if (valid.length < 10) return { chartData: [], xLabels: [], maxVal: 0, spacing: 0 };

    const startTime = new Date(valid[0].recordedAt).getTime();

    // Downsample to ~60 points for smooth chart rendering
    const step = Math.max(1, Math.floor(valid.length / 60));
    const sampled = valid.filter((_, i) => i % step === 0 || i === valid.length - 1);

    const data = sampled.map((wp) => ({
      value: formatSpeedValue(wp.speedMps ?? 0, system),
    }));

    // Build ~5-6 evenly spaced x-axis labels showing elapsed minutes
    const totalMin =
      (new Date(sampled[sampled.length - 1].recordedAt).getTime() - startTime) / 60_000;
    const labelCount = Math.min(6, Math.max(2, Math.ceil(totalMin / 5) + 1));
    const labels = new Array(sampled.length).fill('');
    const labelStep = Math.max(1, Math.floor(sampled.length / (labelCount - 1)));

    for (let i = 0; i < sampled.length; i += labelStep) {
      const elapsed = Math.round((new Date(sampled[i].recordedAt).getTime() - startTime) / 60_000);
      labels[i] = `${elapsed}m`;
    }
    const lastElapsed = Math.round(
      (new Date(sampled[sampled.length - 1].recordedAt).getTime() - startTime) / 60_000,
    );
    labels[sampled.length - 1] = `${lastElapsed}m`;

    const peak = Math.max(...data.map((d) => d.value), 1);
    const rounded = Math.ceil(peak / 20) * 20 || 80;

    // Calculate spacing to fill width
    const sp = sampled.length > 1 ? (CHART_WIDTH - 16) / (sampled.length - 1) : 4;

    return { chartData: data, xLabels: labels, maxVal: rounded, spacing: sp };
  }, [waypoints, system]);

  if (chartData.length === 0) {
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
            color: palette.neutral400,
          }}
        >
          Speed ({unit})
        </Text>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans-Regular',
            fontSize: 13,
            color: palette.neutral500,
            marginTop: 12,
            textAlign: 'center',
          }}
        >
          Insufficient data
        </Text>
      </Animated.View>
    );
  }

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
        width={CHART_WIDTH}
        hideDataPoints
        thickness={2}
        color={palette.accent500}
        startFillColor={palette.accentTint}
        endFillColor="rgba(45,158,120,0)"
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
      />
    </Animated.View>
  );
});
