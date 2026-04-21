import { palette } from '@motovault/design-system';
import {
  CloneDiscoverTripDocument,
  DiscoverTripDetailDocument,
  type DiscoverTripDetailQuery,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Award, Calendar, Copy, MapPin, Mountain, Star } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { gqlFetcher } from '../../lib/graphql-client';
import { getDefaultMapStyle, MAP_STYLES } from '../../utils/map-styles';
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
    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

type DiscoverTrip = NonNullable<DiscoverTripDetailQuery['discoverTripById']>;
type Waypoint = DiscoverTrip['waypoints'][number];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: palette.success500,
  moderate: palette.accent500,
  challenging: palette.warning500,
  expert: palette.danger500,
};

const WAYPOINT_ICONS: Record<string, string> = {
  start: 'Start',
  end: 'End',
  fuel: 'Fuel',
  food: 'Food',
  scenic: 'Scenic',
  overnight: 'Overnight',
  photo: 'Photo',
  mechanical: 'Mechanical',
  ferry: 'Ferry',
  pass_summit: 'Summit',
  rally_point: 'Rally',
};

export default function DiscoverTripDetailScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const system = useMeasurementSystem();
  const queryClient = useQueryClient();
  const { discoverTripId } = useLocalSearchParams<{ discoverTripId: string }>();

  const bg = isDark ? palette.neutral950 : palette.white;
  const cardBg = isDark ? palette.cardDark : palette.neutral50;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const statColor = isDark ? palette.neutral200 : palette.neutral700;

  // --- Fetch trip detail ---

  const { data, isLoading, error } = useQuery({
    queryKey: ['discoverTrips', 'detail', discoverTripId],
    queryFn: () => gqlFetcher(DiscoverTripDetailDocument, { id: discoverTripId! }),
    enabled: !!discoverTripId,
    staleTime: 5 * 60 * 1000,
  });

  const trip = data?.discoverTripById;
  const [mapStyle] = useState(() => getDefaultMapStyle(isDark));

  // --- Route line GeoJSON for Mapbox ---
  const routeLine = useMemo(() => {
    if (!trip?.polyline) return null;
    const coords = decodePolylineToCoords(trip.polyline);
    if (coords.length < 2) return null;
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: {},
    };
  }, [trip?.polyline]);

  // Waypoint GeoJSON markers
  const waypointMarkers = useMemo(() => {
    if (!trip) return null;
    const features = trip.waypoints
      .filter((wp) => wp.lat != null && wp.lng != null)
      .map((wp) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [wp.lng, wp.lat] },
        properties: { name: wp.name, type: wp.type },
      }));
    return { type: 'FeatureCollection' as const, features };
  }, [trip]);

  // --- Clone mutation ---

  const cloneMutation = useMutation({
    mutationFn: () => gqlFetcher(CloneDiscoverTripDocument, { discoverTripId: discoverTripId! }),
    onSuccess: (result) => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['discoverTrips'] });
      const newTripId = result?.cloneDiscoverTrip;
      if (newTripId) {
        router.replace({ pathname: '/(modals)/trip-detail', params: { tripId: newTripId } });
      }
    },
    onError: (err: Error) => {
      if (err.message?.includes('already cloned')) {
        Alert.alert('Already Cloned', 'You have already cloned this trip.');
      } else if (err.message?.includes('No internet') || err.message?.includes('Network')) {
        Alert.alert('Offline', "No internet connection. Please try again when you're back online.");
      } else {
        Alert.alert('Clone Failed', 'Could not clone this trip. Please try again.');
      }
    },
  });

  const handleClone = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cloneMutation.mutate();
  }, [cloneMutation]);

  // --- Group waypoints by day ---

  const waypointsByDay = useMemo(() => {
    if (!trip) return [];
    const days: Map<number, Waypoint[]> = new Map();
    for (const wp of trip.waypoints) {
      const dayWps = days.get(wp.dayIndex) ?? [];
      dayWps.push(wp);
      days.set(wp.dayIndex, dayWps);
    }
    return [...days.entries()]
      .sort(([a], [b]) => a - b)
      .map(([dayIndex, waypoints]) => ({
        dayIndex,
        waypoints: waypoints.sort((a, b) => a.sortOrder - b.sortOrder),
      }));
  }, [trip]);

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color={palette.accent500} />
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}
      >
        <Text style={{ fontSize: 16, color: titleColor, textAlign: 'center' }}>Trip not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 15, color: palette.accent500, fontWeight: '600' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const difficultyColor = DIFFICULTY_COLORS[trip.difficulty] ?? palette.accent500;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={titleColor} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: titleColor }} numberOfLines={1}>
            {trip.title}
          </Text>
        </View>
      </View>

      {/* Map with polyline */}
      {(routeLine || (trip.startLat != null && trip.startLng != null)) && (
        <View style={{ height: 240 }}>
          <MapboxGL.MapView
            style={{ flex: 1 }}
            styleURL={MAP_STYLES[mapStyle]}
            compassEnabled={false}
            logoEnabled={false}
            attributionEnabled={false}
            scaleBarEnabled={false}
          >
            {routeLine ? (
              <>
                <MapboxGL.Camera
                  defaultSettings={{ padding: { paddingTop: 40, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 } }}
                  bounds={{
                    ne: [
                      Math.max(...routeLine.geometry.coordinates.map((c) => c[0])),
                      Math.max(...routeLine.geometry.coordinates.map((c) => c[1])),
                    ],
                    sw: [
                      Math.min(...routeLine.geometry.coordinates.map((c) => c[0])),
                      Math.min(...routeLine.geometry.coordinates.map((c) => c[1])),
                    ],
                    paddingTop: 40,
                    paddingBottom: 40,
                    paddingLeft: 40,
                    paddingRight: 40,
                  }}
                />
                <MapboxGL.ShapeSource id="route-line" shape={routeLine}>
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
              </>
            ) : (
              <MapboxGL.Camera
                defaultSettings={{
                  centerCoordinate: [trip.startLng!, trip.startLat!],
                  zoomLevel: 10,
                }}
              />
            )}
            {waypointMarkers && waypointMarkers.features.length > 0 && (
              <MapboxGL.ShapeSource id="waypoint-pins" shape={waypointMarkers}>
                <MapboxGL.CircleLayer
                  id="waypoint-dots"
                  style={{
                    circleColor: palette.accent500,
                    circleRadius: 6,
                    circleStrokeColor: palette.white,
                    circleStrokeWidth: 2,
                  }}
                />
              </MapboxGL.ShapeSource>
            )}
          </MapboxGL.MapView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Badges row */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(200)}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
        >
          {/* Difficulty */}
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: `${difficultyColor}18`,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: difficultyColor,
                textTransform: 'capitalize',
              }}
            >
              {trip.difficulty}
            </Text>
          </View>

          {/* Day count */}
          {trip.dayCount > 1 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor: `${palette.accent500}18`,
              }}
            >
              <Calendar size={12} color={palette.accent500} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: palette.accent500 }}>
                {trip.dayCount} days
              </Text>
            </View>
          )}

          {/* MotoVault Pick */}
          {trip.isMotovaultPick && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor: `${palette.signature500}18`,
              }}
            >
              <Award size={12} color={palette.signature500} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: palette.signature500 }}>
                Pick
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Stats bar */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 20,
            padding: 14,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: cardBg,
          }}
        >
          {trip.distanceM != null && (
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: titleColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatDistance(trip.distanceM, system)}
              </Text>
              <Text style={{ fontSize: 11, color: subtitleColor }}>Distance</Text>
            </View>
          )}
          {(trip.elevationGainM ?? 0) > 0 && (
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Mountain size={14} color={palette.accent500} />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: titleColor,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatElevation(trip.elevationGainM ?? 0, system)}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: subtitleColor }}>Elevation</Text>
            </View>
          )}
          {trip.averageRating != null && trip.reviewCount > 0 && (
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Star size={14} color={palette.warning500} fill={palette.warning500} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: titleColor }}>
                  {trip.averageRating.toFixed(1)}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: subtitleColor }}>{trip.reviewCount} reviews</Text>
            </View>
          )}
          {trip.cloneCount > 0 && (
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Copy size={14} color={statColor} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: titleColor }}>
                  {trip.cloneCount}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: subtitleColor }}>Clones</Text>
            </View>
          )}
        </View>

        {/* Description */}
        <Text style={{ fontSize: 14, lineHeight: 22, color: statColor, marginBottom: 24 }}>
          {trip.description}
        </Text>

        {/* Contributor attribution */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: palette.accent500,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.white }}>
              {trip.contributor.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: titleColor }}>
              {trip.contributor.displayName}
            </Text>
            {trip.contributor.publicUsername && (
              <Text style={{ fontSize: 12, color: subtitleColor }}>
                @{trip.contributor.publicUsername}
              </Text>
            )}
          </View>
        </View>

        {/* Day-by-day itinerary */}
        {waypointsByDay.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: titleColor, marginBottom: 12 }}>
              Itinerary
            </Text>
            {waypointsByDay.map(({ dayIndex, waypoints }, dayIdx) => (
              <Animated.View
                key={dayIndex}
                entering={reducedMotion ? undefined : FadeInUp.delay(dayIdx * 60).duration(200)}
                style={{ marginBottom: 16 }}
              >
                {trip.dayCount > 1 && (
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: palette.accent500,
                      marginBottom: 8,
                    }}
                  >
                    Day {dayIndex + 1}
                  </Text>
                )}
                {waypoints.map((wp, wpIdx) => (
                  <View
                    key={`${dayIndex}-${wpIdx}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 10,
                      paddingVertical: 8,
                      borderLeftWidth: wpIdx < waypoints.length - 1 ? 1 : 0,
                      borderLeftColor: isDark ? palette.neutral800 : palette.neutral200,
                      marginLeft: 8,
                      paddingLeft: 16,
                    }}
                  >
                    <MapPin size={16} color={palette.accent500} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: titleColor }}>
                        {wp.name}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: subtitleColor, textTransform: 'capitalize' }}
                      >
                        {WAYPOINT_ICONS[wp.type] ?? wp.type}
                      </Text>
                      {wp.notes && (
                        <Text style={{ fontSize: 12, color: subtitleColor, marginTop: 2 }}>
                          {wp.notes}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Clone CTA — sticky bottom */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: bg,
          borderTopWidth: 1,
          borderTopColor: isDark ? palette.neutral800 : palette.neutral200,
        }}
      >
        <Pressable
          onPress={handleClone}
          disabled={cloneMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Clone to My Trips"
          style={({ pressed }) => ({
            backgroundColor: palette.accent500,
            paddingVertical: 14,
            borderRadius: 14,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          {cloneMutation.isPending ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <>
              <Copy size={18} color={palette.white} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
                Clone to My Trips
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
