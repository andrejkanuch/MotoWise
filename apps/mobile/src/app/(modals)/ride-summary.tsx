import { palette } from '@motovault/design-system';
import { RideOverviewDocument, type RideOverviewQuery } from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Layers,
  Pencil,
  Receipt,
  Route,
  Share2,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react-native';
// NOTE: palette is kept only for speed-gradient colors (speedSlow/Medium/Fast)
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Share, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { MetaAnalytics } from '../../lib/meta-analytics';
import { queryKeys } from '../../lib/query-keys';
import { maybeRequestReview } from '../../lib/store-review';
import { tint, useEditorialTheme } from '../../theme/editorial';
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

const RECORD_LABELS: Record<string, string> = {
  longest_distance: 'Longest ride ever',
  longest_duration: 'Longest duration ever',
  top_speed: 'New top speed',
  max_elevation_gain: 'Most elevation ever',
  longest_streak: 'Longest streak ever',
};

const MAP_HEIGHT = 260;
const SHEET_RADIUS = 28;

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
  const { t: theme, isDark } = useEditorialTheme();
  const [mapStyle, setMapStyle] = useState(() => getDefaultMapStyle(isDark));
  const defaultRideName = useMemo(() => smartRideName(startedAtMs), [startedAtMs]);
  const [rideName, setRideName] = useState(defaultRideName);
  const [isSaving, setIsSaving] = useState(false);
  const [shareToDiscover, setShareToDiscover] = useState(false);
  const [pbDismissed, setPbDismissed] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);

  // Fetch bike name from cache
  const bikeName = useMemo(() => {
    if (!motorcycleId) return null;
    // Try to read from existing query cache
    const cachedData = queryClient.getQueryData<{
      myMotorcycles?: Array<{ id: string; nickname?: string | null; make: string; model: string }>;
    }>(queryKeys.motorcycles.lists());
    const bike = cachedData?.myMotorcycles?.find((m) => m.id === motorcycleId);
    if (!bike) return null;
    return bike.nickname || `${bike.make} ${bike.model}`;
  }, [motorcycleId, queryClient]);

  // Fetch PB data
  const { data: overviewData } = useQuery<RideOverviewQuery>({
    queryKey: queryKeys.rides.overview,
    queryFn: () => gqlFetcher(RideOverviewDocument),
    staleTime: 0,
  });

  const newRecords = useMemo(
    () =>
      (overviewData?.rideOverview?.personalRecords ?? []).filter(
        (r) => r.rideId === rideId && r.previousValue != null,
      ),
    [overviewData?.rideOverview?.personalRecords, rideId],
  );

  const pbRecord = newRecords.length > 0 && !pbDismissed ? newRecords[0] : null;
  const pbDelta = pbRecord?.previousValue
    ? Math.round(((pbRecord.value - pbRecord.previousValue) / pbRecord.previousValue) * 100)
    : null;

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

    // Speed-gradient color stops — downsample to max ~200 entries
    const totalDist = cumulativeDistance || 1;
    const rawStops: [number, string][] = [];
    let lastPct = -1;
    for (let i = 0; i < combined.length; i++) {
      const pct = Math.round((distances[i] / totalDist) * 10000) / 10000;
      if (pct <= lastPct) continue;
      const speedKmh = (speedValues[i] ?? 0) * 3.6;
      let color: string;
      if (speedKmh < 30) color = palette.speedSlow;
      else if (speedKmh < 80) color = palette.speedMedium;
      else color = palette.speedFast;
      rawStops.push([pct, color]);
      lastPct = pct;
    }

    // Downsample if too many stops
    let colorStops = rawStops;
    if (rawStops.length > 200) {
      const step = Math.ceil(rawStops.length / 200);
      colorStops = rawStops.filter(
        (_, i) => i === 0 || i === rawStops.length - 1 || i % step === 0,
      );
    }

    if (colorStops.length === 0) {
      colorStops = [
        [0, palette.speedSlow],
        [1, palette.speedSlow],
      ];
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
        ride_id: rideId,
        motorcycle_id: motorcycleId || null,
        distance_m: distanceM,
        duration_s: durationS,
        max_speed_kmh: Math.round(maxSpeedMps * 3.6),
        avg_speed_kmh: Math.round(avgSpeedMps * 3.6),
        shared_to_discover: shareToDiscover,
      });
      MetaAnalytics.trackLogRide();
      maybeRequestReview();

      // Share to Discover (fire-and-forget, non-blocking)
      if (shareToDiscover) {
        import('@motovault/graphql').then(({ ShareRideAsTripDocument }) => {
          import('../../lib/graphql-client').then(({ gqlFetcher: fetcher }) => {
            fetcher(ShareRideAsTripDocument, {
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
  }, [
    rideId,
    rideName,
    router,
    distanceM,
    durationS,
    shareToDiscover,
    queryClient,
    motorcycleId,
    maxSpeedMps,
    avgSpeedMps,
  ]);

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
    { icon: Route, label: 'DISTANCE', value: formatDistance(distanceM, system), copper: true },
    { icon: Clock, label: 'MOVING TIME', value: formatDuration(durationS) },
    { icon: TrendingUp, label: 'AVG SPEED', value: formatSpeed(avgSpeedMps, system) },
    { icon: Gauge, label: 'MAX SPEED', value: formatSpeed(maxSpeedMps, system), priv: true },
    { icon: ArrowUp, label: 'ASCENT', value: formatElevation(elevationGain, system) },
    { icon: ArrowDown, label: 'DESCENT', value: formatElevation(elevationLoss, system) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ===== Map band (top) ===== */}
      <View style={{ height: MAP_HEIGHT, position: 'relative' }}>
        <MapboxGL.MapView
          ref={mapRef}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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
                animationDuration={0}
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
                    backgroundColor: theme.success,
                    borderWidth: 3,
                    borderColor: theme.ink,
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
                    backgroundColor: theme.warm,
                    borderWidth: 3,
                    borderColor: theme.ink,
                  }}
                />
              </MapboxGL.MarkerView>
            </>
          )}
        </MapboxGL.MapView>

        {/* Vignette overlay fading to sheet bg */}
        <LinearGradient
          colors={['transparent', 'transparent', tint(theme.bg, 0.18), theme.bg]}
          locations={[0, 0.55, 0.85, 1]}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: MAP_HEIGHT,
            pointerEvents: 'none',
          }}
        />

        {/* Map action buttons — glass morphism pills */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 10,
            right: 18,
            gap: 10,
          }}
        >
          <Pressable
            onPress={handleCycleMapStyle}
            accessibilityRole="button"
            accessibilityLabel="Change map style"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(30,28,25,0.78)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 14,
            }}
          >
            <Layers size={18} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share ride"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(30,28,25,0.78)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 14,
            }}
          >
            <Share2 size={16} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>
      </View>

      {/* ===== Bottom Sheet ===== */}
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          borderTopLeftRadius: SHEET_RADIUS,
          borderTopRightRadius: SHEET_RADIUS,
          borderCurve: 'continuous',
          marginTop: -SHEET_RADIUS,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.2,
          shadowRadius: 30,
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 99,
              backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(22,20,18,0.18)',
            }}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: insets.bottom + 38,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {/* Name meta row */}
          <Animated.View entering={FadeIn.delay(100).duration(250)}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: '#2bb673',
                }}
              />
              <Text
                style={{
                  fontFamily: 'GeistMono',
                  fontSize: 9.5,
                  fontWeight: '500',
                  letterSpacing: 1.9,
                  textTransform: 'uppercase',
                  color: theme.ink3,
                }}
              >
                Ride saved · just now{bikeName ? ` · ${bikeName}` : ''}
              </Text>
            </View>

            {/* Ride name — editable */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 4,
                marginTop: 4,
              }}
            >
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
                placeholderTextColor={theme.ink4}
                maxLength={100}
                accessibilityLabel="Ride name"
                style={{
                  flex: 1,
                  fontSize: 22,
                  fontWeight: '600',
                  letterSpacing: -0.44,
                  color: theme.ink,
                  lineHeight: 26,
                  padding: 0,
                }}
              />
              <Pencil size={16} color={theme.ink3} />
            </View>
          </Animated.View>

          {/* PB banner */}
          {pbRecord && (
            <Animated.View entering={FadeInUp.delay(200).duration(300)}>
              <LinearGradient
                colors={isDark ? ['#211c17', '#1c1916'] : ['#fbf3e7', '#f7eddd']}
                style={{
                  borderRadius: 18,
                  borderCurve: 'continuous',
                  padding: 12,
                  paddingRight: 14,
                  paddingBottom: 13,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(200,119,44,0.22)' : 'rgba(200,119,44,0.28)',
                  overflow: 'hidden',
                }}
              >
                {/* Radial glow overlay (approx with linear) */}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                >
                  <LinearGradient
                    colors={[tint('#c8772c', 0.16), tint('#c8772c', 0.04), 'transparent']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 0.75, y: 0.5 }}
                    style={{ flex: 1 }}
                  />
                </View>

                {/* Trophy icon box */}
                <LinearGradient
                  colors={[tint('#c8772c', 0.22), tint('#c8772c', 0.08)]}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                    borderWidth: 1,
                    borderColor: 'rgba(200,119,44,0.25)',
                  }}
                >
                  <Trophy size={20} color="#e89d5a" />
                </LinearGradient>

                {/* PB body */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={{
                        fontFamily: 'GeistMono',
                        fontSize: 9,
                        fontWeight: '600',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        color: '#e89d5a',
                      }}
                    >
                      Personal best
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 1.5,
                        borderRadius: 99,
                        borderWidth: 1,
                        borderColor: 'rgba(200,119,44,0.4)',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'GeistMono',
                          fontSize: 8,
                          fontWeight: '600',
                          letterSpacing: 1.2,
                          textTransform: 'uppercase',
                          color: '#e89d5a',
                        }}
                      >
                        PB
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: '600',
                      letterSpacing: -0.17,
                      color: theme.ink,
                      marginTop: 3,
                      lineHeight: 17.4,
                    }}
                  >
                    {RECORD_LABELS[pbRecord.recordType] ?? 'New personal best'}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: theme.ink2,
                      marginTop: 2,
                      fontVariant: ['tabular-nums'],
                      lineHeight: 15,
                    }}
                  >
                    {formatDistance(distanceM, system)}
                    {pbDelta != null && pbDelta > 0 ? ` · +${pbDelta}% on previous best` : ''}
                  </Text>
                </View>

                {/* Dismiss X */}
                <Pressable
                  onPress={() => setPbDismissed(true)}
                  hitSlop={12}
                  style={{ opacity: 0.6 }}
                >
                  <X size={14} color={theme.ink3} />
                </Pressable>
              </LinearGradient>
            </Animated.View>
          )}

          {/* 2x3 stat grid */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(300)}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
          >
            {stats.map(({ icon: Icon, label, value, copper, priv }, index) => (
              <Animated.View
                key={label}
                entering={FadeInUp.delay(300 + index * 50).duration(250)}
                style={{
                  flexBasis: '47%',
                  flexGrow: 1,
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  padding: 12,
                  paddingHorizontal: 14,
                  paddingBottom: 14,
                  minHeight: 78,
                  borderWidth: 1,
                  borderColor: theme.line,
                }}
              >
                {/* Private pill for max speed */}
                {priv && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      backgroundColor: theme.line,
                      borderRadius: 99,
                      paddingHorizontal: 5,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'GeistMono',
                        fontSize: 7,
                        fontWeight: '600',
                        letterSpacing: 1.1,
                        textTransform: 'uppercase',
                        color: theme.ink3,
                      }}
                    >
                      Private
                    </Text>
                  </View>
                )}

                {/* Icon */}
                <View style={{ marginBottom: 6 }}>
                  <Icon size={18} color={copper ? theme.warm : theme.ink3} />
                </View>

                {/* Label */}
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 9,
                    fontWeight: '500',
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    color: theme.ink3,
                  }}
                >
                  {label}
                </Text>

                {/* Value */}
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '600',
                    letterSpacing: -0.48,
                    color: theme.ink,
                    fontVariant: ['tabular-nums'],
                    lineHeight: 22,
                    marginTop: 4,
                  }}
                >
                  {value}
                </Text>
              </Animated.View>
            ))}
          </Animated.View>

          {/* Add expense row — dashed border */}
          <Animated.View entering={FadeInUp.delay(600).duration(250)}>
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
                gap: 10,
                height: 46,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(22,20,18,0.10)',
                backgroundColor: 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Receipt size={16} color={theme.ink3} />
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '500',
                  letterSpacing: -0.07,
                  color: theme.ink2,
                }}
              >
                Add expense <Text style={{ color: theme.ink3 }}>(fuel, tolls...)</Text>
              </Text>
            </Pressable>
          </Animated.View>

          {/* Save ride CTA — emerald gradient, pill shape */}
          <Animated.View entering={FadeInUp.delay(650).duration(250)}>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={isSaving ? 'Saving ride' : 'Save ride'}
              style={({ pressed }) => ({
                borderRadius: 999,
                borderCurve: 'continuous',
                overflow: 'hidden',
                opacity: isSaving ? 0.5 : pressed ? 0.85 : 1,
                shadowColor: 'rgba(43,182,115,0.45)',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 1,
                shadowRadius: 22,
              })}
            >
              <LinearGradient
                colors={['#34c77a', '#2bb673']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  height: 54,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                {/* Check circle */}
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={11} color="#2bb673" strokeWidth={2.5} />
                </View>
                <Text
                  style={{
                    fontSize: 16.5,
                    fontWeight: '700',
                    letterSpacing: -0.2,
                    color: '#052b1a',
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save ride'}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Share on Discover row */}
          <Animated.View
            entering={FadeInUp.delay(700).duration(250)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 4,
              paddingTop: 4,
            }}
          >
            {/* Compass icon box */}
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Compass size={16} color={theme.ink3} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '600',
                  letterSpacing: -0.14,
                  color: theme.ink,
                  lineHeight: 16.2,
                }}
              >
                Share on Discover
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  color: theme.ink3,
                  marginTop: 1,
                  letterSpacing: -0.035,
                }}
              >
                Other riders can find and ride this route
              </Text>
            </View>

            <Switch
              value={shareToDiscover}
              onValueChange={setShareToDiscover}
              trackColor={{ false: theme.line2, true: theme.success }}
              thumbColor="#fff"
            />
          </Animated.View>

          {/* Discard option — subtle, at the bottom */}
          <Animated.View
            entering={FadeIn.delay(800).duration(250)}
            style={{ alignItems: 'center', paddingTop: 8 }}
          >
            <Pressable
              onPress={handleDiscard}
              accessibilityRole="button"
              accessibilityLabel="Discard ride"
              hitSlop={8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 8,
              }}
            >
              <Text style={{ fontSize: 13, color: theme.ink3 }}>Discard ride</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    </View>
  );
}
