import { palette } from '@motovault/design-system';
import type { GetRideWaypointsQuery } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import { memo, useMemo } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { distanceUnitLabel } from '../../utils/ride-formatters';

type Waypoint = GetRideWaypointsQuery['rideWaypoints'][number];

interface RideElevationChartProps {
  waypoints: Waypoint[];
  system: MeasurementSystem;
}

const CHART_WIDTH = Dimensions.get('window').width - 72;
const AXIS_FONT = {
  fontFamily: 'PlusJakartaSans-Regular',
  color: palette.neutral500,
  fontSize: 10,
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const RideElevationChart = memo(function RideElevationChart({
  waypoints,
  system,
}: RideElevationChartProps) {
  const isImperial = system === 'imperial';
  const elevUnit = isImperial ? 'ft' : 'm';
  const distUnit = distanceUnitLabel(system);

  const { chartData, xLabels, maxVal, minVal } = useMemo(() => {
    const valid = waypoints.filter((wp) => wp.altitude != null);
    if (valid.length < 10) return { chartData: [], xLabels: [], maxVal: 0, minVal: 0 };

    // Compute cumulative distance for each waypoint
    let cumDist = 0;
    const withDist = valid.map((wp, i) => {
      if (i > 0) {
        cumDist += haversineDistance(
          valid[i - 1].latitude,
          valid[i - 1].longitude,
          wp.latitude,
          wp.longitude,
        );
      }
      return { ...wp, distM: cumDist };
    });

    // Downsample to ~60 points
    const step = Math.max(1, Math.floor(withDist.length / 60));
    const sampled = withDist.filter((_, i) => i % step === 0 || i === withDist.length - 1);

    const data = sampled.map((wp) => ({
      value: isImperial ? Math.round((wp.altitude ?? 0) * 3.281) : Math.round(wp.altitude ?? 0),
    }));

    // Build ~5 evenly spaced x-axis labels showing distance
    const labels = new Array(sampled.length).fill('');
    const labelStep = Math.floor(sampled.length / 5);
    const distDivisor = isImperial ? 1609.34 : 1000;
    for (let i = 0; i < sampled.length; i += labelStep) {
      const dist = sampled[i].distM / distDivisor;
      labels[i] = dist < 10 ? `${dist.toFixed(1)}` : `${Math.round(dist)}`;
    }
    const lastDist = sampled[sampled.length - 1].distM / distDivisor;
    labels[sampled.length - 1] =
      lastDist < 10 ? `${lastDist.toFixed(1)}` : `${Math.round(lastDist)}`;

    const max = Math.max(...data.map((d) => d.value), 1);
    const min = Math.min(...data.map((d) => d.value), 0);
    return { chartData: data, xLabels: labels, maxVal: max, minVal: min };
  }, [waypoints, isImperial]);

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
        <Text style={{ fontSize: 14, color: palette.neutral500 }}>Insufficient elevation data</Text>
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
          Elevation ({elevUnit}) · {distUnit}
        </Text>
        <LineChart
          data={chartData}
          width={CHART_WIDTH}
          height={180}
          spacing={Math.max(2, CHART_WIDTH / chartData.length)}
          initialSpacing={8}
          endSpacing={8}
          color={palette.signature500}
          thickness={2}
          hideDataPoints
          curved
          areaChart
          startFillColor="rgba(212,74,46,0.12)"
          endFillColor="rgba(212,74,46,0)"
          startOpacity={0.4}
          endOpacity={0}
          isAnimated
          animationDuration={300}
          noOfSections={4}
          maxValue={Math.ceil(maxVal * 1.1)}
          mostNegativeValue={minVal < 0 ? Math.floor(minVal * 1.1) : undefined}
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
