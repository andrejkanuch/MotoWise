import { palette } from '@motovault/design-system';
import type { GetRideWaypointsQuery } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import { memo, useMemo } from 'react';
import { Dimensions, Text } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { distanceUnitLabel } from '../../utils/ride-formatters';

type Waypoint = GetRideWaypointsQuery['rideWaypoints'][number];

interface RideElevationChartProps {
  waypoints: Waypoint[];
  system: MeasurementSystem;
}

const CHART_HEIGHT = 180;
const CHART_WIDTH = Dimensions.get('window').width - 72;

/** Haversine distance between two coordinates in meters */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Convert altitude in meters to display value (meters or feet) */
function elevationValue(meters: number, system: MeasurementSystem): number {
  return system === 'imperial' ? Math.round(meters * 3.281) : Math.round(meters);
}

/** Get the elevation unit label */
function elevationUnitLabel(system: MeasurementSystem): string {
  return system === 'imperial' ? 'ft' : 'm';
}

export const RideElevationChart = memo(function RideElevationChart({
  waypoints,
  system,
}: RideElevationChartProps) {
  const isImperial = system === 'imperial';
  const elevUnit = elevationUnitLabel(system);
  const distUnit = distanceUnitLabel(system);

  const { chartData, xLabels, maxVal, spacing } = useMemo(() => {
    const valid = waypoints.filter((wp) => wp.altitude != null);
    if (valid.length < 10) return { chartData: [], xLabels: [], maxVal: 0, spacing: 0 };

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

    const distDivisor = isImperial ? 1609.34 : 1000;

    const data = sampled.map((wp) => ({
      value: elevationValue(wp.altitude ?? 0, system),
      dist: wp.distM / distDivisor,
    }));

    // Build ~5-6 evenly spaced x-axis labels showing distance with unit
    const totalDist = data[data.length - 1].dist;
    const labelCount = Math.min(6, Math.max(2, Math.ceil(totalDist / 2) + 1));
    const labels = new Array(sampled.length).fill('');
    const labelStep = Math.max(1, Math.floor(sampled.length / (labelCount - 1)));

    for (let i = 0; i < sampled.length; i += labelStep) {
      const d = data[Math.min(i, data.length - 1)].dist;
      const formatted = totalDist < 10 ? d.toFixed(1) : String(Math.round(d));
      labels[i] = `${formatted} ${distUnit}`;
    }
    const lastDist = data[data.length - 1].dist;
    labels[sampled.length - 1] =
      totalDist < 10 ? `${lastDist.toFixed(1)} ${distUnit}` : `${Math.round(lastDist)} ${distUnit}`;

    const peak = Math.max(...data.map((d) => d.value), 1);
    const roundTo = isImperial ? 500 : 100;
    const rounded = Math.ceil(peak / roundTo) * roundTo || roundTo;

    // Calculate spacing to fill width
    const sp = sampled.length > 1 ? (CHART_WIDTH - 16) / (sampled.length - 1) : 4;

    return {
      chartData: data.map((d) => ({ value: d.value })),
      xLabels: labels,
      maxVal: rounded,
      spacing: sp,
    };
  }, [waypoints, isImperial, system, distUnit]);

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
          Elevation ({elevUnit})
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
        Elevation ({elevUnit})
      </Text>
      <LineChart
        areaChart
        curved
        data={chartData}
        height={CHART_HEIGHT}
        width={CHART_WIDTH}
        hideDataPoints
        thickness={2}
        color={palette.signature500}
        startFillColor="rgba(212,74,46,0.12)"
        endFillColor="rgba(212,74,46,0)"
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
