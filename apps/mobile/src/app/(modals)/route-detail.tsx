import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import {
  FuelStopsNearRouteDocument,
  RouteDetailDocument,
  SaveRouteDocument,
  UnsaveRouteDocument,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Award,
  Bookmark,
  CloudOff,
  Fuel,
  Map as MapIcon,
  Share2,
  User,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentList } from '../../components/comments/comment-list';
import { PremiumWaitlistModal } from '../../components/discover/premium-waitlist-modal';
import { ReviewForm } from '../../components/discover/review-form';
import { ReviewList } from '../../components/discover/review-list';
import { RideThisSheet, RideThisStickyCta } from '../../components/ride-this-sheet';
import { useGpxExport } from '../../hooks/use-gpx-export';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { usePrimaryBikeFuelData } from '../../hooks/use-primary-bike-fuel-data';
import { useRideThis } from '../../hooks/use-ride-this';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { fuelBadgeColor, fuelBadgeLabel } from '../../utils/fuel-range';
import { cycleMapStyle, getDefaultMapStyle, MAP_STYLES } from '../../utils/map-styles';
import { showMarkerActionSheet } from '../../utils/marker-action-sheet';
import { formatDistance, formatElevation } from '../../utils/ride-formatters';

/** Decode Google-encoded polyline string to [lng, lat] for Mapbox */
function decodePolylineToCoords(encoded: string): [number, number][] {
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

    points.push([lng / 1e5, lat / 1e5]); // Mapbox uses [lng, lat]
  }
  return points;
}

export default function RouteDetailScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const system = useMeasurementSystem();
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const sheetRef = useRef<BottomSheet>(null);
  const [mapStyle, setMapStyle] = useState(() => getDefaultMapStyle(isDark));
  const [isSaved, setIsSaved] = useState(false);
  const [showFuelStops, setShowFuelStops] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const reducedMotion = useReducedMotion();
  const saveScale = useSharedValue(1);
  const saveAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        await gqlFetcher(UnsaveRouteDocument, { routeId });
      } else {
        await gqlFetcher(SaveRouteDocument, { routeId });
      }
    },
    onSuccess: () => {
      trackEvent(isSaved ? AnalyticsEvent.ROUTE_UNSAVED : AnalyticsEvent.ROUTE_SAVED, {
        route_id: routeId,
      });
      setIsSaved((prev) => !prev);
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!reducedMotion) {
        saveScale.value = withSequence(
          withTiming(1.3, { duration: 120 }),
          withTiming(1, { duration: 200 }),
        );
      }
    },
  });

  const bg = isDark ? palette.neutral950 : palette.white;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const sheetBg = isDark ? palette.cardDark : palette.white;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.routes.detail(routeId),
    queryFn: () => gqlFetcher(RouteDetailDocument, { routeId }),
    enabled: !!routeId,
  });

  const route = data?.routeDetail;

  const { bikeId: primaryBikeId } = usePrimaryBikeFuelData();

  const { data: fuelData } = useQuery({
    queryKey: queryKeys.fuelStops.nearRoute(routeId, primaryBikeId),
    queryFn: () => gqlFetcher(FuelStopsNearRouteDocument, { routeId, bikeId: primaryBikeId }),
    enabled: !!routeId && primaryBikeId !== undefined,
    staleTime: 5 * 60 * 1000,
  });

  const routeLoaded = route?.id;
  useEffect(() => {
    if (route && routeLoaded) {
      trackEvent(AnalyticsEvent.ROUTE_VIEWED, {
        route_id: routeId,
        is_motovault_pick: route.isMotovaultPick ?? false,
      });
    }
  }, [routeLoaded, routeId, route]);

  const coordinates = useMemo(() => {
    if (!route?.polyline) return [];
    return decodePolylineToCoords(route.polyline);
  }, [route?.polyline]);

  const bounds = useMemo(() => {
    if (coordinates.length === 0) return undefined;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of coordinates) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    return {
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
    };
  }, [coordinates]);

  const routeGeoJSON = useMemo(() => {
    if (coordinates.length === 0) return null;
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates },
      properties: {},
    };
  }, [coordinates]);

  const fuelStops = fuelData?.fuelStopsNearRoute.fuelStops;

  const fuelStopsGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: (fuelStops ?? []).map((stop) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [stop.lng, stop.lat] },
        properties: { name: stop.name, osmId: stop.osmId },
      })),
    }),
    [fuelStops],
  );

  const handleCycleMapStyle = useCallback(() => {
    setMapStyle((prev) => cycleMapStyle(prev));
  }, []);

  const { exportAndShare: exportGpx, isExporting: gpxExporting } = useGpxExport();

  const navWaypoints = useMemo(() => {
    if (coordinates.length === 0) return [];
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    return [
      { lat: first[1], lng: first[0], name: 'Start' },
      { lat: last[1], lng: last[0], name: 'End' },
    ];
  }, [coordinates]);

  const rideThis = useRideThis({
    surface: 'route',
    entityId: routeId,
    waypoints: navWaypoints,
    onGpxExport: useCallback(async () => {
      await exportGpx(routeId, route?.name ?? undefined);
    }, [exportGpx, routeId, route?.name]),
  });

  const handleShare = useCallback(async () => {
    if (!route) return;
    await Share.share({
      message: `Check out this route on MotoVault: ${route.name ?? 'A great ride'}`,
      url: `https://motovault.app/routes/${routeId}`,
    });
    trackEvent(AnalyticsEvent.ROUTE_SHARED, { route_id: routeId });
  }, [route, routeId]);

  const surfaceLabel =
    route?.surfaceType === 'paved'
      ? 'Paved'
      : route?.surfaceType === 'mixed'
        ? 'Mixed'
        : route?.surfaceType === 'off-road'
          ? 'Off-road'
          : null;

  if (isLoading || !route) {
    return (
      <View
        style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={palette.accent500} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        {/* Map */}
        <MapboxGL.MapView
          style={{ flex: 1 }}
          styleURL={MAP_STYLES[mapStyle]}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
        >
          {bounds && (
            <MapboxGL.Camera
              bounds={{
                ...bounds,
                paddingBottom: 200,
                paddingTop: 60,
                paddingLeft: 40,
                paddingRight: 40,
              }}
              animationMode="flyTo"
              animationDuration={500}
            />
          )}
          {routeGeoJSON && (
            <MapboxGL.ShapeSource id="route-line" shape={routeGeoJSON}>
              <MapboxGL.LineLayer
                id="route-line-layer"
                style={{
                  lineColor: palette.accent500,
                  lineWidth: 4,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </MapboxGL.ShapeSource>
          )}
          {/* Start point */}
          {coordinates.length > 0 && (
            <MapboxGL.MarkerView id="start" coordinate={coordinates[0]}>
              <Pressable
                onPress={() =>
                  showMarkerActionSheet({
                    title: 'Start',
                    lat: coordinates[0][1],
                    lng: coordinates[0][0],
                  })
                }
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: palette.success500,
                  borderWidth: 2,
                  borderColor: palette.white,
                }}
              />
            </MapboxGL.MarkerView>
          )}
          {/* End point */}
          {coordinates.length > 1 && (
            <MapboxGL.MarkerView id="end" coordinate={coordinates[coordinates.length - 1]}>
              <Pressable
                onPress={() =>
                  showMarkerActionSheet({
                    title: 'Finish',
                    lat: coordinates[coordinates.length - 1][1],
                    lng: coordinates[coordinates.length - 1][0],
                  })
                }
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: palette.accent500,
                  borderWidth: 2,
                  borderColor: palette.white,
                }}
              />
            </MapboxGL.MarkerView>
          )}
          {/* Fuel station markers — ShapeSource for GPU rendering */}
          <MapboxGL.ShapeSource
            id="fuel-stops-source"
            shape={fuelStopsGeoJSON}
            cluster={true}
            clusterRadius={40}
          >
            <MapboxGL.CircleLayer
              id="fuel-cluster-circle"
              filter={['has', 'point_count']}
              style={{
                visibility: showFuelStops ? 'visible' : 'none',
                circleRadius: ['step', ['get', 'point_count'], 16, 10, 22],
                circleColor: palette.warning500,
                circleOpacity: 0.85,
                circleStrokeColor: palette.white,
                circleStrokeWidth: 1.5,
              }}
            />
            <MapboxGL.SymbolLayer
              id="fuel-cluster-count"
              filter={['has', 'point_count']}
              style={{
                visibility: showFuelStops ? 'visible' : 'none',
                textField: ['get', 'point_count_abbreviated'],
                textSize: 12,
                textColor: palette.white,
              }}
            />
            <MapboxGL.CircleLayer
              id="fuel-stop-dot"
              filter={['!', ['has', 'point_count']]}
              style={{
                visibility: showFuelStops ? 'visible' : 'none',
                circleRadius: 6,
                circleColor: palette.warning500,
                circleStrokeColor: palette.white,
                circleStrokeWidth: 1.5,
              }}
            />
          </MapboxGL.ShapeSource>
        </MapboxGL.MapView>

        {/* Floating controls */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 12,
            flexDirection: 'row',
            gap: 8,
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

        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 12,
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <Pressable
            onPress={() => saveMutation.mutate()}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Unsave route' : 'Save route'}
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
            <Animated.View style={saveAnimatedStyle}>
              <Bookmark
                size={18}
                color={isSaved ? palette.accent500 : palette.white}
                fill={isSaved ? palette.accent500 : 'transparent'}
              />
            </Animated.View>
          </Pressable>
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
          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share route"
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

        {/* Bottom sheet */}
        <BottomSheet
          ref={sheetRef}
          snapPoints={['35%', '60%', '90%']}
          index={0}
          backgroundStyle={{
            backgroundColor: sheetBg,
            borderRadius: 24,
            borderCurve: 'continuous',
          }}
          handleIndicatorStyle={{
            backgroundColor: isDark ? palette.neutral600 : palette.neutral300,
          }}
        >
          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          >
            {/* MotoVault Pick badge */}
            {route.isMotovaultPick && (
              <Animated.View
                entering={reducedMotion ? undefined : FadeIn.duration(300)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: isDark ? palette.neutral900 : palette.neutral100,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  alignSelf: 'flex-start',
                  marginBottom: 10,
                }}
              >
                <Award size={14} color={palette.signature500} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: palette.signature500,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Editor's Pick
                </Text>
              </Animated.View>
            )}

            {/* Route name */}
            <Text style={{ fontSize: 22, fontWeight: '700', color: titleColor, marginBottom: 4 }}>
              {route.name ?? 'Unnamed Route'}
            </Text>

            {/* Contributor */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <User size={14} color={subtitleColor} />
              <Text style={{ fontSize: 13, color: subtitleColor }}>
                by {route.contributor.displayName}
              </Text>
            </View>

            {/* Stats grid */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <StatBadge
                label="Distance"
                value={formatDistance(route.distanceM, system)}
                isDark={isDark}
              />
              {(route.elevationGainM ?? 0) > 0 && (
                <StatBadge
                  label="Elevation"
                  value={formatElevation(route.elevationGainM ?? 0, system)}
                  isDark={isDark}
                />
              )}
              {surfaceLabel && <StatBadge label="Surface" value={surfaceLabel} isDark={isDark} />}
              {route.ratingAvg != null && route.ratingCount > 0 && (
                <StatBadge
                  label="Rating"
                  value={`${route.ratingAvg.toFixed(1)} (${route.ratingCount})`}
                  isDark={isDark}
                />
              )}
              {fuelData?.fuelStopsNearRoute.rangeSummary && (
                <Pressable
                  onPress={() => {
                    setShowFuelStops((prev) => !prev);
                    if (process.env.EXPO_OS === 'ios')
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Fuel range: ${fuelData.fuelStopsNearRoute.rangeSummary.summary}. Double tap to ${showFuelStops ? 'hide' : 'show'} fuel stations.`}
                >
                  <View
                    style={{
                      backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderCurve: 'continuous',
                      borderWidth: showFuelStops ? 1.5 : 0,
                      borderColor: showFuelStops
                        ? fuelBadgeColor(fuelData.fuelStopsNearRoute.rangeSummary.stopsRequired)
                        : 'transparent',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Fuel
                        size={11}
                        color={fuelBadgeColor(
                          fuelData.fuelStopsNearRoute.rangeSummary.stopsRequired,
                        )}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          color: isDark ? palette.neutral500 : palette.neutral400,
                        }}
                      >
                        Fuel Range
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: fuelBadgeColor(
                          fuelData.fuelStopsNearRoute.rangeSummary.stopsRequired,
                        ),
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {fuelBadgeLabel(fuelData.fuelStopsNearRoute.rangeSummary.stopsRequired)}
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>

            {/* Description / editorial */}
            {(route.editorialDescription ?? route.description) && (
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: isDark ? palette.neutral300 : palette.neutral600,
                  marginBottom: 16,
                }}
              >
                {route.editorialDescription ?? route.description}
              </Text>
            )}

            {/* Secondary action — offline placeholder (premium waitlist).
                Primary "Ride this" CTA lives outside the sheet as a sticky bar. */}
            <Pressable
              onPress={() => setShowWaitlist(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 12,
                borderRadius: 12,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: palette.accent500,
                marginBottom: 20,
              }}
            >
              <CloudOff size={16} color={palette.accent500} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accent500 }}>
                Offline
              </Text>
            </Pressable>

            {/* Reviews */}
            <ReviewList routeId={routeId} />

            {/* Review form */}
            {showReviewForm ? (
              <ReviewForm routeId={routeId} onSuccess={() => setShowReviewForm(false)} />
            ) : (
              <Pressable
                onPress={() => setShowReviewForm(true)}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: palette.accent500,
                  alignItems: 'center',
                  marginVertical: 12,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accent500 }}>
                  Leave a Review
                </Text>
              </Pressable>
            )}

            {/* Comments */}
            <CommentList routeId={routeId} />

            {/* Premium waitlist modal */}
            <PremiumWaitlistModal visible={showWaitlist} onClose={() => setShowWaitlist(false)} />
          </BottomSheetScrollView>
        </BottomSheet>

        {/* Sticky primary CTA — one unambiguous action per screen. */}
        {navWaypoints.length >= 2 && <RideThisStickyCta onPress={rideThis.open} />}

        <RideThisSheet
          visible={rideThis.visible}
          onClose={rideThis.close}
          providers={rideThis.providers}
          activeSegment={rideThis.activeSegment}
          onProvider={rideThis.triggerProvider}
          onAdvance={rideThis.advanceSegment}
          gpxExporting={gpxExporting}
        />
      </View>
    </GestureHandlerRootView>
  );
}

function StatBadge({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View
      style={{
        backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderCurve: 'continuous',
      }}
    >
      <Text style={{ fontSize: 11, color: isDark ? palette.neutral500 : palette.neutral400 }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '700',
          color: isDark ? palette.white : palette.neutral950,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
