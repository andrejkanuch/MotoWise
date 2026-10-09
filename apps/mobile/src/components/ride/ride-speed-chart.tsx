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
import { distanceUnitLabel, formatSpeedValue, speedUnitLabel } from '../../utils/ride-formatters';

type Waypoint = GetRideWaypointsQuery['rideWaypoints'][number];

interface RideSpeedChartProps {
  waypoints: Waypoint[];
  system: MeasurementSystem;
  isAnimated?: boolean;
  rideId?: string;
  viewer?: 'owner' | 'public';
}

interface SpeedChartItem {
  value: number;
  dist: number;
}

const CHART_HEIGHT = 180;
const TABULAR = ['tabular-nums' as const];

export const RideSpeedChart = memo(function RideSpeedChart({
  waypoints,
  system,
  isAnimated = true,
  rideId,
  viewer,
}: RideSpeedChartProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const lineColor = theme.info;
  const axisTextStyle = { ...type.caption, color: theme.ink3, fontVariant: TABULAR };
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

  // Fire once per mount when the speed graph actually renders (chart has data).
  const viewFiredRef = useRef(false);
  useEffect(() => {
    if (chartData.length > 0 && !viewFiredRef.current) {
      viewFiredRef.current = true;
      trackEvent(AnalyticsEvent.RIDE_CHART_VIEWED, {
        ride_id: rideId ?? '',
        viewer: viewer ?? 'unknown',
        chart_type: 'speed',
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
    trackEvent(AnalyticsEvent.RIDE_CHART_VIEWED, {
      ride_id: rideId ?? '',
      viewer: viewer ?? 'unknown',
      chart_type: 'speed',
      interaction: 'scrub',
    });
  };

  if (chartData.length === 0) return null;

  // Frameless: the caller (ride detail) owns the card around the chart.
  return (
    <Animated.View entering={FadeInUp.duration(200)}>
      <Text style={[type.bodyStrong, { color: theme.ink, marginBottom: space.sm }]}>
        {t('rideChart.speed', { unit })}
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
          pointerLabelComponent: (items: SpeedChartItem[]) => {
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
                  {item.value} {unit}
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
