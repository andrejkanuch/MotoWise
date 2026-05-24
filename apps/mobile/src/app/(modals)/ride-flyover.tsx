import { palette } from '@motovault/design-system';
import {
  GetRideDocument,
  type GetRideQuery,
  GetRideWaypointsDocument,
  type GetRideWaypointsQuery,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useEditorialTheme } from '../../theme/editorial';
import { MAP_STYLES } from '../../utils/map-styles';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDistanceValue,
  formatElevationValue,
  formatSpeedValue,
  speedUnitLabel,
} from '../../utils/ride-formatters';

// ─── Helpers ────────────────────────────────────────────────────────────────

function bearingTo(
  from: { longitude: number; latitude: number },
  to: { longitude: number; latitude: number },
): number {
  const [lon1, lat1] = [from.longitude, from.latitude].map((d) => (d * Math.PI) / 180);
  const [lon2, lat2] = [to.longitude, to.latitude].map((d) => (d * Math.PI) / 180);
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Format seconds as MM:SS */
function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Decode Google-encoded polyline to [lat, lng] pairs */
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

// ─── Constants ──────────────────────────────────────────────────────────────

const TOTAL_DURATION_MS = 45_000; // 45 seconds at 1x speed
const SPEED_OPTIONS = [1, 2, 4] as const;

const GLASS_BG = 'rgba(30,28,25,0.72)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function RideFlyoverScreen() {
  const { t: theme } = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const system = useMeasurementSystem();

  const cameraRef = useRef<MapboxGL.Camera>(null);
  const lastCameraTickRef = useRef(0);
  const scrubberWidthRef = useRef(0);

  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeSpeed, setActiveSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(4);

  const progress = useSharedValue(0);
  const playing = useSharedValue(true);
  const speedMultiplier = useSharedValue(4);

  // ─── Data fetching ──────────────────────────────────────────────────────

  // Read ride data from existing cache (ride-detail stores it as { viewer, ride })
  const { data: rideBundle } = useQuery({
    queryKey: queryKeys.rides.detail(rideId ?? ''),
    queryFn: async () => {
      if (!rideId) throw new Error('Missing rideId');
      const r = await gqlFetcher(GetRideDocument, { id: rideId });
      return { viewer: 'owner' as const, ride: r.ride };
    },
    enabled: !!rideId,
  });

  const { data: waypointData, isLoading: waypointsLoading } = useQuery({
    queryKey: queryKeys.rides.waypoints(rideId ?? ''),
    queryFn: () => {
      if (!rideId) throw new Error('Missing rideId');
      return gqlFetcher(GetRideWaypointsDocument, { rideId, maxPoints: 400 });
    },
    enabled: !!rideId,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const ride = (rideBundle as { viewer: string; ride: GetRideQuery['ride'] } | undefined)?.ride;
  const serverWaypoints =
    (waypointData as GetRideWaypointsQuery | undefined)?.rideWaypoints ?? [];

  // Fall back to decoding route polyline when server waypoints are empty
  const waypoints = useMemo(() => {
    if (serverWaypoints.length >= 2) return serverWaypoints;
    if (!ride?.routePolyline) return [];
    try {
      const decoded = decodePolyline(ride.routePolyline);
      if (decoded.length < 2) return [];
      // Distribute ride duration evenly across decoded points for stat overlay
      const totalDurationS = ride.durationS ?? 0;
      const totalDistanceM = ride.distanceM ?? 0;
      return decoded.map(([lat, lng], i) => ({
        recordedAt: '',
        latitude: lat,
        longitude: lng,
        altitude: null as number | null,
        speedMps: totalDistanceM > 0 && totalDurationS > 0
          ? totalDistanceM / totalDurationS
          : 0,
      }));
    } catch {
      return [];
    }
  }, [serverWaypoints, ride?.routePolyline, ride?.durationS, ride?.distanceM]);

  // ─── Route GeoJSON ────────────────────────────────────────────────────

  const routeGeoJSON = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (waypoints.length < 2) return null;
    const coordinates: [number, number][] = waypoints.map((wp) => [wp.longitude, wp.latitude]);
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        },
      ],
    };
  }, [waypoints]);

  const startPoint = useMemo<[number, number] | null>(
    () => (waypoints.length > 0 ? [waypoints[0].longitude, waypoints[0].latitude] : null),
    [waypoints],
  );

  const endPoint = useMemo<[number, number] | null>(
    () =>
      waypoints.length > 1
        ? [waypoints[waypoints.length - 1].longitude, waypoints[waypoints.length - 1].latitude]
        : null,
    [waypoints],
  );

  // ─── Analytics ────────────────────────────────────────────────────────

  const trackedStartRef = useRef(false);
  useEffect(() => {
    if (waypoints.length > 0 && !trackedStartRef.current) {
      trackedStartRef.current = true;
      trackEvent(AnalyticsEvent.RIDE_FLYOVER_STARTED, { ride_id: rideId ?? '' });
    }
  }, [waypoints.length, rideId]);

  const trackedCompleteRef = useRef(false);

  // ─── Camera animation ────────────────────────────────────────────────

  const onProgress = useCallback(
    (p: number) => {
      if (waypoints.length === 0) return;
      const i = Math.min(waypoints.length - 1, Math.floor(p * waypoints.length));
      setCursor(i);

      // Track completion
      if (p >= 1 && !trackedCompleteRef.current) {
        trackedCompleteRef.current = true;
        trackEvent(AnalyticsEvent.RIDE_FLYOVER_COMPLETED, { ride_id: rideId ?? '' });
        setIsPlaying(false);
        playing.value = false;
      }

      // Throttle camera calls to ~250ms
      const now = Date.now();
      if (now - lastCameraTickRef.current < 250) return;
      lastCameraTickRef.current = now;

      const wp = waypoints[i];
      const next = waypoints[Math.min(i + 4, waypoints.length - 1)];
      cameraRef.current?.setCamera({
        centerCoordinate: [wp.longitude, wp.latitude],
        heading: bearingTo(wp, next),
        pitch: 60,
        zoomLevel: 15,
        animationMode: 'linearTo',
        animationDuration: 260,
      });
    },
    [waypoints, rideId, playing],
  );

  useFrameCallback(
    ({ timeSincePreviousFrame }) => {
      'worklet';
      if (!playing.value) return;
      const dt = (timeSincePreviousFrame ?? 16) * speedMultiplier.value;
      progress.value = Math.min(1, progress.value + dt / TOTAL_DURATION_MS);
      runOnJS(onProgress)(progress.value);
    },
    true,
  );

  // ─── Playback controls ───────────────────────────────────────────────

  const handlePlayPause = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const next = !isPlaying;
    setIsPlaying(next);
    playing.value = next;
  }, [isPlaying, playing]);

  const handleRestart = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    progress.value = 0;
    trackedCompleteRef.current = false;
    setCursor(0);
    setIsPlaying(true);
    playing.value = true;
    lastCameraTickRef.current = 0;
  }, [progress, playing]);

  const handleSpeedChange = useCallback(
    (speed: (typeof SPEED_OPTIONS)[number]) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setActiveSpeed(speed);
      speedMultiplier.value = speed;
    },
    [speedMultiplier],
  );

  const handleScrub = useCallback(
    (locationX: number) => {
      const w = scrubberWidthRef.current;
      if (w <= 0 || waypoints.length === 0) return;
      const p = Math.max(0, Math.min(1, locationX / w));
      progress.value = p;
      trackedCompleteRef.current = false;
      onProgress(p);
    },
    [progress, waypoints.length, onProgress],
  );

  // ─── Derived stats ───────────────────────────────────────────────────

  const currentWp = waypoints[cursor] ?? null;
  const currentSpeedMps = currentWp?.speedMps ?? 0;
  const currentAltitude = currentWp?.altitude ?? 0;
  const bikePosition = currentWp
    ? ([currentWp.longitude, currentWp.latitude] as [number, number])
    : null;

  // Cumulative distance up to cursor
  const cumulativeDistanceM = useMemo(() => {
    if (waypoints.length < 2 || cursor === 0) return 0;
    let dist = 0;
    for (let i = 1; i <= cursor; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      const dLat = ((curr.latitude - prev.latitude) * Math.PI) / 180;
      const dLon = ((curr.longitude - prev.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((prev.latitude * Math.PI) / 180) *
          Math.cos((curr.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      dist += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return dist;
  }, [waypoints, cursor]);

  // Time progress
  const totalDurationS = ride?.durationS ?? 0;
  const elapsedS = Math.floor((cursor / Math.max(1, waypoints.length - 1)) * totalDurationS);
  const currentTimeStr = formatMmSs(elapsedS);
  const totalTimeStr = formatMmSs(totalDurationS);

  const progressFraction = waypoints.length > 1 ? cursor / (waypoints.length - 1) : 0;

  // ─── Loading state ────────────────────────────────────────────────────

  if (waypointsLoading) {
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

  if (waypoints.length < 2) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          paddingHorizontal: 40,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: '600', color: theme.ink }}>
          Not enough data
        </Text>
        <Text style={{ fontSize: 14, color: theme.ink3, textAlign: 'center' }}>
          This ride doesn't have enough GPS waypoints for a 3D flyover.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 8,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 99,
            backgroundColor: theme.warm,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Full-screen map */}
      <MapboxGL.MapView
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        styleURL={MAP_STYLES.outdoors}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: startPoint ?? [0, 0],
            zoomLevel: 15,
            pitch: 60,
            heading: waypoints.length > 1 ? bearingTo(waypoints[0], waypoints[1]) : 0,
          }}
          animationDuration={0}
        />

        {/* 3D terrain */}
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

        {/* Route glow */}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="route-glow-source" shape={routeGeoJSON}>
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
        )}

        {/* Route line */}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="route-source" shape={routeGeoJSON}>
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
        )}

        {/* Start pin */}
        {startPoint && (
          <MapboxGL.MarkerView id="start" coordinate={startPoint}>
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
        )}

        {/* End pin */}
        {endPoint && (
          <MapboxGL.MarkerView id="end" coordinate={endPoint}>
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
        )}

        {/* Animated bike dot */}
        {bikePosition && (
          <MapboxGL.MarkerView id="bike-dot" coordinate={bikePosition}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: 'rgba(212,98,46,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: theme.warm,
                  borderWidth: 2.5,
                  borderColor: palette.white,
                  borderCurve: 'continuous',
                }}
              />
            </View>
          </MapboxGL.MarkerView>
        )}
      </MapboxGL.MapView>

      {/* ─── Close FAB (top-left) ─────────────────────────────────────── */}
      <View style={{ position: 'absolute', top: insets.top + 12, left: 16, zIndex: 10 }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            borderCurve: 'continuous',
            backgroundColor: GLASS_BG,
            borderWidth: 1,
            borderColor: GLASS_BORDER,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.18,
            shadowRadius: 18,
            elevation: 6,
          }}
        >
          <ArrowLeft size={18} color="rgba(255,255,255,0.92)" />
        </Pressable>
      </View>

      {/* ─── Stat HUD (top bar) ───────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 68,
          right: 12,
          zIndex: 5,
        }}
      >
        <View
          style={{
            backgroundColor: GLASS_BG,
            borderRadius: 18,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: GLASS_BORDER,
            flexDirection: 'row',
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          {/* Speed */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'GeistMono-Bold',
                fontSize: 30,
                fontWeight: '700',
                color: theme.warm,
                fontVariant: ['tabular-nums'],
                lineHeight: 34,
              }}
            >
              {formatSpeedValue(currentSpeedMps, system)}
            </Text>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 9,
                fontWeight: '500',
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {speedUnitLabel(system)}
            </Text>
          </View>

          {/* Distance */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'GeistMono-SemiBold',
                fontSize: 18,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.92)',
                fontVariant: ['tabular-nums'],
                lineHeight: 34,
              }}
            >
              {formatDistanceValue(cumulativeDistanceM, system)}
            </Text>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 9,
                fontWeight: '500',
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {distanceUnitLabel(system)}
            </Text>
          </View>

          {/* Elevation */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'GeistMono-SemiBold',
                fontSize: 18,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.92)',
                fontVariant: ['tabular-nums'],
                lineHeight: 34,
              }}
            >
              {formatElevationValue(currentAltitude, system)}
            </Text>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 9,
                fontWeight: '500',
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {elevationUnitLabel(system)}
            </Text>
          </View>

          {/* Time */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'GeistMono-SemiBold',
                fontSize: 18,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.92)',
                fontVariant: ['tabular-nums'],
                lineHeight: 34,
              }}
            >
              {currentTimeStr}
            </Text>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 9,
                fontWeight: '500',
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              TIME
            </Text>
          </View>
        </View>
      </View>

      {/* ─── Playback controls (bottom) ───────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: insets.bottom + 20,
          zIndex: 10,
        }}
      >
        <View
          style={{
            backgroundColor: GLASS_BG,
            borderRadius: 20,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: GLASS_BORDER,
            padding: 16,
            gap: 14,
          }}
        >
          {/* Scrubber */}
          <View
            onLayout={(e) => {
              scrubberWidthRef.current = e.nativeEvent.layout.width;
            }}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(e) => handleScrub(e.nativeEvent.locationX)}
            onResponderMove={(e) => handleScrub(e.nativeEvent.locationX)}
            style={{ height: 24, justifyContent: 'center' }}
          >
            {/* Track */}
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' }}>
              {/* Filled portion */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${Math.round(progressFraction * 100)}%`,
                  borderRadius: 3,
                  backgroundColor: theme.warm,
                }}
              />
            </View>
            {/* Handle */}
            <View
              style={{
                position: 'absolute',
                top: 4,
                left: `${Math.round(progressFraction * 100)}%`,
                marginLeft: -8,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: palette.white,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 4,
              }}
            />
          </View>

          {/* Time labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 }}>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 11,
                fontWeight: '500',
                color: 'rgba(255,255,255,0.5)',
                fontVariant: ['tabular-nums'],
              }}
            >
              {currentTimeStr}
            </Text>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 11,
                fontWeight: '500',
                color: 'rgba(255,255,255,0.5)',
                fontVariant: ['tabular-nums'],
              }}
            >
              {totalTimeStr}
            </Text>
          </View>

          {/* Speed pills */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {SPEED_OPTIONS.map((speed) => (
              <Pressable
                key={speed}
                onPress={() => handleSpeedChange(speed)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 99,
                  borderCurve: 'continuous',
                  backgroundColor: activeSpeed === speed ? theme.warm : 'rgba(255,255,255,0.08)',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'GeistMono-SemiBold',
                    fontSize: 12,
                    fontWeight: '600',
                    color: activeSpeed === speed ? palette.white : 'rgba(255,255,255,0.6)',
                    letterSpacing: 0.3,
                  }}
                >
                  {speed}x
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Play controls row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
            }}
          >
            {/* Restart */}
            <Pressable
              onPress={handleRestart}
              accessibilityRole="button"
              accessibilityLabel="Restart"
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RotateCcw size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>

            {/* Play / Pause */}
            <Pressable
              onPress={handlePlayPause}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                borderCurve: 'continuous',
                backgroundColor: theme.warm,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: 'rgba(200,119,44,1)',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              {isPlaying ? (
                <Pause size={22} color={palette.white} fill={palette.white} />
              ) : (
                <Play size={22} color={palette.white} fill={palette.white} />
              )}
            </Pressable>

            {/* Placeholder for symmetry */}
            <View style={{ width: 44, height: 44 }} />
          </View>
        </View>
      </View>
    </View>
  );
}
