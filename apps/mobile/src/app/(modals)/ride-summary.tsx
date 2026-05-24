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
import { MetaAnalytics } from '../../lib/meta-analytics';
import { queryKeys } from '../../lib/query-keys';
import { maybeRequestReview } from '../../lib/store-review';
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
  const defaultRideName = useMemo(() => smartRideName(startedAtMs), [startedAtMs]);
  const [rideName, setRideName] = useState(defaultRideName);
  const [isSaving, setIsSaving] = useState(false);
  const [shareToDiscover, setShareToDiscover] = useState(false);
  const [showCelebration, setShowCelebration] = useState(distanceM > 0);
  const mapRef = useRef<MapboxGL.MapView>(null);

  // Auto-save state
  const [autoSaveCountdown, setAutoSaveCountdown] = useState(3);
  const [autoSaveStarted, setAutoSaveStarted] = useState(false);
  const [savedWithUndo, setSavedWithUndo] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(5);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFiredAutoSaveRef = useRef(false);

  // Refs for values used in timer callbacks
  const rideNameRef = useRef(rideName);
  rideNameRef.current = rideName;
  const shareToDiscoverRef = useRef(shareToDiscover);
  shareToDiscoverRef.current = shareToDiscover;

  // Track zero-distance shown
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once on mount — route params are stable
  useEffect(() => {
    if (distanceM === 0) {
      trackEvent(AnalyticsEvent.RIDE_ZERO_DISTANCE_SHOWN, { ride_id: rideId });
    }
  }, []);

  // Auto-dismiss celebration after 2.2 seconds (only for distance > 0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot timer on mount
  useEffect(() => {
    if (distanceM === 0) return;
    const timer = setTimeout(() => setShowCelebration(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  // Start auto-save countdown after celebration dismisses
  useEffect(() => {
    if (distanceM === 0) return;
    if (showCelebration) return;
    if (autoSaveStarted) return;
    setAutoSaveStarted(true);
  }, [showCelebration, distanceM, autoSaveStarted]);

  // Auto-save countdown timer
  // biome-ignore lint/correctness/useExhaustiveDependencies: timer uses refs for stability — intentional pattern from learnings
  useEffect(() => {
    if (!autoSaveStarted || hasFiredAutoSaveRef.current) return;

    autoSaveTimerRef.current = setInterval(() => {
      setAutoSaveCountdown((prev) => {
        if (prev <= 1) {
          if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
          if (!hasFiredAutoSaveRef.current) {
            hasFiredAutoSaveRef.current = true;
            performAutoSave();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [autoSaveStarted]);

  // Undo countdown timer
  useEffect(() => {
    if (!savedWithUndo) return;

    undoTimerRef.current = setInterval(() => {
      setUndoCountdown((prev) => {
        if (prev <= 1) {
          if (undoTimerRef.current) clearInterval(undoTimerRef.current);
          trackEvent(AnalyticsEvent.RIDE_AUTO_SAVED, { undo_tapped: false });
          // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
          router.replace('/(tabs)/(profile)' as any);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    };
  }, [savedWithUndo, router]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    };
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

  const performAutoSave = useCallback(async () => {
    setIsSaving(true);
    try {
      triggerNotification(Haptics.NotificationFeedbackType.Success);

      enqueueOrExecute('updateRide', {
        variables: {
          input: {
            rideId,
            name: rideNameRef.current || null,
          },
        },
      });

      clearRideData(rideId);

      // Invalidate rides cache so the list shows the new ride
      queryClient.invalidateQueries({ queryKey: queryKeys.rides.all });

      trackEvent(AnalyticsEvent.RIDE_COMPLETED, {
        ride_id: rideId,
        motorcycle_id: motorcycleId || null,
        distance_m: distanceM,
        duration_s: durationS,
        max_speed_kmh: Math.round(maxSpeedMps * 3.6),
        avg_speed_kmh: Math.round(avgSpeedMps * 3.6),
        shared_to_discover: shareToDiscoverRef.current,
      });
      MetaAnalytics.trackLogRide();
      maybeRequestReview();

      // Share to Discover (fire-and-forget, non-blocking)
      if (shareToDiscoverRef.current) {
        import('@motovault/graphql').then(({ ShareRideAsTripDocument }) => {
          import('../../lib/graphql-client').then(({ gqlFetcher: fetcher }) => {
            fetcher(ShareRideAsTripDocument, {
              input: { rideId, name: rideNameRef.current || undefined },
            }).catch((err: unknown) =>
              console.warn('[RideSummary] Share to Discover failed:', err),
            );
          });
        });
      }

      setIsSaving(false);
      setSavedWithUndo(true);
    } catch (error) {
      console.error('[RideSummary] Save error:', error);
      setIsSaving(false);
    }
  }, [rideId, distanceM, durationS, queryClient, motorcycleId, maxSpeedMps, avgSpeedMps]);

  const handleUndo = useCallback(() => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    trackEvent(AnalyticsEvent.RIDE_AUTO_SAVED, { undo_tapped: true });
    // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
    router.replace('/(tabs)/(profile)' as any);
  }, [router]);

  const handleDiscard = useCallback(() => {
    // Cancel auto-save if running
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    hasFiredAutoSaveRef.current = true;

    Alert.alert('Discard Ride?', 'This ride data will be permanently deleted.', [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          // Resume auto-save if it was interrupted
          hasFiredAutoSaveRef.current = false;
          setAutoSaveStarted(false);
          setAutoSaveCountdown(3);
          // Will re-trigger via useEffect
          setTimeout(() => setAutoSaveStarted(true), 0);
        },
      },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          trackEvent(AnalyticsEvent.RIDE_DISCARDED, {
            ride_id: rideId,
            distance_m: distanceM,
            duration_s: durationS,
            had_waypoints: routeData !== null,
          });
          clearRideData(rideId);
          // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
          router.replace('/(tabs)/(profile)' as any);
        },
      },
    ]);
  }, [rideId, router, distanceM, durationS, routeData]);

  const handleDiscardZeroDistance = useCallback(() => {
    trackEvent(AnalyticsEvent.RIDE_DISCARDED, {
      ride_id: rideId,
      distance_m: 0,
      duration_s: durationS,
      had_waypoints: routeData !== null,
    });
    clearRideData(rideId);
    // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
    router.replace('/(tabs)/(profile)' as any);
  }, [rideId, router, durationS, routeData]);

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

  // --- Zero-distance guidance screen ---
  if (distanceM === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.surfaceDark,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            borderCurve: 'continuous',
            backgroundColor: `${palette.signature500}20`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <Compass size={44} color={palette.signature500} />
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(150).duration(300)}
          style={{
            fontSize: 24,
            fontWeight: '800',
            color: palette.white,
            textAlign: 'center',
            letterSpacing: -0.5,
            marginBottom: 12,
          }}
        >
          No Distance Recorded
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(250).duration(300)}
          style={{
            fontSize: 15,
            color: palette.neutral400,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 40,
          }}
        >
          GPS needs a clear view of the sky. Make sure location permissions are enabled and try
          riding outdoors.
        </Animated.Text>

        <Animated.View
          entering={FadeIn.delay(400).duration(300)}
          style={{ width: '100%', gap: 12 }}
        >
          <Pressable
            onPress={() => {
              triggerImpact();
              // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
              router.replace('/(modals)/start-ride' as any);
            }}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={({ pressed }) => ({
              borderRadius: 20,
              borderCurve: 'continuous',
              overflow: 'hidden',
              opacity: pressed ? 0.85 : 1,
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
                Try Again
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={handleDiscardZeroDistance}
            accessibilityRole="button"
            accessibilityLabel="Discard ride"
            style={{ alignItems: 'center', paddingVertical: 14 }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.neutral500 }}>
              Discard
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // --- Normal ride summary (distance > 0) ---
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

      {/* Saved with undo overlay */}
      {savedWithUndo && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 200,
            backgroundColor: palette.surfaceDark,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
          }}
        >
          <Animated.View
            entering={ZoomIn.springify().damping(12)}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              borderCurve: 'continuous',
              backgroundColor: palette.success500,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={36} color={palette.white} strokeWidth={3} />
          </Animated.View>
          <Animated.Text
            entering={FadeInUp.delay(150).duration(300)}
            style={{
              fontSize: 22,
              fontWeight: '800',
              color: palette.white,
              letterSpacing: -0.3,
            }}
          >
            Ride saved ✓
          </Animated.Text>
          <Animated.View entering={FadeIn.delay(300).duration(300)}>
            <Pressable
              onPress={handleUndo}
              accessibilityRole="button"
              accessibilityLabel="Undo save"
              style={({ pressed }) => ({
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: pressed ? palette.surfaceHover : palette.surfaceElevated,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.neutral300 }}>
                Undo ({undoCountdown}s)
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
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
                onBlur={() => {
                  if (rideName !== defaultRideName) {
                    trackEvent(AnalyticsEvent.RIDE_NAME_EDITED, {
                      ride_id: rideId,
                      name_length: rideName.length,
                      is_default_name: false,
                    });
                  }
                }}
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
          </View>
        </Animated.View>
      </ScrollView>

      {/* Auto-save bar at bottom */}
      {autoSaveStarted && !savedWithUndo && !isSaving && (
        <Animated.View
          entering={SlideInUp.duration(300)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: insets.bottom + 12,
            paddingTop: 14,
            paddingHorizontal: 20,
            backgroundColor: palette.cardDark,
            borderTopWidth: 1,
            borderTopColor: palette.surfaceElevated,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.neutral300 }}>
            Auto-saving in {autoSaveCountdown}s...
          </Text>
          <Pressable
            onPress={handleDiscard}
            accessibilityRole="button"
            accessibilityLabel="Discard ride"
            hitSlop={12}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: palette.neutral500 }}>
              Discard
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Saving indicator bar */}
      {isSaving && !savedWithUndo && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: insets.bottom + 12,
            paddingTop: 14,
            paddingHorizontal: 20,
            backgroundColor: palette.cardDark,
            borderTopWidth: 1,
            borderTopColor: palette.surfaceElevated,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.neutral300 }}>
            Saving...
          </Text>
        </View>
      )}
    </View>
  );
}
