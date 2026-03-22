import { palette } from '@motovault/design-system';
import type { GetRideWaypointsQuery } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import { memo, useMemo } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { formatSpeedValue, speedUnitLabel } from '../../utils/ride-formatters';

type Waypoint = GetRideWaypointsQuery['rideWaypoints'][number];

interface RideSpeedChartProps {
  waypoints: Waypoint[];
  system: MeasurementSystem;
}

const CHART_WIDTH = Dimensions.get('window').width - 72;
const AXIS_FONT = {
  fontFamily: 'PlusJakartaSans-Regular',
  color: palette.neutral500,
  fontSize: 10,
};

export const RideSpeedChart = memo(function RideSpeedChart({
  waypoints,
  system,
}: RideSpeedChartProps) {
  const unit = speedUnitLabel(system);

  const { chartData, xLabels, maxVal } = useMemo(() => {
    const valid = waypoints.filter((wp) => wp.speedMps != null);
    if (valid.length < 10) return { chartData: [], xLabels: [], maxVal: 0 };

    const startTime = new Date(valid[0].recordedAt).getTime();

    // Downsample to ~60 points for smooth chart rendering
    const step = Math.max(1, Math.floor(valid.length / 60));
    const sampled = valid.filter((_, i) => i % step === 0 || i === valid.length - 1);

    const data = sampled.map((wp) => ({
      value: formatSpeedValue(wp.speedMps ?? 0, system),
    }));

    // Build ~5 evenly spaced x-axis labels
    const labels = new Array(sampled.length).fill('');
    const labelStep = Math.floor(sampled.length / 5);
    for (let i = 0; i < sampled.length; i += labelStep) {
      const elapsed = Math.round((new Date(sampled[i].recordedAt).getTime() - startTime) / 60_000);
      labels[i] = `${elapsed}m`;
    }
    const lastElapsed = Math.round(
      (new Date(sampled[sampled.length - 1].recordedAt).getTime() - startTime) / 60_000,
    );
    labels[sampled.length - 1] = `${lastElapsed}m`;

    const max = Math.max(...data.map((d) => d.value), 1);
    return { chartData: data, xLabels: labels, maxVal: max };
  }, [waypoints, system]);

  if (chartData.length === 0) {
    return (
      <View
        style={{
          backgroundColor: palette.surfaceSubtle,
          borderRadius: 16,
          borderCurve: 'continuous',
          padding: 24,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: palette.surfaceElevated,
        }}
      >
        <Text style={{ fontSize: 14, color: palette.neutral500 }}>Insufficient speed data</Text>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(200)}>
      <View
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
          style={{ fontSize: 13, fontWeight: '600', color: palette.neutral400, marginBottom: 12 }}
        >
          Speed ({unit})
        </Text>
        <LineChart
          data={chartData}
          width={CHART_WIDTH}
          height={180}
          spacing={Math.max(2, CHART_WIDTH / chartData.length)}
          initialSpacing={8}
          endSpacing={8}
          color={palette.accent500}
          thickness={2}
          hideDataPoints
          curved
          areaChart
          startFillColor={palette.accentTint}
          endFillColor="rgba(45,158,120,0)"
          startOpacity={0.4}
          endOpacity={0}
          isAnimated
          animationDuration={300}
          noOfSections={4}
          maxValue={Math.ceil(maxVal * 1.1)}
          rulesColor={palette.surfaceElevated}
          rulesType="dashed"
          yAxisTextStyle={AXIS_FONT}
          xAxisLabelTextStyle={{ ...AXIS_FONT, fontSize: 9 }}
          yAxisColor="rgba(15,23,42,0)"
          xAxisColor={palette.surfaceElevated}
          backgroundColor="rgba(15,23,42,0)"
          xAxisLabelTexts={xLabels}
          yAxisLabelWidth={36}
          adjustToWidth
        />
      </View>
    </Animated.View>
  );
});
