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
  Clock,
  Gauge,
  Info,
  Layers,
  Mountain,
  Route,
  Share2,
  Trash2,
  TrendingDown,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, BackHandler, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentList } from '../../components/comments/comment-list';
import { MapPickerSheet } from '../../components/ride/map-picker-sheet';
import { RideElevationChart } from '../../components/ride/ride-elevation-chart';
import { RideSpeedChart } from '../../components/ride/ride-speed-chart';
import { RideStatTile } from '../../components/ride/ride-stat-tile';
import { ShareActivitySheet } from '../../components/share/share-activity-sheet';
import type { RideSharePayload } from '../../components/share/share-card-types';
import { useBikeName } from '../../hooks/use-bike-name';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { useRideHeatmapData } from '../../hooks/use-ride-heatmap-data';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { tint, useEditorialTheme } from '../../theme/editorial';
import {
  getDefaultMapStyle,
  MAP_STYLES,
  type MapStyle,
  needsHeatmapOverlay,
  needsTerrain3D,
} from '../../utils/map-styles';
import { decodePolylineLatLng } from '../../utils/polyline';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDistanceValue,
  formatDuration,
  formatElevationValue,
  formatSpeed,
  formatSpeedValue,
  speedUnitLabel,
} from '../../utils/ride-formatters';
import { enqueueOrExecute } from '../../utils/ride-sync-queue';

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
  const [showLeanTooltip, setShowLeanTooltip] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const { heatmapGeoJSON } = useRideHeatmapData({ enabled: needsHeatmapOverlay(mapStyle) });
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [100, '45%', '92%'], []);

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

  const bikeName = useBikeName(ride?.motorcycleId);

  const routeData = useMemo(() => {
    if (!ride?.routePolyline) return null;

    try {
      const decoded = decodePolylineLatLng(ride.routePolyline);
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

  const handleShare = useCallback(() => {
    if (!ride || !rideId) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowShareSheet(true);
  }, [ride, rideId]);

  const sharePayload = useMemo<RideSharePayload | null>(() => {
    if (!ride || !rideId) return null;
    return {
      rideId,
      rideName: ride.name ?? 'Ride',
      rideNumber: null,
      date: ride.startedAt ?? new Date().toISOString(),
      distanceM: ride.distanceM ?? 0,
      durationS: ride.durationS ?? 0,
      elevationGainM: ride.elevationGain ?? null,
      elevationPeakM: null,
      elevationProfile: waypoints.map((w) => w.altitude ?? 0),
      maxSpeedMps: ride.maxSpeedMps ?? null,
      routeCoordinates:
        routeData?.geojson.features[0]?.geometry.type === 'LineString'
          ? (routeData.geojson.features[0].geometry.coordinates as [number, number][])
          : [],
      mapSnapshotUri: null,
      bikeName,
      measurementSystem: system,
      isPB: false,
      pbType: null,
      prevPbValue: null,
    };
  }, [ride, rideId, waypoints, routeData, bikeName, system]);

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

  const handleMapStyleSelect = useCallback(
    (style: MapStyle) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      trackEvent(AnalyticsEvent.RIDE_MAP_STYLE_CHANGED, {
        ride_id: rideId ?? null,
        from_style: mapStyle,
        to_style: style,
      });
      setMapStyle(style);
      setShowMapPicker(false);
    },
    [rideId, mapStyle],
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={2} disappearsOnIndex={1} opacity={0.3} />
    ),
    [],
  );

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showMapPicker) {
        setShowMapPicker(false);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [showMapPicker]);

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
  const rawLean =
    'maxLeanAngle' in ride ? (ride as { maxLeanAngle?: number | null }).maxLeanAngle : null;
  const maxLeanAngle = rawLean != null ? Math.min(rawLean, 55) : null;

  // Elapsed time = moving + paused
  const elapsedS = durationS + pausedDurationS;

  // Eyebrow: "SATURDAY · MAY 24, 2026 · BMW R 1250 GS"
  const eyebrowDate = ride.startedAt
    ? new Date(ride.startedAt)
        .toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
        .toUpperCase()
    : '';
  const eyebrowText = bikeName ? `${eyebrowDate} · ${bikeName.toUpperCase()}` : eyebrowDate;

  const defaultMapStyle = getDefaultMapStyle(isDark);
  const isNonDefaultStyle = mapStyle !== defaultMapStyle;

  // Glass morphism FAB style
  const fabStyle = {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderCurve: 'continuous' as const,
    backgroundColor: 'rgba(30,28,25,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  const fabShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Full-screen map — absolute, fills screen */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {routeData ? (
            <MapboxGL.MapView
              style={{ flex: 1 }}
              styleURL={MAP_STYLES[mapStyle]}
              surfaceView={process.env.EXPO_OS !== 'android'}
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <MapboxGL.Camera
                bounds={{
                  ne: routeData.bounds.ne,
                  sw: routeData.bounds.sw,
                  paddingTop: insets.top + 80,
                  paddingBottom: 160,
                  paddingLeft: 40,
                  paddingRight: 40,
                }}
                animationDuration={0}
              />
              {/* Route glow (wider, semi-transparent) */}
              <MapboxGL.ShapeSource id="route-glow-source" shape={routeData.geojson}>
                <MapboxGL.LineLayer
                  id="route-glow"
                  style={{
                    lineColor: theme.warm,
                    lineWidth: 10,
                    lineOpacity: 0.15,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </MapboxGL.ShapeSource>
              {/* Route line */}
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
              {/* Start pin: white circle with copper border */}
              <MapboxGL.MarkerView id="start" coordinate={routeData.startPoint}>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: palette.white,
                    borderWidth: 3,
                    borderColor: theme.warm,
                  }}
                />
              </MapboxGL.MarkerView>
              {/* End pin: copper circle with white inner dot */}
              <MapboxGL.MarkerView id="end" coordinate={routeData.endPoint}>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: theme.warm,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: palette.white,
                    }}
                  />
                </View>
              </MapboxGL.MarkerView>

              {/* 3D terrain (when terrain style selected) */}
              {needsTerrain3D(mapStyle) && (
                <>
                  <MapboxGL.RasterDemSource
                    id="mapbox-dem"
                    url="mapbox://mapbox.mapbox-terrain-dem-v1"
                    tileSize={512}
                    maxZoomLevel={14}
                  >
                    <MapboxGL.Terrain style={{ exaggeration: 1.5 }} />
                  </MapboxGL.RasterDemSource>
                  <MapboxGL.SkyLayer
                    id="sky"
                    style={{
                      skyType: 'atmosphere',
                      skyAtmosphereSun: [0, 90],
                      skyAtmosphereSunIntensity: 15,
                    }}
                  />
                  <MapboxGL.Atmosphere
                    style={{
                      color: 'rgb(186,210,235)',
                      highColor: 'rgb(36,92,223)',
                      horizonBlend: 0.02,
                      spaceColor: 'rgb(11,11,25)',
                      starIntensity: 0.6,
                    }}
                  />
                </>
              )}

              {/* Personal heatmap overlay (all rides) */}
              {needsHeatmapOverlay(mapStyle) && heatmapGeoJSON && (
                <MapboxGL.ShapeSource id="ride-heatmap-source" shape={heatmapGeoJSON}>
                  <MapboxGL.HeatmapLayer
                    id="ride-heatmap"
                    maxZoomLevel={16}
                    style={{
                      heatmapRadius: ['interpolate', ['linear'], ['zoom'], 8, 15, 15, 30],
                      heatmapIntensity: ['interpolate', ['linear'], ['zoom'], 8, 1, 15, 3],
                      heatmapColor: [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0,
                        'rgba(0,0,0,0)',
                        0.2,
                        '#1a1a2e',
                        0.4,
                        '#3a2a1d',
                        0.6,
                        '#c8772c',
                        0.8,
                        '#e89d5a',
                        1.0,
                        '#ffffff',
                      ],
                      heatmapOpacity: ['interpolate', ['linear'], ['zoom'], 13, 0.8, 16, 0],
                    }}
                  />
                </MapboxGL.ShapeSource>
              )}
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

        {/* Back FAB — top-left */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 12,
            left: 16,
            zIndex: 10,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ ...fabStyle, ...fabShadow }}
          >
            <ArrowLeft size={18} color="rgba(255,255,255,0.92)" />
          </Pressable>
        </View>

        {/* FAB cluster — top-right, vertical stack */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 12,
            right: 16,
            zIndex: 10,
            gap: 12,
          }}
        >
          {/* Share FAB */}
          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share ride"
            style={{ ...fabStyle, ...fabShadow }}
          >
            <Share2 size={18} color="rgba(255,255,255,0.92)" />
          </Pressable>

          {/* Layers FAB */}
          {routeData && (
            <Pressable
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowMapPicker(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Change map style"
              style={{ ...fabStyle, ...fabShadow }}
            >
              <Layers size={18} color="rgba(255,255,255,0.92)" />
              {/* Copper dot indicator when non-default style */}
              {isNonDefaultStyle && (
                <View
                  style={{
                    position: 'absolute',
                    top: 9,
                    right: 9,
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: theme.warm,
                  }}
                />
              )}
            </Pressable>
          )}

          {/* 3D FAB */}
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              router.push({ pathname: '/(modals)/ride-flyover', params: { rideId } });
            }}
            accessibilityRole="button"
            accessibilityLabel="3D flyover"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: theme.warm,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: 'rgba(200,119,44,1)',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'GeistMono-Bold',
                fontSize: 11,
                fontWeight: '700',
                color: palette.white,
                letterSpacing: 0.44,
              }}
            >
              3D
            </Text>
          </Pressable>
        </View>

        {/* Ride sheet */}
        <BottomSheet
          ref={sheetRef}
          index={0}
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          enablePanDownToClose={false}
          backgroundStyle={{
            backgroundColor: isDark ? '#1E1C19' : '#f5f2ec',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderCurve: 'continuous',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.18,
            shadowRadius: 30,
          }}
          handleIndicatorStyle={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(22,20,18,0.18)',
            width: 36,
            height: 4,
          }}
          backdropComponent={renderBackdrop}
        >
          <BottomSheetScrollView
            contentContainerStyle={{ padding: 20, paddingTop: 14, paddingBottom: 40, gap: 14 }}
          >
            {/* Eyebrow */}
            <Animated.View entering={FadeInUp.duration(250)} style={{ gap: 4 }}>
              <Text
                style={{
                  fontFamily: 'GeistMono-SemiBold',
                  fontSize: 10,
                  fontWeight: '600',
                  color: theme.ink3,
                  textTransform: 'uppercase',
                  letterSpacing: 2.2,
                }}
              >
                {eyebrowText}
              </Text>

              {/* Title */}
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '700',
                  color: theme.ink,
                  letterSpacing: -0.57,
                  lineHeight: 29,
                  marginTop: 4,
                }}
              >
                {ride.name || 'Ride'}
              </Text>

              {/* Duration chip */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: tint(theme.ink, 0.06),
                  borderRadius: 99,
                  borderCurve: 'continuous',
                  marginTop: 10,
                }}
              >
                {/* Green pip + moving time */}
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    backgroundColor: '#2bb673',
                  }}
                />
                <Text
                  style={{
                    fontFamily: 'GeistMono-Medium',
                    fontSize: 11.5,
                    fontWeight: '500',
                    fontVariant: ['tabular-nums'],
                    color: theme.ink2,
                    letterSpacing: 0.58,
                  }}
                >
                  {formatDuration(durationS)}
                </Text>
                {/* Separator + elapsed if different */}
                {elapsedS > durationS && (
                  <>
                    <Text
                      style={{
                        fontFamily: 'GeistMono-Medium',
                        fontSize: 11.5,
                        color: theme.ink4,
                      }}
                    >
                      {' '}
                      ·{' '}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'GeistMono-Medium',
                        fontSize: 11.5,
                        fontWeight: '500',
                        fontVariant: ['tabular-nums'],
                        color: theme.ink2,
                        letterSpacing: 0.58,
                      }}
                    >
                      {formatDuration(elapsedS)}
                    </Text>
                  </>
                )}
                {/* Red pip + paused time */}
                {pausedDurationS > 0 && (
                  <>
                    <Text
                      style={{
                        fontFamily: 'GeistMono-Medium',
                        fontSize: 11.5,
                        color: theme.ink4,
                      }}
                    >
                      {' '}
                      ·{' '}
                    </Text>
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 99,
                        backgroundColor: '#d04a3c',
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: 'GeistMono-Medium',
                        fontSize: 11.5,
                        fontWeight: '500',
                        fontVariant: ['tabular-nums'],
                        color: theme.ink2,
                        letterSpacing: 0.58,
                      }}
                    >
                      {formatDuration(pausedDurationS)}
                    </Text>
                  </>
                )}
              </View>
            </Animated.View>

            {/* 3x2 stat grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <RideStatTile
                icon={<Route size={14} color={theme.warm} />}
                label={t('rideDetail.distance')}
                value={formatDistanceValue(distanceM, system)}
                unit={distanceUnitLabel(system)}
                copper
                delay={0}
                theme={theme}
              />
              <RideStatTile
                icon={<Clock size={14} color={theme.ink3} />}
                label={t('rideDetail.movingTime')}
                value={formatDuration(durationS)}
                delay={40}
                theme={theme}
              />
              <RideStatTile
                icon={<Mountain size={14} color={theme.ink3} />}
                label={t('rideDetail.elevGain')}
                value={
                  elevationGain > 0 ? String(formatElevationValue(elevationGain, system)) : 'NA'
                }
                unit={elevationGain > 0 ? elevationUnitLabel(system) : undefined}
                delay={80}
                theme={theme}
              />
              <RideStatTile
                icon={<Gauge size={14} color={theme.ink3} />}
                label={t('rideDetail.avgSpeed')}
                value={avgSpeedMps > 0 ? String(formatSpeedValue(avgSpeedMps, system)) : 'NA'}
                unit={avgSpeedMps > 0 ? speedUnitLabel(system) : undefined}
                delay={120}
                theme={theme}
              />
              <RideStatTile
                icon={<Gauge size={14} color={theme.ink3} />}
                label={t('rideDetail.maxSpeed')}
                value={maxSpeedMps > 0 ? String(formatSpeedValue(maxSpeedMps, system)) : 'NA'}
                unit={maxSpeedMps > 0 ? speedUnitLabel(system) : undefined}
                delay={160}
                theme={theme}
                badge={
                  <View
                    style={{
                      paddingHorizontal: 5,
                      paddingVertical: 2,
                      borderRadius: 99,
                      backgroundColor: tint(theme.ink, 0.06),
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'GeistMono-Bold',
                        fontSize: 7,
                        fontWeight: '700',
                        letterSpacing: 1.12,
                        textTransform: 'uppercase',
                        color: theme.ink3,
                      }}
                    >
                      {t('rideDetail.private')}
                    </Text>
                  </View>
                }
              />
              {maxLeanAngle != null && (
                <RideStatTile
                  icon={<TrendingDown size={14} color={theme.ink3} />}
                  label={t('rideDetail.leanAngle')}
                  value={maxLeanAngle >= 55 ? '55+' : String(Math.round(maxLeanAngle))}
                  unit="°"
                  delay={200}
                  theme={theme}
                  trailing={
                    <Pressable
                      onPress={() => {
                        setShowLeanTooltip((p) => !p);
                        trackEvent(AnalyticsEvent.LEAN_ANGLE_TOOLTIP_OPENED, { ride_id: rideId });
                      }}
                      hitSlop={8}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: tint(theme.ink, 0.25),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Info size={9} color={theme.ink3} />
                    </Pressable>
                  }
                />
              )}
            </View>

            {/* Lean angle tooltip */}
            {showLeanTooltip && maxLeanAngle != null && (
              <Animated.View entering={FadeIn.duration(200)} style={{ padding: 12 }}>
                <Text
                  style={{
                    fontFamily: 'GeistMono-Regular',
                    fontSize: 12,
                    color: theme.ink2,
                    lineHeight: 18,
                  }}
                >
                  {t('rideDetail.leanTooltip')}
                </Text>
              </Animated.View>
            )}

            {/* Elevation chart card */}
            {elevationGain > 0 && waypoints.length >= 2 && (
              <Animated.View entering={FadeIn.duration(200)}>
                <View
                  style={{
                    borderRadius: 18,
                    borderCurve: 'continuous',
                    padding: 14,
                    paddingBottom: 12,
                    backgroundColor: tint(theme.ink, 0.03),
                    borderWidth: 1,
                    borderColor: tint(theme.ink, 0.04),
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'GeistMono-SemiBold',
                        fontSize: 10,
                        fontWeight: '600',
                        letterSpacing: 1.8,
                        textTransform: 'uppercase',
                        color: theme.warm,
                      }}
                    >
                      {t('rideDetail.elevationChart')}
                    </Text>
                    {/* Peak pill */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        borderRadius: 99,
                        backgroundColor: tint(theme.warm, 0.1),
                        borderWidth: 1,
                        borderColor: tint(theme.warm, 0.25),
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'GeistMono-SemiBold',
                          fontSize: 10,
                          fontWeight: '600',
                          letterSpacing: 0.6,
                          color: theme.warm,
                        }}
                      >
                        {`\u2191 ${t('rideDetail.peak', { value: `${formatElevationValue(elevationGain, system)}${elevationUnitLabel(system).toUpperCase()}` })}`}
                      </Text>
                    </View>
                  </View>
                  <RideElevationChart waypoints={waypoints} system={system} isAnimated={false} />
                </View>
              </Animated.View>
            )}

            {/* Speed chart card */}
            {maxSpeedMps > 0 && waypoints.length >= 2 && (
              <Animated.View entering={FadeIn.duration(200)}>
                <View
                  style={{
                    borderRadius: 18,
                    borderCurve: 'continuous',
                    padding: 14,
                    paddingBottom: 12,
                    backgroundColor: tint(theme.ink, 0.03),
                    borderWidth: 1,
                    borderColor: tint(theme.ink, 0.04),
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'GeistMono-SemiBold',
                        fontSize: 10,
                        fontWeight: '600',
                        letterSpacing: 1.8,
                        textTransform: 'uppercase',
                        color: theme.warm,
                      }}
                    >
                      {t('rideDetail.speedChart')}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'GeistMono-SemiBold',
                        fontSize: 10,
                        fontWeight: '600',
                        letterSpacing: 0.8,
                        fontVariant: ['tabular-nums'],
                        color: theme.ink3,
                      }}
                    >
                      {formatSpeed(maxSpeedMps, system)}
                    </Text>
                  </View>
                  <RideSpeedChart waypoints={waypoints} system={system} isAnimated={false} />
                </View>
              </Animated.View>
            )}

            {/* Loading indicator for waypoints */}
            {waypointsLoading && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.warm} />
              </View>
            )}

            {/* Comments section */}
            {ride?.isPublic && <CommentList rideId={rideId} />}

            {/* Delete ride row */}
            {isOwnerViewer && (
              <Pressable
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete ride"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 48,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: tint('#d04a3c', 0.35),
                  backgroundColor: 'transparent',
                  marginTop: 4,
                }}
              >
                <Trash2 size={16} color="#d04a3c" />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#d04a3c',
                    letterSpacing: -0.07,
                  }}
                >
                  {t('rideDetail.deleteRide')}
                </Text>
              </Pressable>
            )}
          </BottomSheetScrollView>
        </BottomSheet>

        {/* Map Picker Sheet overlay */}
        {showMapPicker && (
          <MapPickerSheet
            currentStyle={mapStyle}
            onSelectStyle={handleMapStyleSelect}
            onClose={() => setShowMapPicker(false)}
          />
        )}

        {/* Share Activity Sheet */}
        {sharePayload && (
          <ShareActivitySheet
            visible={showShareSheet}
            payload={sharePayload}
            onClose={() => setShowShareSheet(false)}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}
