import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import { CreateTripWithWaypointsDocument, PublishTripDocument } from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, Map as MapIcon, MapPin, Plus, Save, Send } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StopListItem } from '../../components/trip/stop-list-item';
import { getWaypointIcon, WaypointTypePicker } from '../../components/trip/waypoint-type-picker';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { MAP_STYLES, type MapStyle } from '../../utils/map-styles';

type Difficulty = 'easy' | 'moderate' | 'challenging' | 'expert';

interface LocalWaypoint {
  id: string;
  type: string;
  name: string;
  lat: number;
  lng: number;
  notes?: string;
  sortOrder: number;
}

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'challenging', label: 'Challenging' },
  { key: 'expert', label: 'Expert' },
];

const DIFFICULTY_COLORS = {
  easy: palette.success500,
  moderate: palette.warning500,
  challenging: palette.danger500,
  expert: palette.danger700,
} as const;

let tempIdCounter = 0;
function tempId(): string {
  tempIdCounter += 1;
  return `tmp_${Date.now()}_${tempIdCounter}`;
}

export default function CreateTripScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const sheetRef = useRef<BottomSheet>(null);

  // Theme colors
  const bg = isDark ? palette.neutral950 : palette.white;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const inputBg = isDark ? palette.cardDark : palette.neutral100;
  const inputBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const inputTextColor = isDark ? palette.white : palette.neutral950;
  const placeholderColor = isDark ? palette.neutral600 : palette.neutral400;
  const labelColor = isDark ? palette.neutral300 : palette.neutral600;
  const chipBg = isDark ? palette.neutral800 : palette.neutral200;
  const chipSelectedBg = isDark ? palette.surfaceElevated : palette.neutral100;
  const sheetBg = isDark ? palette.cardDark : palette.white;

  // Map state
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');

  // Waypoint placement state
  const [pendingCoord, setPendingCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingType, setPendingType] = useState('start');

  // Waypoints
  const [waypoints, setWaypoints] = useState<LocalWaypoint[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate');
  const [maxRiders, setMaxRiders] = useState('10');

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    startDate.trim().length > 0 &&
    endDate.trim().length > 0 &&
    waypoints.length >= 2;

  // Route line GeoJSON
  const routeGeoJSON = useMemo(() => {
    if (waypoints.length < 2) return null;
    const sorted = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: sorted.map((wp) => [wp.lng, wp.lat]),
      },
      properties: {},
    };
  }, [waypoints]);

  // Camera bounds
  const bounds = useMemo(() => {
    if (waypoints.length === 0) return undefined;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const wp of waypoints) {
      minLng = Math.min(minLng, wp.lng);
      maxLng = Math.max(maxLng, wp.lng);
      minLat = Math.min(minLat, wp.lat);
      maxLat = Math.max(maxLat, wp.lat);
    }
    return {
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
    };
  }, [waypoints]);

  // Map long-press handler
  const handleLongPress = useCallback(
    (event: MapboxGL.MapPressEvent) => {
      const [lng, lat] = event.geometry.coordinates;
      setPendingCoord({ lat, lng });
      setPendingType(waypoints.length === 0 ? 'start' : 'fuel');
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [waypoints.length],
  );

  // Confirm waypoint placement
  const handleConfirmWaypoint = useCallback(() => {
    if (!pendingCoord) return;
    const wt = getWaypointIcon(pendingType);
    const newWp: LocalWaypoint = {
      id: tempId(),
      type: pendingType,
      name: wt.label,
      lat: pendingCoord.lat,
      lng: pendingCoord.lng,
      sortOrder: waypoints.length,
    };
    setWaypoints((prev) => [...prev, newWp]);
    setPendingCoord(null);
    trackEvent(AnalyticsEvent.TRIP_WAYPOINT_ADDED, {
      waypoint_type: pendingType,
      waypoint_index: waypoints.length,
    });
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [pendingCoord, pendingType, waypoints.length]);

  // Cancel waypoint placement
  const handleCancelPending = useCallback(() => {
    setPendingCoord(null);
  }, []);

  // Reorder waypoints
  const handleMoveUp = useCallback((index: number) => {
    setWaypoints((prev) => {
      const next = [...prev];
      const sorted = next.sort((a, b) => a.sortOrder - b.sortOrder);
      if (index <= 0) return prev;
      const tempOrder = sorted[index].sortOrder;
      sorted[index].sortOrder = sorted[index - 1].sortOrder;
      sorted[index - 1].sortOrder = tempOrder;
      return [...sorted];
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setWaypoints((prev) => {
      const next = [...prev];
      const sorted = next.sort((a, b) => a.sortOrder - b.sortOrder);
      if (index >= sorted.length - 1) return prev;
      const tempOrder = sorted[index].sortOrder;
      sorted[index].sortOrder = sorted[index + 1].sortOrder;
      sorted[index + 1].sortOrder = tempOrder;
      return [...sorted];
    });
  }, []);

  // Delete waypoint
  const handleDelete = useCallback((id: string) => {
    setWaypoints((prev) => {
      const filtered = prev.filter((wp) => wp.id !== id);
      return filtered.map((wp, i) => ({ ...wp, sortOrder: i }));
    });
  }, []);

  // Cycle map style
  const cycleMapStyle = useCallback(() => {
    setMapStyle((prev) =>
      prev === 'dark' ? 'outdoors' : prev === 'outdoors' ? 'satellite' : 'dark',
    );
  }, []);

  // Build the batch input shared by save and publish
  const buildTripInput = useCallback(() => {
    const sorted = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      title: title.trim(),
      description: description.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      difficulty,
      maxRiders: Number.parseInt(maxRiders, 10) || 10,
      waypoints: sorted.map((wp) => ({
        sortOrder: wp.sortOrder,
        type: wp.type,
        name: wp.name,
        notes: wp.notes || undefined,
        lat: wp.lat,
        lng: wp.lng,
      })),
    };
  }, [title, description, startDate, endDate, difficulty, maxRiders, waypoints]);

  // Save draft mutation — single batch call
  const saveMutation = useMutation({
    mutationFn: async () => {
      const result = await gqlFetcher(CreateTripWithWaypointsDocument, {
        input: buildTripInput(),
      });
      return result.createTripWithWaypoints.id;
    },
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEvent(AnalyticsEvent.TRIP_CREATED, {
        difficulty,
        waypoint_count: waypoints.length,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save trip. Please try again.');
    },
  });

  // Publish mutation — batch create then publish
  const publishMutation = useMutation({
    mutationFn: async () => {
      const result = await gqlFetcher(CreateTripWithWaypointsDocument, {
        input: buildTripInput(),
      });
      const tripId = result.createTripWithWaypoints.id;
      await gqlFetcher(PublishTripDocument, { tripId });
      return tripId;
    },
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEvent(AnalyticsEvent.TRIP_PUBLISHED, {
        difficulty,
        waypoint_count: waypoints.length,
        max_riders: Number.parseInt(maxRiders, 10) || 10,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to publish trip. Please try again.');
    },
  });

  const isSaving = saveMutation.isPending || publishMutation.isPending;
  const sortedWaypoints = useMemo(
    () => [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder),
    [waypoints],
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Full-screen map */}
      <MapboxGL.MapView
        style={{ flex: 1 }}
        styleURL={MAP_STYLES[mapStyle]}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        onLongPress={handleLongPress}
      >
        {bounds && waypoints.length >= 2 && (
          <MapboxGL.Camera
            bounds={{
              ...bounds,
              paddingBottom: 200,
              paddingTop: 80,
              paddingLeft: 40,
              paddingRight: 40,
            }}
            animationMode="flyTo"
            animationDuration={500}
          />
        )}
        {waypoints.length === 1 && (
          <MapboxGL.Camera
            centerCoordinate={[waypoints[0].lng, waypoints[0].lat]}
            zoomLevel={12}
            animationMode="flyTo"
            animationDuration={500}
          />
        )}

        {/* Route line */}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="trip-route-line" shape={routeGeoJSON}>
            <MapboxGL.LineLayer
              id="trip-route-line-layer"
              style={{
                lineColor: palette.accent500,
                lineWidth: 3,
                lineCap: 'round',
                lineJoin: 'round',
                lineDasharray: [2, 1.5],
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Waypoint markers */}
        {sortedWaypoints.map((wp) => {
          const wt = getWaypointIcon(wp.type);
          return (
            <MapboxGL.PointAnnotation key={wp.id} id={wp.id} coordinate={[wp.lng, wp.lat]}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: wt.color,
                  borderWidth: 2.5,
                  borderColor: palette.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <wt.Icon size={14} color={palette.white} />
              </View>
            </MapboxGL.PointAnnotation>
          );
        })}

        {/* Pending waypoint (ghost) */}
        {pendingCoord && (
          <MapboxGL.PointAnnotation
            id="pending-waypoint"
            coordinate={[pendingCoord.lng, pendingCoord.lat]}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: palette.accent500,
                borderWidth: 3,
                borderColor: palette.white,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
              }}
            >
              <MapPin size={16} color={palette.white} />
            </View>
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>

      {/* Floating back button */}
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
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={palette.white} />
        </Pressable>
      </View>

      {/* Floating map style toggle */}
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
          onPress={cycleMapStyle}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MapIcon size={18} color={palette.white} />
        </Pressable>
      </View>

      {/* Waypoint type picker — shown when a long-press is pending */}
      {pendingCoord && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{
            position: 'absolute',
            bottom: '50%',
            left: 0,
            right: 0,
          }}
        >
          <WaypointTypePicker selected={pendingType} onSelect={setPendingType} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 12,
              marginTop: 12,
            }}
          >
            <Pressable
              onPress={handleCancelPending}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.white }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirmWaypoint}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor: palette.accent500,
              }}
            >
              <Plus size={16} color={palette.white} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.white }}>
                Add Stop
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Bottom Sheet */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={['12%', '45%', '85%']}
        index={0}
        backgroundStyle={{
          backgroundColor: sheetBg,
          borderRadius: 24,
          borderCurve: 'continuous',
        }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? palette.neutral600 : palette.neutral300,
        }}
        enableDynamicSizing={false}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Collapsed header — always visible */}
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{ paddingHorizontal: 20, paddingBottom: 12 }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: titleColor }}>
              {title.trim() || 'New Trip'}
            </Text>
            <Text style={{ fontSize: 13, color: subtitleColor, marginTop: 2 }}>
              {waypoints.length === 0
                ? 'Long-press on the map to add stops'
                : `${waypoints.length} stop${waypoints.length === 1 ? '' : 's'} planned`}
            </Text>
          </Animated.View>

          {/* Stop list */}
          {sortedWaypoints.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              {sortedWaypoints.map((wp, index) => (
                <StopListItem
                  key={wp.id}
                  waypoint={wp}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === sortedWaypoints.length - 1}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  onDelete={() => handleDelete(wp.id)}
                />
              ))}
            </View>
          )}

          {/* Metadata form */}
          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            {/* Title input */}
            <Animated.View entering={FadeInUp.delay(0).duration(250)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
                Trip Title *
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Alps Adventure 2026"
                placeholderTextColor={placeholderColor}
                maxLength={100}
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: inputBorder,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: inputTextColor,
                }}
              />
            </Animated.View>

            {/* Description */}
            <Animated.View entering={FadeInUp.delay(50).duration(250)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your trip route, highlights, what to bring..."
                placeholderTextColor={placeholderColor}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={1000}
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: inputBorder,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: inputTextColor,
                  minHeight: 100,
                }}
              />
            </Animated.View>

            {/* Start date */}
            <Animated.View entering={FadeInUp.delay(100).duration(250)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
                Start Date
              </Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="e.g. 2026-06-15"
                placeholderTextColor={placeholderColor}
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: inputBorder,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: inputTextColor,
                }}
              />
              <Text style={{ fontSize: 11, color: subtitleColor, marginTop: 4 }}>
                ISO format for now — date picker coming soon
              </Text>
            </Animated.View>

            {/* End date */}
            <Animated.View entering={FadeInUp.delay(150).duration(250)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
                End Date
              </Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="e.g. 2026-06-22"
                placeholderTextColor={placeholderColor}
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: inputBorder,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: inputTextColor,
                }}
              />
            </Animated.View>

            {/* Difficulty */}
            <Animated.View entering={FadeInUp.delay(200).duration(250)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
                Difficulty
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {DIFFICULTIES.map((d) => {
                  const isSelected = difficulty === d.key;
                  const accentColor = DIFFICULTY_COLORS[d.key];
                  return (
                    <Pressable
                      key={d.key}
                      onPress={() => setDifficulty(d.key)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderCurve: 'continuous',
                        borderWidth: 1.5,
                        borderColor: isSelected ? accentColor : inputBorder,
                        backgroundColor: isSelected ? chipSelectedBg : chipBg,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected ? accentColor : subtitleColor,
                        }}
                      >
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* Max riders */}
            <Animated.View entering={FadeInUp.delay(250).duration(250)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
                Max Riders
              </Text>
              <TextInput
                value={maxRiders}
                onChangeText={(text) => setMaxRiders(text.replace(/[^0-9]/g, ''))}
                placeholder="10"
                placeholderTextColor={placeholderColor}
                keyboardType="number-pad"
                maxLength={3}
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: inputBorder,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: inputTextColor,
                  width: 100,
                }}
              />
            </Animated.View>

            {/* Error messages */}
            {(saveMutation.isError || publishMutation.isError) && (
              <Text style={{ fontSize: 13, color: palette.danger500, textAlign: 'center' }}>
                Something went wrong. Please try again.
              </Text>
            )}

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => saveMutation.mutate()}
                disabled={!isValid || isSaving}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: isValid ? palette.accent500 : 'transparent',
                  backgroundColor: isValid
                    ? 'transparent'
                    : isDark
                      ? palette.neutral800
                      : palette.neutral300,
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={palette.accent500} />
                ) : (
                  <>
                    <Save size={16} color={isValid ? palette.accent500 : palette.white} />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: isValid ? palette.accent500 : palette.white,
                      }}
                    >
                      Save Draft
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={() => publishMutation.mutate()}
                disabled={!isValid || isSaving}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: isValid
                    ? palette.accent500
                    : isDark
                      ? palette.neutral800
                      : palette.neutral300,
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {publishMutation.isPending ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <>
                    <Send size={16} color={palette.white} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                      Publish
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
