import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import {
  GetPublicRideDocument,
  type GetPublicRideQuery,
  GetRideDocument,
  type GetRideQuery,
  GetRideWaypointsDocument,
  type GetRideWaypointsQuery,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronUp,
  Clock,
  Gauge,
  Info,
  Map as MapIcon,
  Mountain,
  Pause,
  Route,
  Share2,
  Trash2,
  TrendingDown,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, BackHandler, Pressable, Share, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentList } from '../../components/comments/comment-list';
import { shareRide } from '../../components/share/share-ride';
import { RideElevationChart } from '../../components/ride/ride-elevation-chart';
import { RideSpeedChart } from '../../components/ride/ride-speed-chart';
import { StatTile } from '../../components/ride/stat-tile';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { cycleMapStyle, getDefaultMapStyle, MAP_STYLES } from '../../utils/map-styles';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatFullDate,
  formatSpeed,
  formatTime,
} from '../../utils/ride-formatters';
import { enqueueOrExecute } from '../../utils/ride-sync-queue';

/** Decode Google-encoded polyline string to [lat, lng] pairs */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

type ChartType = 'speed' | 'elevation';

type RideDetailPayload = NonNullable<GetRideQuery['ride'] | GetPublicRideQuery['getPublicRide']>;

export default function RideDetailScreen() {
  const { t } = useTranslation();
  const { t: theme, isDark } = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const system = useMeasurementSystem();
  const [mapStyle, setMapStyle] = useState(() => getDefaultMapStyle(isDark));
  const [activeChart, setActiveChart] = useState<ChartType | null>(null);
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['35%', '60%', '92%'], []);

  const { data: rideBundle, isLoading } = useQuery({
    queryKey: queryKeys.rides.detail(rideId ?? ''),
    queryFn: async () => {
      const id = rideId;
      if (!id) throw new Error('Missing rideId');
      try {
        const r = await gqlFetcher(GetRideDocument, { id });
        return { viewer: 'owner' as const, ride: r.ride };
      } catch {
        const r = await gqlFetcher(GetPublicRideDocument, { id });
        return { viewer: 'public' as const, ride: r.getPublicRide };
      }
    },
    enabled: !!rideId,
  });

  const isOwnerViewer = rideBundle?.viewer === 'owner';
  const canLoadWaypoints = !!rideId && rideBundle != null && isOwnerViewer;

  const { data: waypointData, isLoading: waypointsLoading } = useQuery({
    queryKey: queryKeys.rides.waypoints(rideId ?? ''),
    queryFn: () => {
      if (!rideId) throw new Error('Missing rideId');
      return gqlFetcher(GetRideWaypointsDocument, { rideId, maxPoints: 300 });
    },
    enabled: canLoadWaypoints,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const ride = rideBundle?.ride as RideDetailPayload | undefined;
  const waypoints = (waypointData as GetRideWaypointsQuery | undefined)?.rideWaypoints ?? [];

  const rideLoaded = ride?.id;
  useEffect(() => {
    if (ride && rideLoaded) {
      trackEvent(AnalyticsEvent.RIDE_VIEWED, {
        ride_id: rideId ?? '',
        distance_m: ride.distanceM ?? 0,
        duration_s: ride.durationS ?? 0,
      });
    }
  }, [rideLoaded, rideId, ride]);

  const routeData = useMemo(() => {
    if (!ride?.routePolyline) return null;

    try {
      const decoded = decodePolyline(ride.routePolyline);
      if (decoded.length < 2) return null;

      const coordinates: [number, number][] = decoded.map(([lat, lng]: [number, number]) => [
        lng,
        lat,
      ]);

      let minLng = coordinates[0][0];
      let maxLng = coordinates[0][0];
      let minLat = coordinates[0][1];
      let maxLat = coordinates[0][1];

      for (const [lng, lat] of coordinates) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates },
          },
        ],
      };

      return {
        geojson,
        bounds: {
          ne: [maxLng + 0.005, maxLat + 0.005] as [number, number],
          sw: [minLng - 0.005, minLat - 0.005] as [number, number],
        },
        startPoint: coordinates[0],
        endPoint: coordinates[coordinates.length - 1],
      };
    } catch {
      return null;
    }
  }, [ride?.routePolyline]);

  const handleShare = useCallback(async () => {
    if (!ride || !rideId) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await shareRide({
      rideId,
      rideName: ride.name,
      distanceM: ride.distanceM ?? 0,
      durationS: ride.durationS ?? 0,
      system,
    });
  }, [ride, system, rideId]);

  const handleDelete = useCallback(() => {
    if (!rideId) return;
    Alert.alert(t('rideDetail.deleteTitle'), t('rideDetail.deleteMessage'), [
      { text: t('rideDetail.cancel'), style: 'cancel' },
      {
        text: t('rideDetail.delete'),
        style: 'destructive',
        onPress: () => {
          trackEvent(AnalyticsEvent.RIDE_DELETED, { ride_id: rideId ?? '' });
          enqueueOrExecute('deleteRide', {
            variables: { id: rideId },
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.rides.all });
          router.back();
        },
      },
    ]);
  }, [rideId, queryClient, router, t]);

  const handleCycleMapStyle = useCallback(() => {
    setMapStyle((prev) => {
      const next = cycleMapStyle(prev);
      trackEvent(AnalyticsEvent.RIDE_MAP_STYLE_CHANGED, {
        ride_id: rideId ?? null,
        from_style: prev,
        to_style: next,
      });
      return next;
    });
  }, [rideId]);

  const handleStatTap = useCallback(
    (chart: ChartType) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setActiveChart((prev) => {
        if (prev === chart) {
          sheetRef.current?.snapToIndex(1);
          return null;
        }
        sheetRef.current?.snapToIndex(2);
        trackEvent(AnalyticsEvent.RIDE_CHART_VIEWED, {
          ride_id: rideId ?? null,
          chart_type: chart,
          source: 'ride_detail',
        });
        return chart;
      });
    },
    [rideId],
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={2} disappearsOnIndex={1} opacity={0.3} />
    ),
    [],
  );

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isMapFullScreen) {
        sheetRef.current?.snapToIndex(0);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [isMapFullScreen]);

  if (isLoading || !ride) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={theme.warm} />
      </View>
    );
  }

  const distanceM = ride.distanceM ?? 0;
  const durationS = ride.durationS ?? 0;
  const maxSpeedMps = ride.maxSpeedMps ?? 0;
  const avgSpeedMps = ride.avgSpeedMps ?? 0;
  const elevationGain = ride.elevationGain ?? 0;
  const pausedDurationS = ride.pausedDurationS ?? 0;
  const pauseCount = pausedDurationS > 0 ? Math.max(1, Math.round(pausedDurationS / 240)) : 0;
  // Lean angle: cap at 55° (phone IMU noise), display with caveat
  const maxLeanAngle = ride.maxLeanAngle != null ? Math.min(ride.maxLeanAngle, 55) : null;
  const [showLeanTooltip, setShowLeanTooltip] = useState(false);

  const statTiles: {
    icon: typeof Route;
    label: string;
    value: string;
    unit: string;
    chartType?: ChartType;
    hasChart?: boolean;
  }[] = [
    {
      icon: Route,
      label: t('rideDetail.distance'),
      value: formatDistance(distanceM, system),
      unit: '',
    },
    {
      icon: Clock,
      label: t('rideDetail.movingTime'),
      value: formatDuration(durationS),
      unit: '',
    },
    {
      icon: Mountain,
      label: t('rideDetail.elevGain'),
      value: elevationGain > 0 ? formatElevation(elevationGain, system) : 'NA',
      unit: '',
      chartType: 'elevation',
      hasChart: elevationGain > 0,
    },
    {
      icon: Gauge,
      label: t('rideDetail.avgSpeed'),
      value: avgSpeedMps > 0 ? formatSpeed(avgSpeedMps, system) : 'NA',
      unit: '',
      chartType: 'speed',
      hasChart: avgSpeedMps > 0,
    },
    {
      icon: Gauge,
      label: t('rideDetail.maxSpeed'),
      value: maxSpeedMps > 0 ? formatSpeed(maxSpeedMps, system) : 'NA',
      unit: '',
    },
    {
      icon: Pause,
      label: t('rideDetail.pauses'),
      value: pauseCount > 0 ? String(pauseCount) : '0',
      unit: pauseCount > 0 && pausedDurationS > 0 ? `${Math.round(pausedDurationS / 60)}m` : '',
    },
    ...(maxLeanAngle != null
      ? [
          {
            icon: TrendingDown,
            label: t('rideDetail.leanAngle'),
            value: maxLeanAngle >= 55 ? '55°+' : `${Math.round(maxLeanAngle)}°`,
            unit: '',
          },
        ]
      : []),
  ];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Full-screen map */}
        <View style={{ flex: 1 }}>
          {routeData ? (
            <MapboxGL.MapView
              style={{ flex: 1 }}
              styleURL={MAP_STYLES[mapStyle]}
              surfaceView={process.env.EXPO_OS !== 'android'}
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
            >
              <MapboxGL.Camera
                bounds={{
                  ne: routeData.bounds.ne,
                  sw: routeData.bounds.sw,
                  paddingTop: insets.top + 60,
                  paddingBottom: 200,
                  paddingLeft: 40,
                  paddingRight: 40,
                }}
                animationDuration={1000}
              />
              <MapboxGL.ShapeSource id="route-source" shape={routeData.geojson}>
                <MapboxGL.LineLayer
                  id="route-line"
                  style={{
                    lineColor: theme.warm,
                    lineWidth: 4,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </MapboxGL.ShapeSource>
              <MapboxGL.MarkerView id="start" coordinate={routeData.startPoint}>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: theme.success,
                    borderWidth: 3,
                    borderColor: palette.white,
                  }}
                />
              </MapboxGL.MarkerView>
              <MapboxGL.MarkerView id="end" coordinate={routeData.endPoint}>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: theme.danger,
                    borderWidth: 3,
                    borderColor: palette.white,
                  }}
                />
              </MapboxGL.MarkerView>
            </MapboxGL.MapView>
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Route size={32} color={theme.ink3} />
              <Text style={{ fontSize: 14, color: theme.ink3 }}>{t('rideDetail.noRouteData')}</Text>
            </View>
          )}
        </View>

        {/* Floating controls — top left: back */}
        <View style={{ position: 'absolute', top: insets.top + 8, left: 16, zIndex: 10 }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.bg, 0.85),
              borderWidth: 1,
              borderColor: theme.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={16} color={theme.ink} />
          </Pressable>
        </View>

        {/* Floating controls — top right */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 16,
            flexDirection: 'row',
            gap: 8,
            zIndex: 10,
          }}
        >
          {routeData && (
            <Pressable
              onPress={handleCycleMapStyle}
              accessibilityRole="button"
              accessibilityLabel="Change map style"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderCurve: 'continuous',
                backgroundColor: tint(theme.bg, 0.85),
                borderWidth: 1,
                borderColor: theme.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MapIcon size={16} color={theme.ink} />
            </Pressable>
          )}
          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share ride"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.bg, 0.85),
              borderWidth: 1,
              borderColor: theme.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Share2 size={16} color={theme.ink} />
          </Pressable>
        </View>

        {/* Re-open pill */}
        {isMapFullScreen && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              position: 'absolute',
              bottom: insets.bottom + 16,
              alignSelf: 'center',
              zIndex: 10,
            }}
          >
            <Pressable
              onPress={() => sheetRef.current?.snapToIndex(0)}
              style={{
                backgroundColor: theme.surface,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
                borderCurve: 'continuous',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderWidth: 1,
                borderColor: theme.line,
              }}
            >
              <ChevronUp size={16} color={theme.ink} />
              <Text style={{ color: theme.ink, fontSize: 14, fontWeight: '600' }}>
                {t('rideDetail.showDetails')}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Bottom sheet */}
        <BottomSheet
          ref={sheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose
          enableContentPanningGesture={activeChart === null}
          onChange={(index) => {
            setIsMapFullScreen(index === -1);
            if (index === -1) setActiveChart(null);
          }}
          backgroundStyle={{
            backgroundColor: theme.bg,
            borderRadius: 24,
            borderCurve: 'continuous',
          }}
          handleIndicatorStyle={{ backgroundColor: theme.ink4, width: 38 }}
          backdropComponent={renderBackdrop}
        >
          <BottomSheetScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
          >
            {/* Date kicker */}
            <Animated.View entering={FadeInUp.duration(250)} style={{ gap: 4 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: theme.ink3,
                  textTransform: 'uppercase',
                  letterSpacing: 1.6,
                }}
              >
                {formatFullDate(ride.startedAt)}
                {ride.startedAt ? ` · ${formatTime(ride.startedAt)}` : ''}
              </Text>
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '300',
                  color: theme.ink,
                  letterSpacing: -0.5,
                  lineHeight: 30,
                }}
              >
                {ride.name || 'Ride'}
              </Text>
              {/* Time range */}
              {ride.startedAt && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    gap: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: theme.surface,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: theme.line,
                    marginTop: 4,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.success,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontVariant: ['tabular-nums'],
                      color: theme.ink2,
                    }}
                  >
                    {formatTime(ride.startedAt)}
                  </Text>
                  <View style={{ width: 12, height: 1, backgroundColor: theme.ink4 }} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontVariant: ['tabular-nums'],
                      color: theme.ink2,
                    }}
                  >
                    {ride.endedAt ? formatTime(ride.endedAt) : 'NA'}
                  </Text>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.danger,
                    }}
                  />
                </View>
              )}
            </Animated.View>

            {/* Stat grid — 3×2 tappable tiles */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {statTiles.map(({ icon, label, value, unit, chartType, hasChart: hasC }, index) => {
                const isChartTile = hasC !== undefined ? hasC : chartType != null;

                return (
                  <Animated.View
                    key={label}
                    entering={FadeInUp.delay(index * 40).duration(250)}
                    style={{ flexBasis: '30%', flexGrow: 1 }}
                  >
                    <StatTile
                      icon={icon}
                      label={label}
                      value={value}
                      unit={unit}
                      active={isChartTile && activeChart === chartType}
                      hasChart={isChartTile}
                      onPress={
                        isChartTile && chartType ? () => handleStatTap(chartType) : undefined
                      }
                    />
                  </Animated.View>
                );
              })}
            </View>

            {/* Lean angle caveat */}
            {maxLeanAngle != null && (
              <Pressable
                onPress={() => {
                  setShowLeanTooltip((p) => !p);
                  trackEvent(AnalyticsEvent.LEAN_ANGLE_TOOLTIP_OPENED, { ride_id: rideId });
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: 4,
                }}
              >
                <Info size={12} color={theme.ink4} />
                <Text style={{ fontSize: 10, color: theme.ink4 }}>
                  {t('rideDetail.leanCaveat')}
                </Text>
              </Pressable>
            )}
            {showLeanTooltip && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.line,
                  borderRadius: 10,
                  borderCurve: 'continuous',
                  padding: 10,
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 11, color: theme.ink3, lineHeight: 16 }}>
                  {t('rideDetail.leanTooltip')}
                </Text>
              </Animated.View>
            )}

            {/* Chart */}
            {activeChart && waypointsLoading && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.warm} />
              </View>
            )}
            {activeChart === 'speed' && !waypointsLoading && waypoints.length >= 2 && (
              <Animated.View entering={FadeIn.duration(200)}>
                <View
                  style={{
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.line,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    padding: 14,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '700',
                        color: theme.warm,
                        textTransform: 'uppercase',
                        letterSpacing: 1.2,
                      }}
                    >
                      {t('rideDetail.speedOverDistance')}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Pressable
                        onPress={() => setActiveChart('speed')}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: theme.ink,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '600', color: theme.bg }}>
                          {t('rideDetail.speed')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setActiveChart('elevation')}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '600', color: theme.ink3 }}>
                          {t('rideDetail.elevation')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  <RideSpeedChart waypoints={waypoints} system={system} />
                </View>
              </Animated.View>
            )}
            {activeChart === 'elevation' && !waypointsLoading && waypoints.length >= 2 && (
              <Animated.View entering={FadeIn.duration(200)}>
                <View
                  style={{
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.line,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    padding: 14,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '700',
                        color: theme.info,
                        textTransform: 'uppercase',
                        letterSpacing: 1.2,
                      }}
                    >
                      {t('rideDetail.elevationProfile')}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Pressable
                        onPress={() => setActiveChart('speed')}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '600', color: theme.ink3 }}>
                          {t('rideDetail.speed')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setActiveChart('elevation')}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: theme.ink,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '600', color: theme.bg }}>
                          {t('rideDetail.elevation')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  <RideElevationChart waypoints={waypoints} system={system} />
                </View>
              </Animated.View>
            )}
            {activeChart && !waypointsLoading && waypoints.length < 2 && (
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  padding: 20,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: theme.line,
                }}
              >
                <Text style={{ color: theme.ink3, fontSize: 14 }}>
                  {t('rideDetail.insufficientData')}
                </Text>
              </View>
            )}

            {/* Comments section */}
            {ride?.isPublic && <CommentList rideId={rideId} />}

            {/* Delete — owner only */}
            {isOwnerViewer && (
              <Pressable
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete ride"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 8,
                }}
              >
                <Trash2 size={14} color={theme.ink3} />
                <Text style={{ fontSize: 14, color: theme.ink3 }}>
                  {t('rideDetail.deleteRide')}
                </Text>
              </Pressable>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}
