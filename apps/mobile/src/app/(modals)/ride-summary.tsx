import { palette } from '@motovault/design-system';
import MapboxGL from '@rnmapbox/maps';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Compass,
  Gauge,
  Map as MapIcon,
  Receipt,
  Route,
  Share2,
  Trash2,
  TrendingUp,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Share, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { queryKeys } from '../../lib/query-keys';
import { incrementRideCount, maybeRequestReview } from '../../lib/store-review';
import { useEditorialTheme } from '../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../utils/haptics';
import {
  cycleMapStyle as cycleMapStyleFn,
  getDefaultMapStyle,
  MAP_STYLES,
} from '../../utils/map-styles';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatSpeed,
} from '../../utils/ride-formatters';
import { clearRideData, getPointBuffer, getWaypointChunks } from '../../utils/ride-storage';
import { enqueueOrExecute } from '../../utils/ride-sync-queue';

/** Smart ride naming using time-of-day */
function smartRideName(startedAt: number): string {
  const date = new Date(startedAt);
  const hour = date.getHours();
  const dayName = date.toLocaleDateString(undefined, { weekday: 'long' });

  let timeOfDay: string;
  if (hour < 6) timeOfDay = 'Night';
  else if (hour < 12) timeOfDay = 'Morning';
  else if (hour < 17) timeOfDay = 'Afternoon';
  else if (hour < 21) timeOfDay = 'Evening';
  else timeOfDay = 'Night';

  return `${dayName} ${timeOfDay} Ride`;
}

export default function RideSummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const system = useMeasurementSystem();
  const params = useLocalSearchParams<{
    rideId: string;
    distanceM: string;
    durationS: string;
    maxSpeedMps: string;
    avgSpeedMps: string;
    elevationGain: string;
    elevationLoss: string;
    startedAt: string;
    motorcycleId: string;
  }>();

  const rideId = params.rideId ?? '';
  const distanceM = Number(params.distanceM) || 0;
  const durationS = Number(params.durationS) || 0;
  const maxSpeedMps = Number(params.maxSpeedMps) || 0;
  const avgSpeedMps = Number(params.avgSpeedMps) || 0;
  const elevationGain = Number(params.elevationGain) || 0;
  const elevationLoss = Number(params.elevationLoss) || 0;
  const startedAtMs = Number(params.startedAt) || Date.now();
  const motorcycleId = params.motorcycleId ?? '';

  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { isDark } = useEditorialTheme();
  const [mapStyle, setMapStyle] = useState(() => getDefaultMapStyle(isDark));
  const [rideName, setRideName] = useState(smartRideName(startedAtMs));
  const [isSaving, setIsSaving] = useState(false);
  const [shareToDiscover, setShareToDiscover] = useState(false);
  const [showCelebration, setShowCelebration] = useState(true);
  const mapRef = useRef<MapboxGL.MapView>(null);

  // Auto-dismiss celebration after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowCelebration(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  // Build route from stored waypoints
  const routeData = useMemo(() => {
    const chunks = getWaypointChunks(rideId);
    const allWaypoints = chunks.flat();
    const buffer = [...getPointBuffer()];
    const combined = [...allWaypoints, ...buffer];

    if (combined.length < 2) return null;

    const coordinates: [number, number][] = [];
    const speedValues: number[] = [];

    let minLng = combined[0].longitude;
    let maxLng = combined[0].longitude;
    let minLat = combined[0].latitude;
    let maxLat = combined[0].latitude;

    let cumulativeDistance = 0;
    const distances: number[] = [0];

    for (let i = 0; i < combined.length; i++) {
      const wp = combined[i];
      coordinates.push([wp.longitude, wp.latitude]);
      speedValues.push(wp.speedMps ?? 0);

      if (wp.longitude < minLng) minLng = wp.longitude;
      if (wp.longitude > maxLng) maxLng = wp.longitude;
      if (wp.latitude < minLat) minLat = wp.latitude;
      if (wp.latitude > maxLat) maxLat = wp.latitude;

      if (i > 0) {
        const prev = combined[i - 1];
        const segDist = Math.sqrt(
          (wp.longitude - prev.longitude) ** 2 + (wp.latitude - prev.latitude) ** 2,
        );
        cumulativeDistance += segDist;
        distances.push(cumulativeDistance);
      }
    }

    // Speed-gradient color stops (must be strictly ascending for Mapbox interpolate)
    const totalDist = cumulativeDistance || 1;
    const colorStops: [number, string][] = [];
    let lastPct = -1;
    for (let i = 0; i < combined.length; i++) {
      const pct = Math.round((distances[i] / totalDist) * 10000) / 10000; // 4 decimal precision
      if (pct <= lastPct) continue; // skip duplicate/non-ascending values
      const speedKmh = (speedValues[i] ?? 0) * 3.6;
      let color: string;
      if (speedKmh < 30) color = palette.speedSlow;
      else if (speedKmh < 80) color = palette.speedMedium;
      else color = palette.speedFast;
      colorStops.push([pct, color]);
      lastPct = pct;
    }
    // Ensure we have at least start and end stops
    if (colorStops.length === 0) {
      colorStops.push([0, palette.speedSlow], [1, palette.speedSlow]);
    } else {
      if (colorStops[0][0] !== 0) colorStops.unshift([0, colorStops[0][1]]);
      if (colorStops[colorStops.length - 1][0] !== 1)
        colorStops.push([1, colorStops[colorStops.length - 1][1]]);
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

    const bounds = {
      ne: [maxLng + 0.005, maxLat + 0.005] as [number, number],
      sw: [minLng - 0.005, minLat - 0.005] as [number, number],
    };

    const startPoint = coordinates[0];
    const endPoint = coordinates[coordinates.length - 1];

    return { geojson, bounds, colorStops, startPoint, endPoint };
  }, [rideId]);

  const handleShare = useCallback(async () => {
    triggerImpact();
    try {
      await Share.share({
        message: `Just completed a ${formatDistance(distanceM, system)} ride in ${formatDuration(durationS)} with MotoVault!`,
      });
      trackEvent(AnalyticsEvent.RIDE_SHARED, {
        distance_m: distanceM,
        duration_s: durationS,
      });
    } catch {
      // User cancelled
    }
  }, [distanceM, durationS, system]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      triggerNotification(Haptics.NotificationFeedbackType.Success);

      enqueueOrExecute('updateRide', {
        variables: {
          input: {
            rideId,
            name: rideName || null,
          },
        },
      });

      clearRideData(rideId);

      // Invalidate rides cache so the list shows the new ride
      queryClient.invalidateQueries({ queryKey: queryKeys.rides.all });

      trackEvent(AnalyticsEvent.RIDE_COMPLETED, {
        distance_m: distanceM,
        duration_s: durationS,
        shared_to_discover: shareToDiscover,
      });
      incrementRideCount();
      maybeRequestReview();

      // Share to Discover (fire-and-forget, non-blocking)
      if (shareToDiscover) {
        import('@motovault/graphql').then(({ ShareRideToDiscoverDocument }) => {
          import('../../lib/graphql-client').then(({ gqlFetcher: fetcher }) => {
            fetcher(ShareRideToDiscoverDocument, {
              input: { rideId, name: rideName || undefined },
            }).catch((err: unknown) =>
              console.warn('[RideSummary] Share to Discover failed:', err),
            );
          });
        });
      }

      // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
      router.replace('/(tabs)/(profile)' as any);
    } catch (error) {
      console.error('[RideSummary] Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [rideId, rideName, router, distanceM, durationS, shareToDiscover, queryClient]);

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard Ride?', 'This ride data will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          clearRideData(rideId);
          // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
          router.replace('/(tabs)/(profile)' as any);
        },
      },
    ]);
  }, [rideId, router]);

  const handleCycleMapStyle = useCallback(() => {
    setMapStyle((prev) => cycleMapStyleFn(prev));
  }, []);

  const stats = [
    { icon: Route, label: 'Distance', value: formatDistance(distanceM, system) },
    { icon: Clock, label: 'Moving Time', value: formatDuration(durationS) },
    { icon: TrendingUp, label: 'Avg Speed', value: formatSpeed(avgSpeedMps, system) },
    { icon: Gauge, label: 'Max Speed', value: formatSpeed(maxSpeedMps, system) },
    { icon: ArrowUp, label: 'Ascent', value: formatElevation(elevationGain, system) },
    { icon: ArrowDown, label: 'Descent', value: formatElevation(elevationLoss, system) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: palette.surfaceDark }}>
      {/* Celebration overlay */}
      {showCelebration && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            backgroundColor: palette.surfaceDark,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
          }}
        >
          <Animated.View
            entering={ZoomIn.springify().damping(12)}
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: palette.accent500,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={44} color={palette.white} strokeWidth={3} />
          </Animated.View>
          <Animated.Text
            entering={FadeInUp.delay(200).duration(300)}
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: palette.white,
              letterSpacing: -0.5,
            }}
          >
            Ride Complete!
          </Animated.Text>
          <Animated.View
            entering={FadeIn.delay(400).duration(300)}
            style={{ flexDirection: 'row', gap: 24 }}
          >
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '700',
                  color: palette.white,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatDistance(distanceM, system)}
              </Text>
              <Text style={{ fontSize: 13, color: palette.neutral400, marginTop: 2 }}>
                Distance
              </Text>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: palette.surfaceElevated }} />
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '700',
                  color: palette.white,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatDuration(durationS)}
              </Text>
              <Text style={{ fontSize: 13, color: palette.neutral400, marginTop: 2 }}>
                Duration
              </Text>
            </View>
          </Animated.View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Map */}
        <View style={{ height: 380, position: 'relative' }}>
          <MapboxGL.MapView
            ref={mapRef}
            style={{ flex: 1 }}
            styleURL={MAP_STYLES[mapStyle]}
            logoEnabled={false}
            attributionEnabled={false}
            scaleBarEnabled={false}
          >
            {routeData && (
              <>
                <MapboxGL.Camera
                  bounds={{
                    ne: routeData.bounds.ne,
                    sw: routeData.bounds.sw,
                    paddingTop: 60,
                    paddingBottom: 60,
                    paddingLeft: 40,
                    paddingRight: 40,
                  }}
                  animationDuration={1000}
                />

                <MapboxGL.ShapeSource id="route-source" shape={routeData.geojson} lineMetrics>
                  <MapboxGL.LineLayer
                    id="route-line"
                    style={{
                      lineWidth: 4,
                      lineCap: 'round',
                      lineJoin: 'round',
                      lineGradient: [
                        'interpolate',
                        ['linear'],
                        ['line-progress'],
                        ...routeData.colorStops.flat(),
                      ],
                    }}
                  />
                </MapboxGL.ShapeSource>

                {/* Start marker */}
                <MapboxGL.MarkerView id="start-marker" coordinate={routeData.startPoint}>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: palette.success500,
                      borderWidth: 3,
                      borderColor: palette.white,
                    }}
                  />
                </MapboxGL.MarkerView>

                {/* End marker */}
                <MapboxGL.MarkerView id="end-marker" coordinate={routeData.endPoint}>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: palette.signature500,
                      borderWidth: 3,
                      borderColor: palette.white,
                    }}
                  />
                </MapboxGL.MarkerView>
              </>
            )}
          </MapboxGL.MapView>

          {/* Bottom gradient fade into content */}
          <LinearGradient
            colors={['transparent', palette.surfaceDark]}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
            }}
          />

          {/* Map controls */}
          <View
            style={{
              position: 'absolute',
              top: insets.top + 12,
              right: 16,
              gap: 8,
            }}
          >
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
        </View>

        {/* Content */}
        <Animated.View
          entering={SlideInUp.delay(showCelebration ? 2200 : 200).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: -32 }}
        >
          <View
            style={{
              backgroundColor: palette.cardDark,
              borderRadius: 24,
              borderCurve: 'continuous',
              padding: 20,
              gap: 20,
              borderWidth: 1,
              borderColor: palette.surfaceElevated,
            }}
          >
            {/* Ride name */}
            <View>
              <TextInput
                value={rideName}
                onChangeText={setRideName}
                placeholder={t('rideSummary.namePlaceholder')}
                placeholderTextColor={palette.neutral600}
                maxLength={100}
                accessibilityLabel="Ride name"
                style={{
                  backgroundColor: palette.surfaceSubtle,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  padding: 14,
                  fontSize: 18,
                  fontWeight: '700',
                  color: palette.white,
                  borderWidth: 1,
                  borderColor: palette.surfaceElevated,
                }}
              />
            </View>

            {/* Stats grid — proper flexbox */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {stats.map(({ icon: Icon, label, value }) => (
                <View
                  key={label}
                  style={{
                    flexBasis: '47%',
                    flexGrow: 1,
                    backgroundColor: palette.surfaceSubtle,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    padding: 14,
                    gap: 6,
                    borderWidth: 1,
                    borderColor: palette.surfaceElevated,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} color={palette.neutral500} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: palette.neutral500 }}>
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
                </View>
              ))}
            </View>

            {/* Mileage applied indicator */}
            {distanceM > 0 && motorcycleId && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: palette.successBgDark,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Wrench size={16} color={palette.success500} />
                <Text style={{ fontSize: 13, color: palette.success500, flex: 1 }}>
                  {formatDistance(distanceM, system)} added to bike odometer
                </Text>
              </View>
            )}

            {/* Add Expense shortcut */}
            <Pressable
              onPress={() => {
                triggerImpact();
                router.push({
                  pathname: '/(modals)/add-ride-expense' as const,
                  params: { motorcycleId },
                });
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 14,
                backgroundColor: pressed ? palette.surfaceHover : palette.surfaceSubtle,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: palette.surfaceElevated,
              })}
            >
              <Receipt size={16} color={palette.neutral400} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.neutral400 }}>
                Add Expense (Fuel, Tolls...)
              </Text>
            </Pressable>

            {/* Action buttons */}
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={isSaving ? 'Saving ride' : 'Save ride'}
              style={({ pressed }) => ({
                borderRadius: 20,
                borderCurve: 'continuous',
                overflow: 'hidden',
                opacity: isSaving ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <LinearGradient
                colors={[palette.accent400, palette.accent500]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: '700', color: palette.white }}>
                  {isSaving ? 'Saving...' : 'Save Ride'}
                </Text>
              </LinearGradient>
            </Pressable>

            {/* Share to Discover toggle */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
                paddingHorizontal: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Compass size={18} color={palette.accent500} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: palette.white }}>
                    Share on Discover
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.neutral400 }}>
                    Other riders can find and ride this route
                  </Text>
                </View>
              </View>
              <Switch
                value={shareToDiscover}
                onValueChange={setShareToDiscover}
                trackColor={{ false: palette.neutral700, true: palette.accent500 }}
                thumbColor={palette.white}
              />
            </View>

            {/* Discard option */}
            <Pressable
              onPress={handleDiscard}
              accessibilityRole="button"
              accessibilityLabel="Discard ride"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 8,
              }}
            >
              <Trash2 size={14} color={palette.neutral500} />
              <Text style={{ fontSize: 14, color: palette.neutral500 }}>Discard Ride</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
