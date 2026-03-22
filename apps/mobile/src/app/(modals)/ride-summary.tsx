import { palette } from '@motovault/design-system';
import { UpdateRideDocument } from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Gauge, Map as MapIcon, Mountain, Route, Share2 } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MileagePrompt } from '../../components/ride/mileage-prompt';
import { clearRideData, getPointBuffer, getWaypointChunks } from '../../utils/ride-storage';
import { enqueue } from '../../utils/ride-sync-queue';

type MapStyle = 'dark' | 'outdoors' | 'satellite';

const MAP_STYLES: Record<MapStyle, string> = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

function formatSpeed(mps: number): string {
  const mph = mps * 2.237;
  return `${Math.round(mph)} mph`;
}

function formatElevation(meters: number): string {
  const feet = meters * 3.281;
  return `${Math.round(feet)} ft`;
}

function defaultRideName(startedAt: number, distanceM: number): string {
  const date = new Date(startedAt);
  const month = date.toLocaleDateString(undefined, { month: 'short' });
  const day = date.getDate();
  const miles = Math.round(distanceM / 1609.34);
  return `${month} ${day} \u2014 ${miles} mi`;
}

export default function RideSummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    rideId: string;
    distanceM: string;
    durationS: string;
    maxSpeedMps: string;
    avgSpeedMps: string;
    elevationGain: string;
    startedAt: string;
  }>();

  const rideId = params.rideId ?? '';
  const distanceM = Number(params.distanceM) || 0;
  const durationS = Number(params.durationS) || 0;
  const maxSpeedMps = Number(params.maxSpeedMps) || 0;
  const avgSpeedMps = Number(params.avgSpeedMps) || 0;
  const elevationGain = Number(params.elevationGain) || 0;
  const startedAtMs = Number(params.startedAt) || Date.now();

  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [rideName, setRideName] = useState(defaultRideName(startedAtMs, distanceM));
  const [showMileagePrompt, setShowMileagePrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);

  // Build route from stored waypoints
  const routeData = useMemo(() => {
    const chunks = getWaypointChunks(rideId);
    const allWaypoints = chunks.flat();
    const buffer = [...getPointBuffer()];
    const combined = [...allWaypoints, ...buffer];

    if (combined.length < 2) return null;

    const coordinates: [number, number][] = [];
    const speedValues: number[] = [];

    // Compute bounds using for-loop (NOT Math.max(...array) — crashes at 10k elements)
    let minLng = combined[0].longitude;
    let maxLng = combined[0].longitude;
    let minLat = combined[0].latitude;
    let maxLat = combined[0].latitude;

    // Cumulative distance for gradient
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

    // Build speed-gradient color stops
    const totalDist = cumulativeDistance || 1;
    const colorStops: [number, string][] = [];
    for (let i = 0; i < combined.length; i++) {
      const pct = distances[i] / totalDist;
      const speedKmh = (speedValues[i] ?? 0) * 3.6;
      let color: string;
      if (speedKmh < 30)
        color = '#3b82f6'; // blue
      else if (speedKmh < 80)
        color = '#22c55e'; // green
      else color = '#f97316'; // orange
      colorStops.push([pct, color]);
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
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      await Share.share({
        message: `Just completed a ${formatDistance(distanceM)} ride in ${formatDuration(durationS)} with MotoVault!`,
      });
    } catch {
      // User cancelled
    }
  }, [distanceM, durationS]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      enqueue('updateRide' as 'endRide', {
        mutationDocument: UpdateRideDocument,
        variables: {
          input: {
            rideId,
            name: rideName || null,
          },
        },
      });

      // Clean up MMKV
      clearRideData(rideId);

      // Navigate back
      // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
      router.replace('/(tabs)/(profile)' as any);
    } catch (error) {
      console.error('[RideSummary] Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [rideId, rideName, router]);

  const cycleMapStyle = useCallback(() => {
    const styles: MapStyle[] = ['dark', 'outdoors', 'satellite'];
    const idx = styles.indexOf(mapStyle);
    setMapStyle(styles[(idx + 1) % styles.length]);
  }, [mapStyle]);

  const stats = [
    { icon: Route, label: 'Distance', value: formatDistance(distanceM) },
    { icon: Clock, label: 'Moving Time', value: formatDuration(durationS) },
    { icon: Gauge, label: 'Avg Speed', value: formatSpeed(avgSpeedMps) },
    { icon: Gauge, label: 'Max Speed', value: formatSpeed(maxSpeedMps) },
    { icon: Mountain, label: 'Elev. Gain', value: formatElevation(elevationGain) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: palette.surfaceDark }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Map (top 60%) */}
        <View style={{ height: 420, position: 'relative' }}>
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
                <MapboxGL.PointAnnotation id="start-marker" coordinate={routeData.startPoint}>
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
                </MapboxGL.PointAnnotation>

                {/* End marker */}
                <MapboxGL.PointAnnotation id="end-marker" coordinate={routeData.endPoint}>
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
                </MapboxGL.PointAnnotation>
              </>
            )}
          </MapboxGL.MapView>

          {/* Map style toggle */}
          <Pressable
            onPress={cycleMapStyle}
            style={{
              position: 'absolute',
              top: insets.top + 12,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(0,0,0,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MapIcon size={18} color={palette.white} />
          </Pressable>

          {/* Share button */}
          <Pressable
            onPress={handleShare}
            style={{
              position: 'absolute',
              top: insets.top + 12,
              right: 64,
              width: 40,
              height: 40,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(0,0,0,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Share2 size={18} color={palette.white} />
          </Pressable>
        </View>

        {/* Stats overlay */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(300)}
          style={{ paddingHorizontal: 20, marginTop: -24 }}
        >
          <View
            style={{
              backgroundColor: palette.cardDark,
              borderRadius: 24,
              borderCurve: 'continuous',
              padding: 20,
              gap: 16,
            }}
          >
            {/* Stats grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {stats.map(({ icon: Icon, label, value }) => (
                <View
                  key={label}
                  style={{
                    width: '47%',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    padding: 14,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} color={palette.neutral400} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: palette.neutral400 }}>
                      {label}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: palette.white }}>
                    {value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Ride name */}
            <View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: palette.neutral400,
                  marginBottom: 8,
                }}
              >
                Ride Name
              </Text>
              <TextInput
                value={rideName}
                onChangeText={setRideName}
                placeholder="Name your ride..."
                placeholderTextColor={palette.neutral600}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  padding: 14,
                  fontSize: 16,
                  fontWeight: '600',
                  color: palette.white,
                }}
              />
            </View>

            {/* Mileage prompt toggle */}
            {showMileagePrompt && (
              <MileagePrompt
                currentMileage={0}
                rideDistance={distanceM / 1609.34}
                mileageUnit="mi"
                gpsQuality={1}
                onAccept={() => setShowMileagePrompt(false)}
                onEdit={() => setShowMileagePrompt(false)}
                onSkip={() => setShowMileagePrompt(false)}
              />
            )}

            {/* Save button */}
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={({ pressed }) => ({
                backgroundColor: palette.accent500,
                borderRadius: 20,
                borderCurve: 'continuous',
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isSaving ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: palette.white }}>
                {isSaving ? 'Saving...' : 'Save Ride'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
