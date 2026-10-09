import type { GetRideWaypointsQuery } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { haversineDistance } from '../../utils/geo-utils';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatElevationValue,
} from '../../utils/ride-formatters';

type Waypoint = GetRideWaypointsQuery['rideWaypoints'][number];

interface ElevationChartItem {
  value: number;
  dist: number;
}

interface RideElevationChartProps {
  waypoints: Waypoint[];
  system: MeasurementSystem;
  isAnimated?: boolean;
  rideId?: string;
  viewer?: 'owner' | 'public';
}

const CHART_HEIGHT = 180;
const TABULAR = ['tabular-nums' as const];

export const RideElevationChart = memo(function RideElevationChart({
  waypoints,
  system,
  isAnimated = true,
  rideId,
  viewer,
}: RideElevationChartProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const lineColor = theme.ink2;
  const axisTextStyle = { ...type.caption, color: theme.ink3, fontVariant: TABULAR };
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 140;
  const elevUnit = elevationUnitLabel(system);
  const distUnit = distanceUnitLabel(system);
  const isImperial = system === 'imperial';

  const { chartData, xLabels, maxVal, spacing } = useMemo(() => {
    const valid = waypoints.filter((wp) => wp.altitude != null);
    if (valid.length < 2)
      return { chartData: [] as ElevationChartItem[], xLabels: [], maxVal: 0, spacing: 0 };

    // Find peak and valley indices before downsampling
    let maxAltIdx = 0;
    let minAltIdx = 0;
    for (let i = 1; i < valid.length; i++) {
      if ((valid[i].altitude ?? 0) > (valid[maxAltIdx].altitude ?? 0)) maxAltIdx = i;
      if ((valid[i].altitude ?? 0) < (valid[minAltIdx].altitude ?? 0)) minAltIdx = i;
    }

    // Downsample first, then compute distances (fewer haversine calls)
    const step = Math.max(1, Math.floor(valid.length / 60));
    const sampled = valid.filter(
      (_, i) => i % step === 0 || i === valid.length - 1 || i === maxAltIdx || i === minAltIdx,
    );

    // Compute cumulative distance only for sampled points
    const distDivisor = isImperial ? 1609.34 : 1000;
    let cumDist = 0;
    const data: ElevationChartItem[] = sampled.map((wp, i) => {
      if (i > 0) {
        cumDist += haversineDistance(
          sampled[i - 1].latitude,
          sampled[i - 1].longitude,
          wp.latitude,
          wp.longitude,
        );
      }
      return {
        value: formatElevationValue(wp.altitude ?? 0, system),
        dist: cumDist / distDivisor,
      };
    });

    // Build ~5-6 evenly spaced x-axis labels showing distance with unit
    const totalDist = data[data.length - 1].dist;
    const labelCount = Math.min(6, Math.max(2, Math.ceil(totalDist / 2) + 1));
    const labels = new Array(sampled.length).fill('');
    const labelStep = Math.max(1, Math.floor(sampled.length / (labelCount - 1)));

    for (let i = 0; i < sampled.length; i += labelStep) {
      const d = data[Math.min(i, data.length - 1)].dist;
      labels[i] = totalDist < 10 ? `${d.toFixed(1)} ${distUnit}` : `${Math.round(d)} ${distUnit}`;
    }
    const lastDist = data[data.length - 1].dist;
    labels[sampled.length - 1] =
      totalDist < 10 ? `${lastDist.toFixed(1)} ${distUnit}` : `${Math.round(lastDist)} ${distUnit}`;

    const peak = Math.max(...data.map((d) => d.value), 1);
    const roundTo = isImperial ? 500 : 100;
    const rounded = Math.ceil(peak / roundTo) * roundTo || roundTo;
    const sp = sampled.length > 1 ? (chartWidth - 16) / (sampled.length - 1) : 4;

    return {
      chartData: data,
      xLabels: labels,
      maxVal: rounded,
      spacing: sp,
    };
  }, [waypoints, system, chartWidth, isImperial, distUnit]);

  // Fire once per mount when the altitude graph actually renders (chart has data).
  const viewFiredRef = useRef(false);
  useEffect(() => {
    if (chartData.length > 0 && !viewFiredRef.current) {
      viewFiredRef.current = true;
      trackEvent(AnalyticsEvent.ELEVATION_CHART_VIEWED, {
        ride_id: rideId ?? '',
        viewer: viewer ?? 'unknown',
        chart_type: 'elevation',
        waypoint_count: chartData.length,
        interaction: 'view',
      });
    }
  }, [chartData.length, rideId, viewer]);

  // Distinguishes passive viewing from active inspection — fired once on first scrub.
  const scrubFiredRef = useRef(false);
  const markScrubbed = () => {
    if (scrubFiredRef.current) return;
    scrubFiredRef.current = true;
    trackEvent(AnalyticsEvent.ELEVATION_CHART_VIEWED, {
      ride_id: rideId ?? '',
      viewer: viewer ?? 'unknown',
      chart_type: 'elevation',
      interaction: 'scrub',
    });
  };

  if (chartData.length === 0) return null;

  // Frameless: the caller (ride detail) owns the card around the chart.
  return (
    <Animated.View entering={FadeInUp.duration(200)}>
      <Text style={[type.bodyStrong, { color: theme.ink, marginBottom: space.sm }]}>
        {t('rideChart.elevation', { unit: elevUnit })}
      </Text>
      <LineChart
        areaChart
        curved
        data={chartData}
        height={CHART_HEIGHT}
        width={chartWidth}
        hideDataPoints
        thickness={2}
        color={lineColor}
        startFillColor={tint(lineColor, 0.35)}
        endFillColor={tint(lineColor, 0)}
        startOpacity={0.4}
        endOpacity={0}
        isAnimated={isAnimated}
        animationDuration={isAnimated ? 300 : 0}
        noOfSections={4}
        maxValue={maxVal}
        rulesColor={theme.line}
        rulesType="dashed"
        yAxisColor="transparent"
        xAxisColor={theme.line}
        backgroundColor="transparent"
        yAxisTextStyle={axisTextStyle}
        xAxisLabelTextStyle={axisTextStyle}
        xAxisLabelTexts={xLabels}
        spacing={spacing}
        initialSpacing={8}
        endSpacing={8}
        pointerConfig={{
          activatePointersOnLongPress: true,
          autoAdjustPointerLabelPosition: true,
          pointerStripHeight: CHART_HEIGHT,
          pointerStripColor: theme.ink3,
          pointerStripWidth: 1,
          pointerColor: lineColor,
          radius: 5,
          pointerLabelWidth: 120,
          pointerLabelHeight: 50,
          shiftPointerLabelX: -40,
          shiftPointerLabelY: -55,
          pointerLabelComponent: (items: ElevationChartItem[]) => {
            const item = items[0];
            if (!item) return null;
            markScrubbed();
            return (
              <View
                style={{
                  backgroundColor: theme.surface3,
                  borderRadius: radius.control,
                  borderCurve: 'continuous',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: theme.line2,
                }}
              >
                <Text style={[type.label, { color: theme.ink, fontVariant: TABULAR }]}>
                  {Math.round(item.value)} {elevUnit}
                </Text>
                <Text style={[type.caption, { color: theme.ink3, marginTop: 2 }]}>
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
