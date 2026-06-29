import DateTimePicker from '@expo/ui/community/datetime-picker';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { PeriodOfDay } from '@motovault/graphql';
import MapboxGL, { type ScreenPointPayload } from '@rnmapbox/maps';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronDown,
  EyeOff,
  Globe,
  Info,
  Lock,
  type LucideIcon,
  Map as MapIcon,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView as RNScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GeocodingSearchBar } from '../../components/geocoding-search-bar';
import { StopListItem } from '../../components/trip/stop-list-item';
import { WaypointMarker } from '../../components/trip/waypoint-marker';
import { WaypointTypePicker } from '../../components/trip/waypoint-type-picker';
import { FloatingIconButton } from '../../components/ui/floating-icon-button';
import { useCreateTripData } from '../../hooks/use-create-trip-data';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { userFriendlyError } from '../../lib/graphql-errors';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { showActionSheet } from '../../utils/action-sheet';
import {
  cycleMapStyle as cycleMapStyleFn,
  getDefaultMapStyle,
  MAP_STYLES,
} from '../../utils/map-styles';
import { getRouteSegments, type RouteLeg } from '../../utils/mapbox-directions';
import type { GeocodingResult } from '../../utils/mapbox-geocoding';
import { groupByPeriod, PERIOD_HINT, PERIOD_LABEL } from '../../utils/period-of-day';
import {
  datesForClonedTemplate,
  getDefaultNewTripDateRange,
  safeTripDatesFromApi,
  validateTripFormDateRangeForSave,
} from '../../utils/trip-form-dates';

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
  periodOfDay?: 'morning' | 'afternoon' | 'evening' | null;
}

type TI18n = (key: string, opts?: Record<string, unknown>) => string;

function getDifficulties(i18n: TI18n): { key: Difficulty; label: string }[] {
  return [
    { key: 'easy', label: i18n('trips.difficultyLabelEasy') },
    { key: 'moderate', label: i18n('trips.difficultyLabelModerate') },
    { key: 'challenging', label: i18n('trips.difficultyLabelChallenging') },
    { key: 'expert', label: i18n('trips.difficultyLabelExpert') },
  ];
}

type Visibility = 'private' | 'unlisted' | 'public';

function getVisibilityOptions(
  i18n: TI18n,
): { key: Visibility; label: string; description: string; icon: LucideIcon }[] {
  // Icons mirror the viewer badge in trip-detail.tsx (Lock / EyeOff / Globe) so
  // the picker and the badge teach one visual vocabulary for the same states.
  return [
    {
      key: 'private',
      label: i18n('trips.visibilityPrivate'),
      description: i18n('trips.visibilityPrivateDesc'),
      icon: Lock,
    },
    {
      key: 'unlisted',
      label: i18n('trips.visibilityUnlisted'),
      description: i18n('trips.visibilityUnlistedDesc'),
      icon: EyeOff,
    },
    {
      key: 'public',
      label: i18n('trips.visibilityPublic'),
      description: i18n('trips.visibilityPublicDesc'),
      icon: Globe,
    },
  ];
}

// Difficulty colors are computed inside the component using editorial tokens (t.success, t.warm, t.danger)

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
  const { t, isDark } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    tripId?: string;
    cloneFromTripId?: string;
    mode?: string;
  }>();
  const isEditMode = !!params.tripId;
  const isCloneMode = !!params.cloneFromTripId && !params.tripId;
  const sourceTripId = params.tripId ?? params.cloneFromTripId;
  const sheetRef = useRef<BottomSheet>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);

  const reducedMotion = useReducedMotion();
  const [showDetails, setShowDetails] = useState(isEditMode || isCloneMode);
  const chevronRotation = useSharedValue(isEditMode || isCloneMode ? 180 : 0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  // Difficulty colors — editorial tokens
  const difficultyColors: Record<Difficulty, string> = {
    easy: t.success,
    moderate: t.warm,
    challenging: t.danger,
    expert: t.danger,
  };

  // Theme colors — editorial tokens
  const bg = t.bg;
  const titleColor = t.ink;
  const subtitleColor = t.ink3;
  const inputBg = t.surface2;
  const inputBorder = t.line;
  const inputTextColor = t.ink;
  const placeholderColor = t.ink4;
  const labelColor = t.ink2;
  const chipBg = t.surface2;
  const chipSelectedBg = t.surface;
  const sheetBg = t.surface;

  // Map state
  const [mapStyle, setMapStyle] = useState(() => getDefaultMapStyle(isDark));
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Center map on user location for new trips (not edit/clone)
  useEffect(() => {
    if (isEditMode || isCloneMode) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getLastKnownPositionAsync();
      if (!cancelled && pos) {
        setUserLocation([pos.coords.longitude, pos.coords.latitude]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, isCloneMode]);

  // Waypoints
  const [waypoints, setWaypoints] = useState<LocalWaypoint[]>([]);
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);

  // Recalculate route segments when waypoints change (with cancellation)
  useEffect(() => {
    if (waypoints.length < 2) {
      setRouteLegs([]);
      setRouteGeometry(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const sorted = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
      const coords = sorted.map((wp) => ({ lat: wp.lat, lng: wp.lng }));
      const result = await getRouteSegments(coords, controller.signal);
      if (!controller.signal.aborted && result) {
        setRouteLegs(result.legs);
        setRouteGeometry(result.geometry);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
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
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [maxRiders, setMaxRiders] = useState('10');

  // Planner mode: "planning" is the dated future-ride flow; "showcase"
  // ("Already rode it") is a dateless past trip parameterised by a day count.
  const [mode, setMode] = useState<'planning' | 'showcase'>(
    params.mode === 'showcase' ? 'showcase' : 'planning',
  );
  const isShowcase = mode === 'showcase';
  // Standalone day count for showcase mode (planning mode derives days from the
  // date span instead). Min 1, capped at 14 like the planning "add a day".
  const [showcaseDayCount, setShowcaseDayCount] = useState(1);

  // Android: DateTimePicker renders as a dialog, so show only on press
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Build the batch input shared by save and publish
  const buildTripInput = useCallback(() => {
    const sorted = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
    // Ensure first waypoint is 'start' and last is 'end' so Zod validation passes.
    // Users add stops via search/long-press which default to 'scenic'.
    const hasStart = sorted.some((w) => w.type === 'start');
    const hasEnd = sorted.some((w) => w.type === 'end');
    return {
      title: title.trim(),
      description: description.trim(),
      // Showcase ("Already rode it") is dateless: send isShowcase + dayCount and
      // omit the date range (the API stores sentinel dates + dates_pending).
      ...(isShowcase
        ? { isShowcase: true, dayCount: showcaseDayCount }
        : {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          }),
      difficulty,
      maxRiders: Number.parseInt(maxRiders, 10) || 10,
      visibility,
      waypoints: sorted.map((wp, i) => ({
        sortOrder: wp.sortOrder,
        type: !hasStart && i === 0 ? 'start' : !hasEnd && i === sorted.length - 1 ? 'end' : wp.type,
        name: wp.name,
        notes: wp.notes || undefined,
        lat: wp.lat,
        lng: wp.lng,
        dayIndex: wp.dayIndex,
        // LocalWaypoint models periodOfDay as the string union for editor
        // state; the GraphQL input expects the generated PeriodOfDay enum.
        // The string values are identical, so a narrow cast is safe.
        periodOfDay: (wp.periodOfDay ?? null) as PeriodOfDay | null,
      })),
    };
  }, [
    title,
    description,
    isShowcase,
    showcaseDayCount,
    startDate,
    endDate,
    difficulty,
    maxRiders,
    visibility,
    waypoints,
  ]);

  // Data layer (queries + mutations) extracted to a colocated hook.
  const {
    tripQuery,
    saveMutation,
    publishMutation,
    updateMutation,
    updateAndPublishMutation,
    deleteMutation,
  } = useCreateTripData({
    sourceTripId,
    tripId: params.tripId,
    buildTripInput,
    difficulty,
    waypointCount: waypoints.length,
    maxRiders,
    router,
  });

  // Pre-populate state from fetched trip in edit OR clone mode.
  // Clone mode rehydrates the shape of another trip (waypoints, description,
  // difficulty) but leaves the title obvious ("Copy of …") and strips IDs so
  // we insert a brand-new trip on save.
  const [editDataLoaded, setEditDataLoaded] = useState(false);
  useEffect(() => {
    if (editDataLoaded || !tripQuery.data) return;
    if (!isEditMode && !isCloneMode) return;
    const trip = tripQuery.data.tripDetail;
    setTitle(isCloneMode ? `Copy of ${trip.title}` : trip.title);
    setDescription(trip.description);
    setDifficulty(trip.difficulty as Difficulty);
    setMaxRiders(String(trip.maxRiders));
    // Editing an existing dateless trip re-enters showcase mode. (Clone mode
    // always opens in planning mode with synthesized dates, even from a dateless
    // template — the cloner is planning their own ride.)
    if (isEditMode && trip.datesPending) {
      setMode('showcase');
      if (trip.dayCount && trip.dayCount > 0) setShowcaseDayCount(trip.dayCount);
    }
    if (isEditMode) {
      const fromApi = safeTripDatesFromApi(trip.startDate, trip.endDate);
      if (fromApi.ok) {
        setStartDate(fromApi.start);
        setEndDate(fromApi.end);
      } else {
        const { start, end } = getDefaultNewTripDateRange();
        setStartDate(start);
        setEndDate(end);
      }
    } else if (isCloneMode) {
      if (trip.isTemplate) {
        const { start, end } = datesForClonedTemplate(trip.dayCount);
        setStartDate(start);
        setEndDate(end);
      } else {
        const fromApi = safeTripDatesFromApi(trip.startDate, trip.endDate);
        if (fromApi.ok) {
          setStartDate(fromApi.start);
          setEndDate(fromApi.end);
        } else {
          const { start, end } = getDefaultNewTripDateRange();
          setStartDate(start);
          setEndDate(end);
        }
      }
    }
    if (trip.visibility) {
      // A cloned trip starts private — user opts back into public explicitly.
      setVisibility(isCloneMode ? 'private' : (trip.visibility as Visibility));
    }
    if (trip.waypoints) {
      const mapped: LocalWaypoint[] = trip.waypoints.map((wp) => ({
        // Clone mode: swap in local temp IDs so the upsert treats these as
        // net-new rows on save instead of trying to update the source trip.
        id: isCloneMode ? tempId() : wp.id,
        type: wp.type,
        name: wp.name,
        lat: wp.lat,
        lng: wp.lng,
        notes: wp.notes ?? undefined,
        sortOrder: wp.sortOrder,
        dayIndex: wp.dayIndex,
        periodOfDay: (wp as { periodOfDay?: 'morning' | 'afternoon' | 'evening' | null })
          .periodOfDay,
      }));
      setWaypoints(mapped);
    }
    setEditDataLoaded(true);
  }, [isEditMode, isCloneMode, editDataLoaded, tripQuery.data]);

  // Edit stop modal state
  const [editingWaypoint, setEditingWaypoint] = useState<LocalWaypoint | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPeriod, setEditPeriod] = useState<'morning' | 'afternoon' | 'evening' | null>(null);

  const openEditModal = useCallback((wp: LocalWaypoint) => {
    setEditName(wp.name);
    setEditType(wp.type);
    setEditNotes(wp.notes ?? '');
    setEditPeriod(wp.periodOfDay ?? null);
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
              periodOfDay: editPeriod,
            }
          : wp,
      ),
    );
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingWaypoint(null);
  }, [editingWaypoint, editName, editType, editNotes, editPeriod]);

  const dateRangeError = useMemo(
    () => validateTripFormDateRangeForSave(startDate, endDate),
    [startDate, endDate],
  );

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    waypoints.length >= 2 &&
    // Showcase mode has no dates to validate.
    (isShowcase || (!dateRangeError && startDate <= endDate));

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
  // Default day for new waypoints: last day that has waypoints, or last day overall
  const defaultDayIndex = useMemo(() => {
    if (waypoints.length === 0) return 0;
    return Math.max(...waypoints.map((w) => w.dayIndex));
  }, [waypoints]);

  const handleGeocodingSelect = useCallback(
    (result: GeocodingResult) => {
      const type = waypoints.length === 0 ? 'start' : waypoints.length === 1 ? 'end' : 'scenic';
      addWaypoint({
        type,
        name: result.name,
        lat: result.lat,
        lng: result.lng,
        notes: '',
        sortOrder: waypoints.length,
        dayIndex: defaultDayIndex,
      });
    },
    [addWaypoint, waypoints.length, defaultDayIndex],
  );

  // Map long-press handler — adds a scenic waypoint directly
  const handleLongPress = useCallback(
    (event: GeoJSON.Feature<GeoJSON.Point, ScreenPointPayload>) => {
      const [lng, lat] = event.geometry.coordinates;
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const type = waypoints.length === 0 ? 'start' : waypoints.length === 1 ? 'end' : 'scenic';
      addWaypoint({
        type,
        name: `Stop ${waypoints.length + 1}`,
        lat,
        lng,
        notes: '',
        sortOrder: waypoints.length,
        dayIndex: defaultDayIndex,
      });
    },
    [addWaypoint, waypoints.length, defaultDayIndex],
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
  const handleDeleteWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => {
      const filtered = prev.filter((wp) => wp.id !== id);
      return filtered.map((wp, i) => ({ ...wp, sortOrder: i }));
    });
  }, []);

  // Cycle map style
  const cycleMapStyle = useCallback(() => {
    // Compute next outside the state updater (StrictMode double-fire guard, B2).
    const next = cycleMapStyleFn(mapStyle);
    trackEvent(AnalyticsEvent.RIDE_MAP_STYLE_CHANGED, {
      from_style: mapStyle,
      to_style: next,
      surface: 'create_trip',
    });
    setMapStyle(next);
  }, [mapStyle]);

  const handleAddDay = useCallback(() => {
    if (isShowcase) {
      setShowcaseDayCount((prev) => Math.min(14, prev + 1));
    } else {
      setEndDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 1);
        return d;
      });
    }
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isShowcase]);

  const selectMode = useCallback(
    (next: 'planning' | 'showcase') => {
      setMode((prev) => {
        if (prev === next) return prev;
        if (next === 'showcase') {
          // Seed the day count from the current date-derived span so a multi-day
          // plan keeps its days when the dates disappear.
          const msPerDay = 86400000;
          const span = Math.max(
            1,
            Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1,
          );
          setShowcaseDayCount(span);
        } else {
          // Returning to planning needs a valid default range to save against.
          const { start, end } = getDefaultNewTripDateRange();
          setStartDate(start);
          setEndDate(end);
        }
        return next;
      });
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [startDate, endDate],
  );

  const handleDeleteTrip = useCallback(() => {
    Alert.alert(
      'Delete this trip?',
      "The route, every stop, and all the riders on it will be gone. Can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  }, [deleteMutation]);

  const isSaving =
    saveMutation.isPending ||
    publishMutation.isPending ||
    updateMutation.isPending ||
    updateAndPublishMutation.isPending ||
    deleteMutation.isPending;

  const tripStatus = tripQuery.data?.tripDetail.status;
  const isEditingDraft = isEditMode && tripStatus === 'draft';
  const sortedWaypoints = useMemo(
    () => [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder),
    [waypoints],
  );

  // Day-based organization
  const numDays = useMemo(() => {
    if (isShowcase) return Math.max(1, showcaseDayCount);
    const msPerDay = 86400000;
    return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1);
  }, [isShowcase, showcaseDayCount, startDate, endDate]);

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
      const dayOptions = Array.from({ length: numDays }, (_, i) =>
        isShowcase ? `Day ${i + 1}` : `Day ${i + 1} — ${formatDayDate(startDate, i)}`,
      );

      showActionSheet(
        'Move to Day',
        [
          ...dayOptions.map((label, i) => ({
            label,
            onPress: () => {
              setWaypoints((prev) =>
                prev.map((wp) => (wp.id === waypointId ? { ...wp, dayIndex: i } : wp)),
              );
            },
          })),
          { label: 'Cancel', onPress: () => {}, style: 'cancel' as const },
        ],
        'Select a day for this stop',
      );
    },
    [numDays, startDate, isShowcase],
  );

  // Proximity for geocoding — center of existing waypoints or undefined
  const searchProximity = useMemo(() => {
    if (waypoints.length === 0) return undefined;
    const avgLat = waypoints.reduce((sum, wp) => sum + wp.lat, 0) / waypoints.length;
    const avgLng = waypoints.reduce((sum, wp) => sum + wp.lng, 0) / waypoints.length;
    return { lat: avgLat, lng: avgLng };
  }, [waypoints]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        {/* Full-screen map */}
        <MapboxGL.MapView
          style={{ flex: 1 }}
          styleURL={MAP_STYLES[mapStyle]}
          surfaceView={process.env.EXPO_OS !== 'android'}
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
                : userLocation
                  ? {
                      centerCoordinate: userLocation,
                      zoomLevel: 10,
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
                  lineColor: t.warm,
                  lineWidth: routeGeometry ? 4 : 3,
                  lineCap: 'round',
                  lineJoin: 'round',
                  ...(routeGeometry ? {} : { lineDasharray: [2, 1.5] }),
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          {/* Waypoint markers */}
          {sortedWaypoints.map((wp) => (
            <MapboxGL.MarkerView key={wp.id} id={wp.id} coordinate={[wp.lng, wp.lat]}>
              <WaypointMarker type={wp.type} />
            </MapboxGL.MarkerView>
          ))}
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
          <FloatingIconButton
            onPress={() => router.back()}
            accessibilityLabel={i18n('common.back')}
            icon={<ArrowLeft size={20} color={t.ink} />}
          />
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
          <FloatingIconButton
            onPress={cycleMapStyle}
            accessibilityLabel={i18n('trips.changeMapStyle')}
            icon={<MapIcon size={18} color={t.ink} />}
          />
        </View>

        {/* Bottom Sheet */}
        <BottomSheet
          ref={sheetRef}
          snapPoints={['35%', '65%', '90%']}
          index={0}
          backgroundStyle={{
            backgroundColor: sheetBg,
            borderRadius: 24,
            borderCurve: 'continuous',
          }}
          handleIndicatorStyle={{
            backgroundColor: t.line,
          }}
          enableDynamicSizing={false}
        >
          <BottomSheetScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Collapsed header */}
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(200)}
              style={{ paddingHorizontal: 20, paddingBottom: 12 }}
            >
              <Text
                style={{ fontFamily: 'InstrumentSerif-Regular', fontSize: 22, color: titleColor }}
              >
                {title.trim() || (isEditMode ? 'Edit Trip' : 'New Trip')}
              </Text>
              <Text style={{ fontSize: 13, color: subtitleColor, marginTop: 2 }}>
                {waypoints.length === 0
                  ? 'Search or long-press the map to add stops'
                  : `${waypoints.length} stop${waypoints.length === 1 ? '' : 's'} planned`}
              </Text>
            </Animated.View>

            {/* Trip title — metadata-first, above the stop list */}
            {/* Mode toggle: planning a future ride vs showcasing one already ridden */}
            <Animated.View
              entering={reducedMotion ? undefined : FadeInUp.duration(250)}
              style={{ paddingHorizontal: 20, marginTop: 4, marginBottom: 16 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: inputBorder,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  padding: 4,
                  gap: 4,
                }}
              >
                {[
                  { key: 'planning' as const, label: i18n('trips.modePlanning') },
                  { key: 'showcase' as const, label: i18n('trips.modeShowcase') },
                ].map((opt) => {
                  const selected = mode === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => selectMode(opt.key)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 9,
                        borderCurve: 'continuous',
                        alignItems: 'center',
                        backgroundColor: selected ? t.warm : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: selected ? '#fff' : inputTextColor,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View
              entering={reducedMotion ? undefined : FadeInUp.delay(0).duration(250)}
              style={{ paddingHorizontal: 20, marginBottom: 16 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
                {i18n('trips.titleLabel')} *
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                onBlur={() => {
                  if (title.trim().length > 0 && !showDetails) {
                    setShowDetails(true);
                    chevronRotation.value = withTiming(180, { duration: 200 });
                  }
                }}
                placeholder={i18n('trips.titlePlaceholder')}
                placeholderTextColor={placeholderColor}
                maxLength={100}
                returnKeyType="next"
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

            {/* Geocoding search bar */}
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <GeocodingSearchBar
                onSelect={handleGeocodingSelect}
                placeholder={i18n('trips.searchStopPlaceholder')}
                isDark={isDark}
                proximity={searchProximity}
              />
            </View>

            {/* Day-by-day stop list */}
            {sortedWaypoints.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                {Array.from({ length: numDays }, (_, dayIndex) => dayIndex).map((dayIndex) => {
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
                  const rideTimeColor = dayHours > 6 ? t.danger : dayHours > 4 ? t.warm : t.success;

                  return (
                    <View key={`day-${formatDayDate(startDate, dayIndex)}`}>
                      {/* Day header */}
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: t.surface,
                          borderWidth: 1,
                          borderColor: t.line,
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
                          <Text
                            style={{
                              fontFamily: 'InstrumentSerif-Regular',
                              fontSize: 17,
                              color: titleColor,
                            }}
                          >
                            {isShowcase
                              ? i18n('trips.dayHeaderShort', { day: dayIndex + 1 })
                              : i18n('trips.dayHeader', {
                                  day: dayIndex + 1,
                                  date: formatDayDate(startDate, dayIndex),
                                })}
                          </Text>
                        </View>
                        {dayWaypoints.length > 0 && dayDurationS > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: t.ink3 }}>
                              {formatSegmentDistance(dayDistanceM)}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: rideTimeColor }}>
                              {formatSegmentDuration(dayDurationS)}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Day's stops — grouped by period-of-day when labelled. */}
                      {dayWaypoints.length > 0 ? (
                        groupByPeriod(dayWaypoints).map((group) => (
                          <View key={`${dayIndex}-${group.period ?? 'unset'}`}>
                            {group.period && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'baseline',
                                  gap: 8,
                                  marginHorizontal: 20,
                                  marginTop: 4,
                                  marginBottom: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '700',
                                    color: subtitleColor,
                                    letterSpacing: 0.6,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {group.label}
                                </Text>
                                <Text style={{ fontSize: 11, color: subtitleColor, opacity: 0.7 }}>
                                  {PERIOD_HINT[group.period]}
                                </Text>
                              </View>
                            )}
                            {group.items.map((wp) => {
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
                                  onDelete={() => handleDeleteWaypoint(wp.id)}
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
                            })}
                          </View>
                        ))
                      ) : (
                        <Text
                          style={{
                            fontSize: 13,
                            color: subtitleColor,
                            textAlign: 'center',
                            paddingVertical: 12,
                            paddingHorizontal: 20,
                          }}
                        >
                          {i18n('trips.addStopHint')}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Add Day button */}
            {numDays < 14 && (
              <Pressable
                onPress={handleAddDay}
                accessibilityLabel="Add another day to trip"
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginHorizontal: 20,
                  marginTop: 12,
                  marginBottom: 16,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  borderWidth: 1.5,
                  borderColor: t.warm,
                }}
              >
                <Plus size={18} color={t.warm} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: t.warm }}>
                  {i18n('trips.addDay')}
                </Text>
              </Pressable>
            )}

            {/* Metadata form */}
            <View style={{ paddingHorizontal: 20, gap: 16 }}>
              {/* More details toggle */}
              <Pressable
                onPress={() => {
                  const next = !showDetails;
                  setShowDetails(next);
                  chevronRotation.value = withTiming(next ? 180 : 0, { duration: 200 });
                }}
                accessibilityRole="button"
                accessibilityLabel={showDetails ? 'Less details' : 'More details'}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  alignSelf: 'flex-start',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: t.warm }}>
                  {showDetails ? 'Less details' : 'More details'}
                </Text>
                <Animated.View style={chevronStyle}>
                  <ChevronDown size={16} color={t.warm} />
                </Animated.View>
              </Pressable>

              {showDetails && (
                <>
                  {/* Description */}
                  <Animated.View
                    entering={reducedMotion ? undefined : FadeInUp.delay(50).duration(250)}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: labelColor,
                        marginBottom: 6,
                      }}
                    >
                      {i18n('trips.descriptionLabel')} *
                    </Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder={i18n('trips.descriptionPlaceholder')}
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

                  {/* Dates — planning mode only (a showcase is dateless) */}
                  {!isShowcase && (
                  <Animated.View
                    entering={reducedMotion ? undefined : FadeInUp.delay(100).duration(250)}
                  >
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: labelColor,
                            marginBottom: 6,
                          }}
                        >
                          {i18n('trips.startDateLabel')}
                        </Text>
                        {process.env.EXPO_OS === 'android' ? (
                          <>
                            <Pressable
                              onPress={() => setShowStartPicker(true)}
                              style={{
                                backgroundColor: inputBg,
                                borderWidth: 1,
                                borderColor: inputBorder,
                                borderRadius: 10,
                                borderCurve: 'continuous',
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <Calendar size={16} color={t.warm} />
                              <Text style={{ fontSize: 14, color: inputTextColor }}>
                                {startDate.toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </Text>
                            </Pressable>
                            {showStartPicker && (
                              <DateTimePicker
                                value={startDate}
                                mode="date"
                                minimumDate={new Date()}
                                onChange={(_e, d) => {
                                  setShowStartPicker(false);
                                  if (d) {
                                    setStartDate(d);
                                    if (d > endDate) setEndDate(d);
                                  }
                                }}
                              />
                            )}
                          </>
                        ) : (
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
                            accentColor={t.warm}
                          />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: labelColor,
                            marginBottom: 6,
                          }}
                        >
                          {i18n('trips.endDateLabel')}
                        </Text>
                        {process.env.EXPO_OS === 'android' ? (
                          <>
                            <Pressable
                              onPress={() => setShowEndPicker(true)}
                              style={{
                                backgroundColor: inputBg,
                                borderWidth: 1,
                                borderColor: inputBorder,
                                borderRadius: 10,
                                borderCurve: 'continuous',
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <Calendar size={16} color={t.warm} />
                              <Text style={{ fontSize: 14, color: inputTextColor }}>
                                {endDate.toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </Text>
                            </Pressable>
                            {showEndPicker && (
                              <DateTimePicker
                                value={endDate}
                                mode="date"
                                minimumDate={startDate}
                                onChange={(_e, d) => {
                                  setShowEndPicker(false);
                                  if (d) setEndDate(d);
                                }}
                              />
                            )}
                          </>
                        ) : (
                          <DateTimePicker
                            value={endDate}
                            mode="date"
                            minimumDate={startDate}
                            onChange={(_e, d) => d && setEndDate(d)}
                            themeVariant={isDark ? 'dark' : 'light'}
                            accentColor={t.warm}
                          />
                        )}
                      </View>
                    </View>
                    {dateRangeError ? (
                      <Text
                        style={{
                          fontSize: 13,
                          color: t.danger,
                          marginTop: 8,
                        }}
                      >
                        {dateRangeError}
                      </Text>
                    ) : null}
                  </Animated.View>
                  )}

                  {/* Difficulty */}
                  <Animated.View
                    entering={reducedMotion ? undefined : FadeInUp.delay(200).duration(250)}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: labelColor,
                        marginBottom: 6,
                      }}
                    >
                      {i18n('trips.difficultyLabel')}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {getDifficulties(i18n as TI18n).map((d) => {
                        const isSelected = difficulty === d.key;
                        const accentColor = difficultyColors[d.key];
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

                  {/* Visibility — who can find / open the plan (separate from draft vs published) */}
                  <Animated.View
                    entering={reducedMotion ? undefined : FadeInUp.delay(225).duration(250)}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: labelColor,
                        marginBottom: 4,
                      }}
                    >
                      {i18n('trips.visibilityLabel')}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: subtitleColor,
                        marginBottom: 8,
                        lineHeight: 16,
                      }}
                    >
                      {i18n('trips.visibilityHint')}
                    </Text>
                    <View style={{ gap: 8 }}>
                      {getVisibilityOptions(i18n as TI18n).map((opt) => {
                        const isSelected = visibility === opt.key;
                        const OptIcon = opt.icon;
                        return (
                          <Pressable
                            key={opt.key}
                            onPress={() => setVisibility(opt.key)}
                            style={{
                              padding: 14,
                              borderRadius: 12,
                              borderCurve: 'continuous',
                              borderWidth: 1.5,
                              borderColor: isSelected ? t.warm : inputBorder,
                              backgroundColor: isSelected ? chipSelectedBg : chipBg,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <View
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                              >
                                <OptIcon
                                  size={15}
                                  color={isSelected ? t.warm : subtitleColor}
                                />
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontWeight: '700',
                                    color: isSelected ? t.warm : inputTextColor,
                                  }}
                                >
                                  {opt.label}
                                </Text>
                              </View>
                              {isSelected && (
                                <View
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    backgroundColor: t.warm,
                                  }}
                                />
                              )}
                            </View>
                            <Text style={{ fontSize: 12, color: subtitleColor, marginTop: 4 }}>
                              {opt.description}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Animated.View>

                  {/* Max riders — planning mode only (a showcase has no roster) */}
                  {!isShowcase && (
                  <Animated.View
                    entering={reducedMotion ? undefined : FadeInUp.delay(250).duration(250)}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: labelColor,
                        marginBottom: 6,
                      }}
                    >
                      {i18n('trips.maxRidersLabel')}
                    </Text>
                    <TextInput
                      value={maxRiders}
                      onChangeText={(text) => setMaxRiders(text.replace(/[^0-9]/g, ''))}
                      placeholder={i18n('trips.maxRidersPlaceholder')}
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
                  )}
                </>
              )}

              {/* Error messages */}
              {saveMutation.isError && (
                <View style={{ gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: t.danger,
                      textAlign: 'center',
                    }}
                  >
                    {i18n('trips.saveTripFailed')}
                  </Text>
                  <Text style={{ fontSize: 13, color: t.danger, textAlign: 'center' }}>
                    {userFriendlyError(saveMutation.error)}
                  </Text>
                </View>
              )}
              {publishMutation.isError && (
                <View style={{ gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: t.danger,
                      textAlign: 'center',
                    }}
                  >
                    {i18n('trips.publishTripFailed')}
                  </Text>
                  <Text style={{ fontSize: 13, color: t.danger, textAlign: 'center' }}>
                    {userFriendlyError(publishMutation.error)}
                  </Text>
                </View>
              )}
              {updateMutation.isError && (
                <View style={{ gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: t.danger,
                      textAlign: 'center',
                    }}
                  >
                    {i18n('trips.updateTripFailed')}
                  </Text>
                  <Text style={{ fontSize: 13, color: t.danger, textAlign: 'center' }}>
                    {userFriendlyError(updateMutation.error)}
                  </Text>
                </View>
              )}

              {/* Published trip warning banner (edit mode only) */}
              {isEditMode && tripStatus === 'published' && (
                <Animated.View
                  entering={reducedMotion ? undefined : FadeIn.duration(250)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: tint(t.warm, 0.12),
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                  }}
                >
                  <AlertTriangle size={16} color={t.warm} />
                  <Text style={{ fontSize: 13, color: t.warm, flex: 1 }}>
                    {i18n('trips.editPublishedWarning')}
                  </Text>
                </Animated.View>
              )}

              {/* Draft: explain "publish" (lifecycle) vs "public" (visibility) */}
              {isEditMode && isEditingDraft && (
                <Animated.View
                  entering={reducedMotion ? undefined : FadeIn.duration(250)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                    backgroundColor: t.surface2,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: inputBorder,
                  }}
                >
                  <Info size={16} color={t.warm} style={{ marginTop: 1 }} />
                  <Text style={{ fontSize: 12, color: subtitleColor, flex: 1, lineHeight: 18 }}>
                    <Text style={{ fontWeight: '700', color: inputTextColor }}>
                      {i18n('trips.draftLabel')}
                    </Text>
                    {` stays in My Trips only. `}
                    <Text style={{ fontWeight: '700', color: inputTextColor }}>
                      {i18n('trips.publish')}
                    </Text>
                    {` makes it a live trip (for invites and the app). That is different from `}
                    <Text style={{ fontWeight: '700', color: inputTextColor }}>
                      {i18n('trips.visibilityPublic')}
                    </Text>
                    {` above — you can publish a private trip (invite-only).`}
                  </Text>
                </Animated.View>
              )}

              {/* Action buttons */}
              {isEditMode ? (
                <View style={{ gap: 12, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Pressable
                      onPress={() => router.back()}
                      accessibilityRole="button"
                      accessibilityLabel="Close without saving"
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
                        borderColor: t.line,
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
                        {i18n('common.cancel')}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => updateMutation.mutate()}
                      disabled={!isValid || isSaving}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isEditingDraft
                          ? 'Save draft, keep this trip in My Trips only'
                          : 'Update trip, save your changes'
                      }
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingVertical: 14,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                        backgroundColor: isValid ? t.warm : isDark ? t.surface2 : t.line,
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {updateMutation.isPending ? (
                        <ActivityIndicator size="small" color={'#fff'} />
                      ) : (
                        <>
                          <Save size={16} color={'#fff'} />
                          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                            {isEditingDraft ? i18n('trips.saveDraft') : i18n('trips.updateTrip')}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {/* Publish = draft → published (separate from Public visibility) */}
                  {isEditingDraft && (
                    <View style={{ gap: 4 }}>
                      <Pressable
                        onPress={() => updateAndPublishMutation.mutate()}
                        disabled={!isValid || isSaving}
                        accessibilityRole="button"
                        accessibilityLabel="Publish trip, make it live with the visibility you set"
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          paddingVertical: 14,
                          borderRadius: 14,
                          borderCurve: 'continuous',
                          backgroundColor: isValid ? t.success : isDark ? t.surface2 : t.line,
                          opacity: isSaving ? 0.7 : 1,
                        }}
                      >
                        {updateAndPublishMutation.isPending ? (
                          <ActivityIndicator size="small" color={'#fff'} />
                        ) : (
                          <>
                            <Send size={16} color={'#fff'} />
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                              {i18n('trips.publish')}
                            </Text>
                          </>
                        )}
                      </Pressable>
                      <Text
                        style={{
                          fontSize: 11,
                          color: subtitleColor,
                          textAlign: 'center',
                          lineHeight: 15,
                        }}
                      >
                        {i18n('trips.publishHint')}
                      </Text>
                    </View>
                  )}

                  {/* Delete — full width, danger outlined. Lives here (edit mode)
                    so the view screen stays read-only. */}
                  <Pressable
                    onPress={handleDeleteTrip}
                    disabled={isSaving}
                    accessibilityRole="button"
                    accessibilityLabel="Delete trip"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      borderWidth: 1,
                      borderColor: t.danger,
                      backgroundColor: 'transparent',
                      opacity: isSaving ? 0.6 : 1,
                    }}
                  >
                    {deleteMutation.isPending ? (
                      <ActivityIndicator size="small" color={t.danger} />
                    ) : (
                      <>
                        <Trash2 size={16} color={t.danger} />
                        <Text style={{ fontSize: 15, fontWeight: '700', color: t.danger }}>
                          {i18n('trips.deleteTrip')}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 6, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Pressable
                      onPress={() => saveMutation.mutate()}
                      disabled={!isValid || isSaving}
                      accessibilityRole="button"
                      accessibilityLabel="Save as draft in My Trips"
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
                        borderColor: isValid ? t.warm : 'transparent',
                        backgroundColor: isValid ? 'transparent' : isDark ? t.surface2 : t.line,
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {saveMutation.isPending ? (
                        <ActivityIndicator size="small" color={t.warm} />
                      ) : (
                        <>
                          <Save size={16} color={isValid ? t.warm : '#fff'} />
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: '700',
                              color: isValid ? t.warm : '#fff',
                            }}
                          >
                            {i18n('trips.saveDraft')}
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => publishMutation.mutate()}
                      disabled={!isValid || isSaving}
                      accessibilityRole="button"
                      accessibilityLabel="Create trip and publish it live"
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingVertical: 14,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                        backgroundColor: isValid ? t.warm : isDark ? t.surface2 : t.line,
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {publishMutation.isPending ? (
                        <ActivityIndicator size="small" color={'#fff'} />
                      ) : (
                        <>
                          <Send size={16} color={'#fff'} />
                          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                            {i18n('trips.publish')}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      color: subtitleColor,
                      textAlign: 'center',
                      lineHeight: 15,
                      paddingHorizontal: 4,
                    }}
                  >
                    {i18n('trips.saveDraftPublishHint')}
                  </Text>
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
              backgroundColor: t.bg,
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
                  fontFamily: 'InstrumentSerif-Regular',
                  fontSize: 22,
                  color: titleColor,
                }}
              >
                {i18n('trips.editStop')}
              </Text>
              <Pressable
                onPress={closeEditModal}
                hitSlop={12}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  backgroundColor: t.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} color={t.ink3} />
              </Pressable>
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: t.line,
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
                  {i18n('trips.nameLabel')}
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={i18n('trips.stopNamePlaceholder')}
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
                  backgroundColor: t.line,
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
                  {i18n('trips.typeLabel')}
                </Text>
                <WaypointTypePicker selected={editType} onSelect={setEditType} />
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: t.line,
                }}
              />

              {/* Period of day */}
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: labelColor,
                    marginBottom: 6,
                  }}
                >
                  {i18n('trips.periodOfDayLabel')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['morning', 'afternoon', 'evening'] as const).map((p) => {
                    const selected = editPeriod === p;
                    return (
                      <Pressable
                        key={p}
                        onPress={() => setEditPeriod(selected ? null : p)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 10,
                          borderCurve: 'continuous',
                          borderWidth: 1,
                          borderColor: selected ? t.warm : inputBorder,
                          backgroundColor: selected ? tint(t.warm, 0.1) : t.surface2,
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: selected ? t.warm : labelColor,
                          }}
                        >
                          {PERIOD_LABEL[p]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 11, color: placeholderColor, marginTop: 6 }}>
                  {i18n('trips.periodOfDayHint')}
                </Text>
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: t.line,
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
                  {i18n('trips.notesLabel')}
                </Text>
                <TextInput
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder={i18n('trips.stopNotesPlaceholder')}
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
                  backgroundColor: t.line,
                }}
              />

              {/* Done button */}
              <Pressable
                onPress={applyEdit}
                style={{
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: t.warm,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: '#fff',
                  }}
                >
                  {i18n('common.done')}
                </Text>
              </Pressable>
            </RNScrollView>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}
