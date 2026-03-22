import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import {
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
import { ActivityIndicator, Alert, BackHandler, Pressable, Share, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RideElevationChart } from '../../components/ride/ride-elevation-chart';
import { RideSpeedChart } from '../../components/ride/ride-speed-chart';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { MAP_STYLES, type MapStyle } from '../../utils/map-styles';
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

const STAT_CHART_MAP: Record<string, ChartType | null> = {
  'Avg Speed': 'speed',
  'Max Speed': 'speed',
  Elevation: 'elevation',
  Distance: null,
  'Moving Time': null,
};

export default function RideDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const system = useMeasurementSystem();
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [activeChart, setActiveChart] = useState<ChartType | null>(null);
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['30%', '55%', '90%'], []);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.rides.detail(rideId ?? ''),
    queryFn: () => gqlFetcher(GetRideDocument, { id: rideId }),
    enabled: !!rideId,
  });

  const { data: waypointData, isLoading: waypointsLoading } = useQuery({
    queryKey: queryKeys.rides.waypoints(rideId ?? ''),
    queryFn: () => gqlFetcher(GetRideWaypointsDocument, { rideId, maxPoints: 300 }),
    enabled: !!rideId,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const ride = (data as GetRideQuery | undefined)?.ride;
  const waypoints = (waypointData as GetRideWaypointsQuery | undefined)?.rideWaypoints ?? [];

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
    } catch {
      // cancelled
    }
  }, [ride, system]);

  const handleDelete = useCallback(() => {
    if (!rideId) return;
    Alert.alert('Delete Ride?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          enqueue('deleteRide', {
            variables: { id: rideId },
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.rides.all });
          router.back();
        },
      },
    ]);
  }, [rideId, queryClient, router]);

  const cycleMapStyle = useCallback(() => {
    const styles: MapStyle[] = ['dark', 'outdoors', 'satellite'];
    const idx = styles.indexOf(mapStyle);
    setMapStyle(styles[(idx + 1) % styles.length]);
  }, [mapStyle]);

  const handleStatTap = useCallback((chart: ChartType) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveChart((prev) => {
      const next = prev === chart ? null : chart;
      // Auto-expand sheet when opening chart
      if (next !== null) {
        sheetRef.current?.snapToIndex(2);
      }
      return next;
    });
  }, []);

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
          backgroundColor: palette.surfaceDark,
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

  const stats = [
    { icon: Route, label: 'Distance', value: formatDistance(distanceM, system) },
    { icon: Clock, label: 'Moving Time', value: formatDuration(durationS) },
    { icon: Gauge, label: 'Avg Speed', value: formatSpeed(avgSpeedMps, system) },
    { icon: Gauge, label: 'Max Speed', value: formatSpeed(maxSpeedMps, system) },
    ...(elevationGain > 0
      ? [{ icon: Mountain, label: 'Elevation', value: formatElevation(elevationGain, system) }]
      : []),
  ];

  const hasWaypointChartData = waypoints.length >= 10;

  return (
    <View style={{ flex: 1, backgroundColor: palette.surfaceDark }}>
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

            <MapboxGL.PointAnnotation id="start" coordinate={routeData.startPoint}>
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
            </MapboxGL.PointAnnotation>

            <MapboxGL.PointAnnotation id="end" coordinate={routeData.endPoint}>
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
            </MapboxGL.PointAnnotation>
          </MapboxGL.MapView>
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: palette.cardDark,
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
            onPress={cycleMapStyle}
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
              backgroundColor: palette.cardDark,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
              borderCurve: 'continuous',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderWidth: 1,
              borderColor: palette.surfaceElevated,
            }}
          >
            <ChevronUp size={16} color={palette.white} />
            <Text style={{ color: palette.white, fontSize: 14, fontWeight: '600' }}>
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
        onChange={(index) => setIsMapFullScreen(index === -1)}
        backgroundStyle={{
          backgroundColor: palette.cardDark,
          borderRadius: 24,
          borderCurve: 'continuous',
        }}
        handleIndicatorStyle={{ backgroundColor: palette.neutral500, width: 40 }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={2} disappearsOnIndex={1} opacity={0.3} />
        )}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}>
          {/* Ride name + date */}
          <Animated.View entering={FadeInUp.duration(250)} style={{ gap: 4 }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: '800',
                color: palette.white,
                letterSpacing: -0.5,
              }}
            >
              {ride.name || 'Ride'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Calendar size={14} color={palette.neutral400} />
              <Text style={{ fontSize: 14, color: palette.neutral400 }}>
                {formatFullDate(ride.startedAt)}
                {ride.startedAt && ` at ${formatTime(ride.startedAt)}`}
              </Text>
            </View>
          </Animated.View>

          {/* Stats grid — tappable tiles */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {stats.map(({ icon: Icon, label, value }, index) => {
              const chartKey = STAT_CHART_MAP[label] ?? null;
              const isTappable = chartKey !== null && hasWaypointChartData;

              return (
                <Animated.View
                  key={label}
                  entering={FadeInUp.delay(index * 50).duration(250)}
                  style={{ flexBasis: '47%', flexGrow: 1 }}
                >
                  <Pressable
                    onPress={chartKey ? () => handleStatTap(chartKey) : undefined}
                    accessibilityRole="button"
                    accessibilityHint={isTappable ? 'Double tap to view chart' : undefined}
                    disabled={!isTappable}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? palette.surfaceHover : palette.surfaceSubtle,
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      padding: 14,
                      gap: 6,
                      borderWidth: 1,
                      borderColor:
                        activeChart === chartKey ? palette.accent500 : palette.surfaceElevated,
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
                        color: palette.white,
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
          {activeChart === 'speed' && waypoints.length >= 10 && (
            <Animated.View entering={FadeInUp.duration(250)}>
              <RideSpeedChart waypoints={waypoints} system={system} />
            </Animated.View>
          )}
          {activeChart === 'elevation' && waypoints.length >= 10 && (
            <Animated.View entering={FadeInUp.duration(250)}>
              <RideElevationChart waypoints={waypoints} system={system} />
            </Animated.View>
          )}
          {activeChart && waypoints.length < 10 && !waypointsLoading && (
            <View
              style={{
                backgroundColor: palette.surfaceSubtle,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 20,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: palette.surfaceElevated,
              }}
            >
              <Text style={{ color: palette.neutral500, fontSize: 14 }}>
                Insufficient data for chart
              </Text>
            </View>
          )}
          {activeChart && waypointsLoading && (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={palette.accent500} />
            </View>
          )}

          {/* Delete action */}
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
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
