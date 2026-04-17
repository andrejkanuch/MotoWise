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
  Calendar,
  ChevronUp,
  Clock,
  Gauge,
  Map as MapIcon,
  Mountain,
  Route,
  Share2,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  Share,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentList } from '../../components/comments/comment-list';
import { RideElevationChart } from '../../components/ride/ride-elevation-chart';
import { RideSpeedChart } from '../../components/ride/ride-speed-chart';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { cycleMapStyle, getDefaultMapStyle, MAP_STYLES } from '../../utils/map-styles';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatFullDate,
  formatSpeed,
  formatTime,
} from '../../utils/ride-formatters';
import { enqueue } from '../../utils/ride-sync-queue';

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

const STAT_CHART_MAP: Record<string, ChartType | null> = {
  'Avg Speed': 'speed',
  'Max Speed': 'speed',
  Elevation: 'elevation',
  'Elev. Loss': 'elevation',
  Distance: null,
  'Moving Time': null,
};

export default function RideDetailScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const system = useMeasurementSystem();
  const [mapStyle, setMapStyle] = useState(() => getDefaultMapStyle(isDark));
  const [activeChart, setActiveChart] = useState<ChartType | null>(null);
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['30%', '55%', '90%'], []);

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
  /** Avoid fetching waypoints until we know the viewer is the ride owner */
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

  // Decode polyline for map
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
    if (!ride) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const dist = formatDistance(ride.distanceM ?? 0, system);
      const dur = formatDuration(ride.durationS ?? 0);
      await Share.share({
        message: `${ride.name || 'My Ride'} — ${dist} in ${dur} with MotoVault!`,
      });
      trackEvent(AnalyticsEvent.RIDE_SHARED, { ride_id: rideId ?? '' });
    } catch {
      // cancelled
    }
  }, [ride, system, rideId]);

  const handleDelete = useCallback(() => {
    if (!rideId) return;
    Alert.alert('Delete Ride?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          trackEvent(AnalyticsEvent.RIDE_DELETED, { ride_id: rideId ?? '' });
          enqueue('deleteRide', {
            variables: { id: rideId },
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.rides.all });
          router.back();
        },
      },
    ]);
  }, [rideId, queryClient, router]);

  const handleCycleMapStyle = useCallback(() => {
    setMapStyle((prev) => cycleMapStyle(prev));
  }, []);

  const handleStatTap = useCallback((chart: ChartType) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveChart((prev) => {
      if (prev === chart) {
        // Toggling off — snap sheet back down
        sheetRef.current?.snapToIndex(1);
        return null;
      }
      // Toggling on — expand sheet and show chart
      sheetRef.current?.snapToIndex(2);
      return chart;
    });
  }, []);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={2} disappearsOnIndex={1} opacity={0.3} />
    ),
    [],
  );

  // Android back handler: re-open sheet instead of closing modal
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
          backgroundColor: isDark ? palette.surfaceDark : palette.neutral50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={palette.accent500} />
      </View>
    );
  }

  const distanceM = ride.distanceM ?? 0;
  const durationS = ride.durationS ?? 0;
  const maxSpeedMps = ride.maxSpeedMps ?? 0;
  const avgSpeedMps = ride.avgSpeedMps ?? 0;
  const elevationGain = ride.elevationGain ?? 0;
  const elevationLoss = ride.elevationLoss ?? 0;

  const stats = [
    { icon: Route, label: 'Distance', value: formatDistance(distanceM, system) },
    { icon: Clock, label: 'Moving Time', value: formatDuration(durationS) },
    { icon: Gauge, label: 'Avg Speed', value: formatSpeed(avgSpeedMps, system) },
    { icon: Gauge, label: 'Max Speed', value: formatSpeed(maxSpeedMps, system) },
    ...(elevationGain > 0
      ? [{ icon: Mountain, label: 'Elevation', value: formatElevation(elevationGain, system) }]
      : []),
    ...(elevationLoss > 0
      ? [{ icon: Mountain, label: 'Elev. Loss', value: formatElevation(elevationLoss, system) }]
      : []),
  ];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: isDark ? palette.surfaceDark : palette.neutral50 }}>
        {/* Full-screen map */}
        <View style={{ flex: 1 }}>
          {routeData ? (
            <MapboxGL.MapView
              style={{ flex: 1 }}
              styleURL={MAP_STYLES[mapStyle]}
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
                    lineColor: palette.accent500,
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
                    backgroundColor: palette.success500,
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
                    backgroundColor: palette.signature500,
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
                backgroundColor: isDark ? palette.cardDark : palette.white,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Route size={32} color={palette.neutral600} />
              <Text style={{ fontSize: 14, color: palette.neutral500 }}>No route data</Text>
            </View>
          )}
        </View>

        {/* Floating controls — top left: back */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            zIndex: 10,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderCurve: 'continuous',
              backgroundColor: palette.surfaceOverlay,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={20} color={palette.white} />
          </Pressable>
        </View>

        {/* Floating controls — top right: map style + share */}
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
                width: 44,
                height: 44,
                borderRadius: 22,
                borderCurve: 'continuous',
                backgroundColor: palette.surfaceOverlay,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MapIcon size={18} color={palette.white} />
            </Pressable>
          )}
          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share ride"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderCurve: 'continuous',
              backgroundColor: palette.surfaceOverlay,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Share2 size={18} color={palette.white} />
          </Pressable>
        </View>

        {/* Re-open pill when sheet is closed */}
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
                backgroundColor: isDark ? palette.cardDark : palette.white,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
                borderCurve: 'continuous',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderWidth: 1,
                borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
              }}
            >
              <ChevronUp size={16} color={isDark ? palette.white : palette.neutral950} />
              <Text
                style={{
                  color: isDark ? palette.white : palette.neutral950,
                  fontSize: 14,
                  fontWeight: '600',
                }}
              >
                Show Details
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Bottom sheet overlay */}
        <BottomSheet
          ref={sheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose
          enableContentPanningGesture={activeChart === null}
          onChange={(index) => {
            setIsMapFullScreen(index === -1);
            if (index === -1) {
              setActiveChart(null);
            }
          }}
          backgroundStyle={{
            backgroundColor: isDark ? palette.cardDark : palette.white,
            borderRadius: 24,
            borderCurve: 'continuous',
          }}
          handleIndicatorStyle={{ backgroundColor: palette.neutral500, width: 40 }}
          backdropComponent={renderBackdrop}
        >
          <BottomSheetScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
          >
            {/* Ride name + date */}
            <Animated.View entering={FadeInUp.duration(250)} style={{ gap: 4 }}>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '800',
                  color: isDark ? palette.white : palette.neutral950,
                  letterSpacing: -0.5,
                }}
              >
                {ride.name || 'Ride'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Calendar size={14} color={isDark ? palette.neutral400 : palette.neutral500} />
                <Text
                  style={{ fontSize: 14, color: isDark ? palette.neutral400 : palette.neutral500 }}
                >
                  {formatFullDate(ride.startedAt)}
                  {ride.startedAt && ` at ${formatTime(ride.startedAt)}`}
                </Text>
              </View>
            </Animated.View>

            {/* Stats grid — tappable tiles */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {stats.map(({ icon: Icon, label, value }, index) => {
                const chartKey = STAT_CHART_MAP[label] ?? null;
                const hasChart = chartKey !== null;

                return (
                  <Animated.View
                    key={label}
                    entering={FadeInUp.delay(index * 50).duration(250)}
                    style={{ flexBasis: '47%', flexGrow: 1 }}
                  >
                    <Pressable
                      onPress={hasChart ? () => handleStatTap(chartKey) : undefined}
                      accessibilityRole="button"
                      accessibilityHint={hasChart ? 'Double tap to view chart' : undefined}
                      disabled={!hasChart}
                      style={({ pressed }) => ({
                        backgroundColor:
                          pressed && hasChart
                            ? palette.surfaceHover
                            : isDark
                              ? palette.surfaceSubtle
                              : palette.neutral100,
                        borderRadius: 16,
                        borderCurve: 'continuous',
                        padding: 14,
                        gap: 6,
                        borderWidth: 1,
                        borderColor:
                          hasChart && activeChart === chartKey
                            ? palette.accent500
                            : isDark
                              ? palette.surfaceElevated
                              : palette.neutral200,
                      })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon size={14} color={palette.neutral500} />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: palette.neutral500,
                          }}
                        >
                          {label}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: '800',
                          color: isDark ? palette.white : palette.neutral950,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {/* Active chart (conditionally rendered) */}
            {activeChart && waypointsLoading && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={palette.accent500} />
              </View>
            )}
            {activeChart === 'speed' && !waypointsLoading && waypoints.length >= 10 && (
              <RideSpeedChart waypoints={waypoints} system={system} />
            )}
            {activeChart === 'elevation' && !waypointsLoading && waypoints.length >= 10 && (
              <RideElevationChart waypoints={waypoints} system={system} />
            )}
            {activeChart && !waypointsLoading && waypoints.length < 10 && (
              <View
                style={{
                  backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  padding: 20,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
                }}
              >
                <Text style={{ color: palette.neutral500, fontSize: 14 }}>
                  Insufficient data for chart
                </Text>
              </View>
            )}

            {/* Comments section */}
            {ride?.isPublic && <CommentList rideId={rideId} />}

            {/* Delete — owner session only (public deep links use getPublicRide) */}
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
                <Trash2 size={14} color={palette.neutral500} />
                <Text style={{ fontSize: 14, color: palette.neutral500 }}>Delete Ride</Text>
              </Pressable>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}
