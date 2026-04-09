import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import {
  CreateTripWithWaypointsDocument,
  PublishTripDocument,
  TripDetailDocument,
  UpdateTripDocument,
} from '@motovault/graphql';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapboxGL, { type ScreenPointPayload } from '@rnmapbox/maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Map as MapIcon,
  Save,
  Send,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView as RNScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GeocodingSearchBar } from '../../components/geocoding-search-bar';
import { StopListItem } from '../../components/trip/stop-list-item';
import { getWaypointIcon, WaypointTypePicker } from '../../components/trip/waypoint-type-picker';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { MAP_STYLES, type MapStyle } from '../../utils/map-styles';
import { getRouteSegments, type RouteLeg } from '../../utils/mapbox-directions';
import type { GeocodingResult } from '../../utils/mapbox-geocoding';

type Difficulty = 'easy' | 'moderate' | 'challenging' | 'expert';

interface LocalWaypoint {
  id: string;
  type: string;
  name: string;
  lat: number;
  lng: number;
  notes?: string;
  sortOrder: number;
  dayIndex: number;
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
  expert: palette.danger500,
} as const;

function formatSegmentDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatSegmentDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function formatDayDate(startDate: Date, dayIndex: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
  const params = useLocalSearchParams<{ tripId?: string }>();
  const isEditMode = !!params.tripId;
  const sheetRef = useRef<BottomSheet>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // Fetch existing trip data when in edit mode
  const tripQuery = useQuery({
    queryKey: ['trip-edit', params.tripId],
    queryFn: () => gqlFetcher(TripDetailDocument, { tripId: params.tripId! }),
    enabled: isEditMode,
  });

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

  // Waypoints
  const [waypoints, setWaypoints] = useState<LocalWaypoint[]>([]);
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);
  const routeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recalculate route segments when waypoints change
  useEffect(() => {
    if (routeDebounceRef.current) clearTimeout(routeDebounceRef.current);

    if (waypoints.length < 2) {
      setRouteLegs([]);
      setRouteGeometry(null);
      return;
    }

    routeDebounceRef.current = setTimeout(async () => {
      const sorted = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
      const coords = sorted.map((wp) => ({ lat: wp.lat, lng: wp.lng }));
      const result = await getRouteSegments(coords);
      if (result) {
        setRouteLegs(result.legs);
        setRouteGeometry(result.geometry);
      }
    }, 800);

    return () => {
      if (routeDebounceRef.current) clearTimeout(routeDebounceRef.current);
    };
  }, [waypoints]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(18, 0, 0, 0);
    return d;
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate');
  const [maxRiders, setMaxRiders] = useState('10');

  // Pre-populate state from fetched trip in edit mode
  const [editDataLoaded, setEditDataLoaded] = useState(false);
  useEffect(() => {
    if (!isEditMode || editDataLoaded || !tripQuery.data) return;
    const trip = tripQuery.data.tripDetail;
    setTitle(trip.title);
    setDescription(trip.description);
    setDifficulty(trip.difficulty as Difficulty);
    setMaxRiders(String(trip.maxRiders));
    setStartDate(new Date(`${trip.startDate}T09:00:00`));
    setEndDate(new Date(`${trip.endDate}T18:00:00`));
    if (trip.waypoints) {
      const mapped: LocalWaypoint[] = trip.waypoints.map((wp) => ({
        id: wp.id,
        type: wp.type,
        name: wp.name,
        lat: wp.lat,
        lng: wp.lng,
        notes: wp.notes ?? undefined,
        sortOrder: wp.sortOrder,
        dayIndex: wp.dayIndex,
      }));
      setWaypoints(mapped);
    }
    setEditDataLoaded(true);
  }, [isEditMode, editDataLoaded, tripQuery.data]);

  // Edit stop modal state
  const [editingWaypoint, setEditingWaypoint] = useState<LocalWaypoint | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const openEditModal = useCallback((wp: LocalWaypoint) => {
    setEditName(wp.name);
    setEditType(wp.type);
    setEditNotes(wp.notes ?? '');
    setEditingWaypoint(wp);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingWaypoint(null);
  }, []);

  const applyEdit = useCallback(() => {
    if (!editingWaypoint) return;
    setWaypoints((prev) =>
      prev.map((wp) =>
        wp.id === editingWaypoint.id
          ? {
              ...wp,
              name: editName.trim() || wp.name,
              type: editType,
              notes: editNotes.trim() || undefined,
            }
          : wp,
      ),
    );
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingWaypoint(null);
  }, [editingWaypoint, editName, editType, editNotes]);

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    startDate <= endDate &&
    waypoints.length >= 2;

  // Route line GeoJSON — use actual road geometry when available, fallback to straight lines
  const routeGeoJSON = useMemo(() => {
    if (waypoints.length < 2) return null;
    if (routeGeometry) {
      return {
        type: 'Feature' as const,
        geometry: routeGeometry,
        properties: {},
      };
    }
    // Straight-line fallback while Directions API is loading
    const sorted = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: sorted.map((wp) => [wp.lng, wp.lat]),
      },
      properties: {},
    };
  }, [waypoints, routeGeometry]);

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

  // Add a waypoint and fly the camera to it
  const addWaypoint = useCallback((wp: Omit<LocalWaypoint, 'id'>) => {
    const newWp: LocalWaypoint = { ...wp, id: tempId() };
    setWaypoints((prev) => [...prev, newWp]);
    trackEvent(AnalyticsEvent.TRIP_WAYPOINT_ADDED, {
      waypoint_type: wp.type,
      waypoint_index: wp.sortOrder,
    });
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Fly camera to new waypoint
    cameraRef.current?.flyTo([wp.lng, wp.lat], 500);
  }, []);

  // Geocoding search result handler
  const handleGeocodingSelect = useCallback(
    (result: GeocodingResult) => {
      addWaypoint({
        type: 'scenic',
        name: result.name,
        lat: result.lat,
        lng: result.lng,
        notes: '',
        sortOrder: waypoints.length,
        dayIndex: 0,
      });
    },
    [addWaypoint, waypoints.length],
  );

  // Map long-press handler — adds a scenic waypoint directly
  const handleLongPress = useCallback(
    (event: GeoJSON.Feature<GeoJSON.Point, ScreenPointPayload>) => {
      const [lng, lat] = event.geometry.coordinates;
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addWaypoint({
        type: 'scenic',
        name: `Stop ${waypoints.length + 1}`,
        lat,
        lng,
        notes: '',
        sortOrder: waypoints.length,
        dayIndex: 0,
      });
    },
    [addWaypoint, waypoints.length],
  );

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
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      difficulty,
      maxRiders: Number.parseInt(maxRiders, 10) || 10,
      waypoints: sorted.map((wp) => ({
        sortOrder: wp.sortOrder,
        type: wp.type,
        name: wp.name,
        notes: wp.notes || undefined,
        lat: wp.lat,
        lng: wp.lng,
        dayIndex: wp.dayIndex,
      })),
    };
  }, [title, description, startDate, endDate, difficulty, maxRiders, waypoints]);

  // Save draft mutation
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

  // Publish mutation
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

  // Update mutation (edit mode)
  const updateMutation = useMutation({
    mutationFn: async () => {
      await gqlFetcher(UpdateTripDocument, {
        input: {
          tripId: params.tripId!,
          title: title.trim(),
          description: description.trim(),
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          difficulty,
          maxRiders: Number.parseInt(maxRiders, 10) || 10,
        },
      });
    },
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(params.tripId!) });
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to update trip. Please try again.');
    },
  });

  const isSaving = saveMutation.isPending || publishMutation.isPending || updateMutation.isPending;
  const sortedWaypoints = useMemo(
    () => [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder),
    [waypoints],
  );

  // Day-based organization
  const numDays = useMemo(() => {
    const msPerDay = 86400000;
    return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1);
  }, [startDate, endDate]);

  const waypointsByDay = useMemo(() => {
    const groups: Record<number, LocalWaypoint[]> = {};
    for (let d = 0; d < numDays; d++) groups[d] = [];
    for (const wp of sortedWaypoints) {
      const d = Math.min(wp.dayIndex, numDays - 1);
      if (!groups[d]) groups[d] = [];
      groups[d].push(wp);
    }
    return groups;
  }, [sortedWaypoints, numDays]);

  // Move waypoint to a different day
  const handleMoveDay = useCallback(
    (waypointId: string) => {
      const dayOptions = Array.from(
        { length: numDays },
        (_, i) => `Day ${i + 1} — ${formatDayDate(startDate, i)}`,
      );

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [...dayOptions, 'Cancel'],
            cancelButtonIndex: dayOptions.length,
            title: 'Move to Day',
          },
          (buttonIndex) => {
            if (buttonIndex < dayOptions.length) {
              setWaypoints((prev) =>
                prev.map((wp) => (wp.id === waypointId ? { ...wp, dayIndex: buttonIndex } : wp)),
              );
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
        );
      } else {
        Alert.alert('Move to Day', 'Select a day for this stop', [
          ...dayOptions.map((label, i) => ({
            text: label,
            onPress: () => {
              setWaypoints((prev) =>
                prev.map((wp) => (wp.id === waypointId ? { ...wp, dayIndex: i } : wp)),
              );
            },
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      }
    },
    [numDays, startDate],
  );

  // Proximity for geocoding — center of existing waypoints or undefined
  const searchProximity = useMemo(() => {
    if (waypoints.length === 0) return undefined;
    const avgLat = waypoints.reduce((sum, wp) => sum + wp.lat, 0) / waypoints.length;
    const avgLng = waypoints.reduce((sum, wp) => sum + wp.lng, 0) / waypoints.length;
    return { lat: avgLat, lng: avgLng };
  }, [waypoints]);

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
        <MapboxGL.Camera
          ref={cameraRef}
          {...(bounds && waypoints.length >= 2
            ? {
                bounds: {
                  ...bounds,
                  paddingBottom: 200,
                  paddingTop: 80,
                  paddingLeft: 40,
                  paddingRight: 40,
                },
                animationMode: 'flyTo' as const,
                animationDuration: 500,
              }
            : waypoints.length === 1
              ? {
                  centerCoordinate: [waypoints[0].lng, waypoints[0].lat],
                  zoomLevel: 12,
                  animationMode: 'flyTo' as const,
                  animationDuration: 500,
                }
              : {})}
        />

        {/* Route line */}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="trip-route-line" shape={routeGeoJSON}>
            <MapboxGL.LineLayer
              id="trip-route-line-layer"
              style={{
                lineColor: palette.accent500,
                lineWidth: routeGeometry ? 4 : 3,
                lineCap: 'round',
                lineJoin: 'round',
                ...(routeGeometry ? {} : { lineDasharray: [2, 1.5] }),
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
          {/* Collapsed header */}
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{ paddingHorizontal: 20, paddingBottom: 12 }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: titleColor }}>
              {title.trim() || (isEditMode ? 'Edit Trip' : 'New Trip')}
            </Text>
            <Text style={{ fontSize: 13, color: subtitleColor, marginTop: 2 }}>
              {waypoints.length === 0
                ? 'Search or long-press the map to add stops'
                : `${waypoints.length} stop${waypoints.length === 1 ? '' : 's'} planned`}
            </Text>
          </Animated.View>

          {/* Geocoding search bar */}
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <GeocodingSearchBar
              onSelect={handleGeocodingSelect}
              placeholder="Search for a stop..."
              isDark={isDark}
              proximity={searchProximity}
            />
          </View>

          {/* Day-by-day stop list */}
          {sortedWaypoints.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              {Array.from({ length: numDays }, (_, dayIndex) => {
                const dayWaypoints = waypointsByDay[dayIndex] ?? [];

                // Compute day stats from route legs for stops in this day
                let dayDistanceM = 0;
                let dayDurationS = 0;
                for (const wp of dayWaypoints) {
                  const globalIdx = sortedWaypoints.indexOf(wp);
                  if (globalIdx > 0 && routeLegs[globalIdx - 1]) {
                    dayDistanceM += routeLegs[globalIdx - 1].distanceM;
                    dayDurationS += routeLegs[globalIdx - 1].durationS;
                  }
                }
                const dayHours = dayDurationS / 3600;
                const rideTimeColor =
                  dayHours > 6
                    ? palette.danger500
                    : dayHours > 4
                      ? palette.warning500
                      : palette.success500;

                return (
                  <View key={`day-${formatDayDate(startDate, dayIndex)}`}>
                    {/* Day header */}
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: isDark ? palette.surfaceElevated : palette.neutral100,
                        borderRadius: 12,
                        borderCurve: 'continuous',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        marginTop: dayIndex > 0 ? 16 : 0,
                        marginBottom: 8,
                        marginHorizontal: 20,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Calendar size={16} color={titleColor} />
                        <Text style={{ fontSize: 15, fontWeight: '700', color: titleColor }}>
                          Day {dayIndex + 1} · {formatDayDate(startDate, dayIndex)}
                        </Text>
                      </View>
                      {dayWaypoints.length > 0 && dayDurationS > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: subtitleColor }}>
                            {formatSegmentDistance(dayDistanceM)}
                          </Text>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: rideTimeColor }}>
                            {formatSegmentDuration(dayDurationS)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Day's stops */}
                    {dayWaypoints.length > 0 ? (
                      dayWaypoints.map((wp) => {
                        const globalIdx = sortedWaypoints.indexOf(wp);
                        return (
                          <StopListItem
                            key={wp.id}
                            waypoint={wp}
                            index={globalIdx}
                            isFirst={globalIdx === 0}
                            isLast={globalIdx === sortedWaypoints.length - 1}
                            onMoveUp={() => handleMoveUp(globalIdx)}
                            onMoveDown={() => handleMoveDown(globalIdx)}
                            onDelete={() => handleDelete(wp.id)}
                            onPress={() => openEditModal(wp)}
                            onMoveDay={() => handleMoveDay(wp.id)}
                            distance={
                              globalIdx > 0 && routeLegs[globalIdx - 1]
                                ? formatSegmentDistance(routeLegs[globalIdx - 1].distanceM)
                                : undefined
                            }
                            duration={
                              globalIdx > 0 && routeLegs[globalIdx - 1]
                                ? formatSegmentDuration(routeLegs[globalIdx - 1].durationS)
                                : undefined
                            }
                          />
                        );
                      })
                    ) : (
                      <Text
                        style={{
                          fontSize: 13,
                          color: subtitleColor,
                          fontStyle: 'italic',
                          textAlign: 'center',
                          paddingVertical: 12,
                          paddingHorizontal: 20,
                        }}
                      >
                        No stops yet
                      </Text>
                    )}
                  </View>
                );
              })}
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

            {/* Dates */}
            <Animated.View entering={FadeInUp.delay(100).duration(250)}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}
                  >
                    Start Date
                  </Text>
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(_e, d) => {
                      if (d) {
                        setStartDate(d);
                        if (d > endDate) setEndDate(d);
                      }
                    }}
                    themeVariant={isDark ? 'dark' : 'light'}
                    accentColor={palette.signature500}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}
                  >
                    End Date
                  </Text>
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    minimumDate={startDate}
                    onChange={(_e, d) => d && setEndDate(d)}
                    themeVariant={isDark ? 'dark' : 'light'}
                    accentColor={palette.signature500}
                  />
                </View>
              </View>
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
            {(saveMutation.isError || publishMutation.isError || updateMutation.isError) && (
              <Text style={{ fontSize: 13, color: palette.danger500, textAlign: 'center' }}>
                Something went wrong. Please try again.
              </Text>
            )}

            {/* Published trip warning banner (edit mode only) */}
            {isEditMode && tripQuery.data?.tripDetail.status === 'published' && (
              <Animated.View
                entering={FadeIn.duration(250)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: isDark ? palette.warningBgDark : palette.warningBgLight,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                }}
              >
                <AlertTriangle size={16} color={palette.warning500} />
                <Text style={{ fontSize: 13, color: palette.warning500, flex: 1 }}>
                  Editing a published trip. Changes will be visible to participants.
                </Text>
              </Animated.View>
            )}

            {/* Action buttons */}
            {isEditMode ? (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <Pressable
                  onPress={() => router.back()}
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
                    borderColor: isDark ? palette.neutral600 : palette.neutral300,
                    backgroundColor: 'transparent',
                  }}
                >
                  <X size={16} color={subtitleColor} />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: subtitleColor,
                    }}
                  >
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => updateMutation.mutate()}
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
                  {updateMutation.isPending ? (
                    <ActivityIndicator size="small" color={palette.white} />
                  ) : (
                    <>
                      <Save size={16} color={palette.white} />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                        Save Changes
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
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
            )}
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Edit Stop Modal */}
      <Modal
        visible={editingWaypoint !== null}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={closeEditModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: isDark ? palette.neutral950 : palette.white,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: titleColor,
              }}
            >
              Edit Stop
            </Text>
            <Pressable
              onPress={closeEditModal}
              hitSlop={12}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} color={isDark ? palette.neutral400 : palette.neutral500} />
            </Pressable>
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: isDark ? palette.surfaceElevated : palette.neutral200,
              marginHorizontal: 20,
            }}
          />

          <RNScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 40,
              gap: 20,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: labelColor,
                  marginBottom: 6,
                }}
              >
                Name
              </Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Stop name"
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
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: isDark ? palette.surfaceElevated : palette.neutral200,
              }}
            />

            {/* Type */}
            <View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: labelColor,
                  marginBottom: 6,
                }}
              >
                Type
              </Text>
              <WaypointTypePicker selected={editType} onSelect={setEditType} />
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: isDark ? palette.surfaceElevated : palette.neutral200,
              }}
            />

            {/* Notes */}
            <View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: labelColor,
                  marginBottom: 6,
                }}
              >
                Notes
              </Text>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Add notes about this stop..."
                placeholderTextColor={placeholderColor}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
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
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: isDark ? palette.surfaceElevated : palette.neutral200,
              }}
            />

            {/* Done button */}
            <Pressable
              onPress={applyEdit}
              style={{
                paddingVertical: 14,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: palette.signature500,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: palette.white,
                }}
              >
                Done
              </Text>
            </Pressable>
          </RNScrollView>
        </View>
      </Modal>
    </View>
  );
}
