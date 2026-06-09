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
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useEditorialTheme } from '../../theme/editorial';
import { decodePolylineLatLng } from '../../utils/polyline';
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
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Lerp between two angles (handles 360° wrap) */
function lerpAngle(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Haversine distance in meters between two coordinate points */
function haversineM(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinHalf =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(sinHalf), Math.sqrt(1 - sinHalf));
}

/** Format seconds as MM:SS */
function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TOTAL_DURATION_MS = 45_000; // 45 seconds at 1x speed
const CAMERA_INTERVAL_MS = 100; // Issue camera commands at 10fps for smooth motion
const CAMERA_DURATION_MS = 250; // Each animation lasts 250ms (overlapping at 100ms = seamless)
const HUD_INTERVAL_MS = 200; // Update HUD stats at 5fps (not 60)
const LOOK_AHEAD_DISTANCE_M = 150; // Look 150m ahead for stable bearing
const BEARING_LERP_FACTOR = 0.12; // Smoother bearing (smaller per-tick at 10fps ≈ same visual rate)
const CAMERA_ZOOM = 14.5; // Slightly wider than 15 for more terrain context
const CAMERA_PITCH = 65; // More dramatic "cockpit" view
const TERRAIN_EXAGGERATION = 1.5; // Dramatic 3D terrain relief
const SPEED_OPTIONS = [1, 2, 4] as const;

// Satellite-streets shows terrain texture + labels — much more 3D-visible than outdoors
const FLYOVER_STYLE_URL = 'mapbox://styles/mapbox/satellite-streets-v12';

const GLASS_BG = 'rgba(30,28,25,0.72)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function RideFlyoverScreen() {
  const { t: theme } = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const system = useMeasurementSystem();
  const { t } = useTranslation();

  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const scrubberWidthRef = useRef(0);
  const lastBearingRef = useRef<number | null>(null);
  const terrainElevationsRef = useRef<(number | null)[]>([]);

  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeSpeed, setActiveSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(2);
  const [terrainElevation, setTerrainElevation] = useState<number | null>(null);

  const progress = useSharedValue(0);

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
  const serverWaypoints = (waypointData as GetRideWaypointsQuery | undefined)?.rideWaypoints ?? [];

  // Fall back to decoding route polyline when server waypoints are empty
  const waypoints = useMemo(() => {
    if (serverWaypoints.length >= 2) return serverWaypoints;
    if (!ride?.routePolyline) return [];
    try {
      const decoded = decodePolylineLatLng(ride.routePolyline);
      if (decoded.length < 2) return [];
      // Distribute ride duration evenly across decoded points for stat overlay
      const totalDurationS = ride.durationS ?? 0;
      const totalDistanceM = ride.distanceM ?? 0;
      return decoded.map(([lat, lng]) => ({
        recordedAt: '',
        latitude: lat,
        longitude: lng,
        altitude: null as number | null,
        speedMps: totalDistanceM > 0 && totalDurationS > 0 ? totalDistanceM / totalDurationS : 0,
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

  // Pre-compute cumulative distances once (O(1) lookup vs O(n) per frame)
  const cumulativeDistances = useMemo(() => {
    if (waypoints.length < 2) return [0];
    const dists = [0];
    for (let i = 1; i < waypoints.length; i++) {
      dists.push(dists[i - 1] + haversineM(waypoints[i - 1], waypoints[i]));
    }
    return dists;
  }, [waypoints]);

  // ─── Analytics ────────────────────────────────────────────────────────

  const trackedStartRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  useEffect(() => {
    if (waypoints.length > 0 && !trackedStartRef.current) {
      trackedStartRef.current = true;
      startTimeRef.current = Date.now();
      trackEvent(AnalyticsEvent.RIDE_FLYOVER_STARTED, { ride_id: rideId ?? '' });
    }
  }, [waypoints.length, rideId]);

  const trackedCompleteRef = useRef(false);

  // ─── Camera animation (smooth: 10fps with interpolated positions) ────

  useEffect(() => {
    if (!isPlaying || waypoints.length < 2 || cumulativeDistances.length < 2) return;

    const totalRouteM = cumulativeDistances[cumulativeDistances.length - 1];
    if (totalRouteM <= 0) return;

    /**
     * Given a distance along the route, return the interpolated lat/lng and
     * the segment index (floor) for HUD waypoint lookup.
     */
    const posAtDistance = (distM: number) => {
      // Binary search for the segment containing distM
      let lo = 0;
      let hi = cumulativeDistances.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (cumulativeDistances[mid] <= distM) lo = mid;
        else hi = mid;
      }
      const segLen = cumulativeDistances[hi] - cumulativeDistances[lo];
      const t = segLen > 0 ? (distM - cumulativeDistances[lo]) / segLen : 0;
      const a = waypoints[lo];
      const b = waypoints[hi];
      return {
        longitude: lerp(a.longitude, b.longitude, t),
        latitude: lerp(a.latitude, b.latitude, t),
        index: lo,
      };
    };

    /**
     * Find the waypoint index at a given distance ahead (for bearing look-ahead).
     * Returns the farthest waypoint within `aheadM` meters of `fromDist`.
     */
    const lookAheadPos = (fromDist: number, aheadM: number) => {
      const targetDist = Math.min(fromDist + aheadM, totalRouteM);
      return posAtDistance(targetDist);
    };

    const interval = setInterval(() => {
      // Advance progress (distance-based for constant speed)
      const dt = CAMERA_INTERVAL_MS * activeSpeed;
      const newP = Math.min(1, progress.value + dt / TOTAL_DURATION_MS);
      progress.value = newP;

      // Interpolated position along the route
      const currentDistM = newP * totalRouteM;
      const pos = posAtDistance(currentDistM);
      const ahead = lookAheadPos(currentDistM, LOOK_AHEAD_DISTANCE_M);

      // Smooth bearing with lerp to avoid rotation jumps on switchbacks
      const rawBearing = bearingTo(pos, ahead);
      const smoothBearing =
        lastBearingRef.current != null
          ? lerpAngle(lastBearingRef.current, rawBearing, BEARING_LERP_FACTOR)
          : rawBearing;
      lastBearingRef.current = smoothBearing;

      cameraRef.current?.setCamera({
        centerCoordinate: [pos.longitude, pos.latitude],
        heading: smoothBearing,
        pitch: CAMERA_PITCH,
        zoomLevel: CAMERA_ZOOM,
        animationMode: 'linearTo',
        animationDuration: CAMERA_DURATION_MS,
      });

      // Completion check
      if (newP >= 1 && !trackedCompleteRef.current) {
        trackedCompleteRef.current = true;
        trackEvent(AnalyticsEvent.RIDE_FLYOVER_COMPLETED, { ride_id: rideId ?? '' });
        setIsPlaying(false);
      }
    }, CAMERA_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isPlaying, activeSpeed, waypoints, cumulativeDistances, rideId, progress]);

  // ─── HUD stat updates (decoupled, 5fps — not every frame) ──────────

  useEffect(() => {
    if (!isPlaying || waypoints.length < 2 || cumulativeDistances.length < 2) return;

    const totalRouteM = cumulativeDistances[cumulativeDistances.length - 1];

    const interval = setInterval(async () => {
      const p = progress.value;
      // Map progress to distance, then find the nearest waypoint index
      const distM = p * totalRouteM;
      let i = 0;
      for (let j = 1; j < cumulativeDistances.length; j++) {
        if (cumulativeDistances[j] > distM) break;
        i = j;
      }
      setCursor(i);

      // Query terrain elevation when waypoint has no altitude
      const wp = waypoints[i];
      if (wp && wp.altitude == null) {
        // Use cached terrain elevation if available
        const cached = terrainElevationsRef.current[i];
        if (cached != null) {
          setTerrainElevation(cached);
        } else {
          try {
            const elev = await mapRef.current?.queryTerrainElevation([wp.longitude, wp.latitude]);
            if (elev != null) {
              terrainElevationsRef.current[i] = elev;
              setTerrainElevation(elev);
            }
          } catch {
            // Terrain not yet loaded — will retry on next tick
          }
        }
      } else if (wp) {
        setTerrainElevation(null); // Use waypoint altitude directly
      }
    }, HUD_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isPlaying, waypoints, cumulativeDistances, progress]);

  // ─── Playback controls ───────────────────────────────────────────────

  const handlePlayPause = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsPlaying((prev) => !prev);
  }, []);

  const handleRestart = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    progress.value = 0;
    trackedCompleteRef.current = false;
    lastBearingRef.current = null;
    terrainElevationsRef.current = [];
    setCursor(0);
    setTerrainElevation(null);
    setIsPlaying(true);
  }, [progress]);

  const handleSpeedChange = useCallback(
    (speed: (typeof SPEED_OPTIONS)[number]) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      trackEvent(AnalyticsEvent.RIDE_FLYOVER_SPEED_CHANGED, {
        ride_id: rideId ?? '',
        speed,
      });
      setActiveSpeed(speed);
    },
    [rideId],
  );

  // Idempotent exit emit. Guarded so it fires at most once, and never when the
  // flyover completed (that's the success path) or never started (no waypoints).
  const trackedExitRef = useRef(false);
  const emitFlyoverExit = useCallback(() => {
    if (trackedExitRef.current || trackedCompleteRef.current || !trackedStartRef.current) return;
    trackedExitRef.current = true;
    const watchDurationS = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0;
    trackEvent(AnalyticsEvent.RIDE_FLYOVER_EXITED, {
      ride_id: rideId ?? '',
      progress_pct: Math.round(progress.value * 100),
      watch_duration_s: watchDurationS,
    });
  }, [rideId, progress]);

  const handleExit = useCallback(() => {
    emitFlyoverExit();
    router.back();
  }, [emitFlyoverExit, router]);

  // The exit logic above only ran from button presses; iOS swipe-down / hardware
  // back dismiss the modal via router.back() and skip the JS handler entirely, so
  // ride_flyover_exited never fired in prod. `beforeRemove` catches EVERY dismissal
  // (the emit is idempotent, so the button-press path doesn't double-count).
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      emitFlyoverExit();
    });
    return unsubscribe;
  }, [navigation, emitFlyoverExit]);

  const handleScrub = useCallback(
    (locationX: number) => {
      const w = scrubberWidthRef.current;
      if (w <= 0 || waypoints.length === 0 || cumulativeDistances.length < 2) return;
      const p = Math.max(0, Math.min(1, locationX / w));
      progress.value = p;
      trackedCompleteRef.current = false;
      // Map progress to distance, then find nearest waypoint
      const totalRouteM = cumulativeDistances[cumulativeDistances.length - 1];
      const distM = p * totalRouteM;
      let i = 0;
      for (let j = 1; j < cumulativeDistances.length; j++) {
        if (cumulativeDistances[j] > distM) break;
        i = j;
      }
      setCursor(i);
    },
    [progress, waypoints.length, cumulativeDistances],
  );

  // ─── Derived stats ───────────────────────────────────────────────────

  const currentWp = waypoints[cursor] ?? null;
  const currentSpeedMps = currentWp?.speedMps ?? 0;
  // Prefer waypoint altitude, fall back to terrain-queried elevation
  const currentAltitude = currentWp?.altitude ?? terrainElevation ?? 0;
  // Bike dot GeoJSON — memoize on coordinates, not object identity
  const bikeLng = currentWp?.longitude ?? 0;
  const bikeLat = currentWp?.latitude ?? 0;
  const bikePointGeoJSON = useMemo<GeoJSON.Feature | null>(() => {
    if (!currentWp) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [bikeLng, bikeLat],
      },
    };
  }, [bikeLng, bikeLat, currentWp]);

  const cumulativeDistanceM = cumulativeDistances[cursor] ?? 0;

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
          {t('rideFlyover.notEnoughData')}
        </Text>
        <Text style={{ fontSize: 14, color: theme.ink3, textAlign: 'center' }}>
          {t('rideFlyover.notEnoughDataBody')}
        </Text>
        <Pressable
          onPress={handleExit}
          style={{
            marginTop: 8,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 99,
            backgroundColor: theme.warm,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
            {t('rideFlyover.goBack')}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Full-screen map */}
      <MapboxGL.MapView
        ref={mapRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        styleURL={FLYOVER_STYLE_URL}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: startPoint ?? [0, 0],
            zoomLevel: CAMERA_ZOOM,
            pitch: CAMERA_PITCH,
            heading:
              waypoints.length > 1
                ? bearingTo(
                    waypoints[0],
                    waypoints[
                      Math.min(
                        // Find the waypoint ~150m ahead for initial bearing
                        cumulativeDistances.findIndex((d) => d >= LOOK_AHEAD_DISTANCE_M) ||
                          waypoints.length - 1,
                        waypoints.length - 1,
                      )
                    ],
                  )
                : 0,
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
          <MapboxGL.Terrain style={{ exaggeration: TERRAIN_EXAGGERATION }} />
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

        {/* 3D buildings — visible at zoom 15+ for urban rides */}
        <MapboxGL.FillExtrusionLayer
          id="3d-buildings"
          sourceID="composite"
          sourceLayerID="building"
          minZoomLevel={15}
          maxZoomLevel={24}
          style={{
            fillExtrusionColor: '#aaa',
            fillExtrusionHeight: [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'height'],
            ],
            fillExtrusionBase: [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'min_height'],
            ],
            fillExtrusionOpacity: 0.6,
          }}
        />

        {/* Route glow — brighter on satellite for visibility */}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="route-glow-source" shape={routeGeoJSON}>
            <MapboxGL.LineLayer
              id="route-glow"
              style={{
                lineColor: theme.warm,
                lineWidth: 12,
                lineOpacity: 0.3,
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
                lineWidth: 4.5,
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

        {/* Animated bike dot — GPU-rendered CircleLayer (no RN layout overhead) */}
        {bikePointGeoJSON && (
          <MapboxGL.ShapeSource id="bike-source" shape={bikePointGeoJSON}>
            <MapboxGL.CircleLayer
              id="bike-glow"
              style={{
                circleRadius: 15,
                circleColor: 'rgba(212,98,46,0.18)',
              }}
            />
            <MapboxGL.CircleLayer
              id="bike-dot"
              style={{
                circleRadius: 9,
                circleColor: theme.warm,
                circleStrokeWidth: 2.5,
                circleStrokeColor: '#ffffff',
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {/* ─── Close FAB (top-left) ─────────────────────────────────────── */}
      <View style={{ position: 'absolute', top: insets.top + 12, left: 16, zIndex: 10 }}>
        <Pressable
          onPress={handleExit}
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
                  {`${speed}x`}
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
