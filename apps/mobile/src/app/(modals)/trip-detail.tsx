import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import {
  CloneTripDocument,
  CreateTripReviewDocument,
  JoinTripDocument,
  LeaveTripDocument,
  PublishTripToDiscoverDocument,
  SaveTripDocument,
  TripDetailDocument,
  type TripDetailQuery,
  TripReviewsDocument,
  UnsaveTripDocument,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system/next';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  ArrowLeft,
  Award,
  Bookmark,
  BookmarkCheck,
  Calendar,
  CheckCircle,
  ChevronUp,
  Compass,
  Copy,
  EyeOff,
  Globe,
  HelpCircle,
  Lock,
  LogOut,
  MapPin,
  Mountain,
  Pencil,
  PenLine,
  Plus,
  Share2,
  Sparkles,
  Star,
  User,
  Users,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentList } from '../../components/comments/comment-list';
import { RideThisSheet, RideThisStickyCta } from '../../components/ride-this-sheet';
import { OfflinePackButton } from '../../components/trip/offline-pack-button';
import { ReadinessRing } from '../../components/trip/readiness-ring';
import { useRolePicker } from '../../components/trip/role-picker-sheet';
import { SuggestionsSection } from '../../components/trip/suggestions-section';
import { TripAssistantSheet } from '../../components/trip/trip-assistant-sheet';
import { getWaypointIcon } from '../../components/trip/waypoint-type-picker';
import { TripShareSheet } from '../../components/trip-share-sheet';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { useOfflineTrip } from '../../hooks/use-offline-trip';
import { usePrimaryBikeFuelData } from '../../hooks/use-primary-bike-fuel-data';
import { useRideThis } from '../../hooks/use-ride-this';
import { useTripAssistant } from '../../hooks/use-trip-assistant';
import { useTripSuggestions } from '../../hooks/use-trip-suggestions';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { cacheTripPayload } from '../../lib/offline-trips';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { MAP_STYLES } from '../../utils/map-styles';
import { getRouteSegments } from '../../utils/mapbox-directions';
import { showMarkerActionSheet } from '../../utils/marker-action-sheet';
import { groupByPeriod } from '../../utils/period-of-day';
import { computeReadiness, formatReadinessBrief } from '../../utils/readiness';
import { formatDistance, formatElevation } from '../../utils/ride-formatters';
import { useResolvedWaypointLabel } from '../../utils/waypoint-place-label';

type TripWaypoint = TripDetailQuery['tripDetail']['waypoints'] extends
  | (infer W)[]
  | null
  | undefined
  ? W
  : never;

const DIFFICULTY_LABELS = {
  easy: 'Chill',
  moderate: 'Spirited',
  challenging: 'Technical',
  expert: 'Expert',
} as const;

const STATUS_ICONS = {
  going: { Icon: CheckCircle, color: palette.success500 },
  maybe: { Icon: HelpCircle, color: palette.warning500 },
  declined: { Icon: XCircle, color: palette.danger500 },
} as const;

const SURFACE_LABELS: Record<string, string> = {
  paved: 'Paved',
  mixed: 'Mixed',
  off_road: 'Off-road',
  gravel: 'Gravel',
};

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

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} \u2013 ${e.toLocaleDateString('en-US', opts)}`;
}

function AnimatedChevron({ collapsed, color }: { collapsed: boolean; color: string }) {
  const rotation = useSharedValue(collapsed ? 180 : 0);
  useEffect(() => {
    rotation.value = withTiming(collapsed ? 180 : 0, { duration: 200 });
  }, [collapsed, rotation]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <ChevronUp size={16} color={color} />
    </Animated.View>
  );
}

function ItineraryWaypointRow({
  wp,
  index,
  titleColor,
  subtitleColor,
}: {
  wp: TripWaypoint;
  index: number;
  titleColor: string;
  subtitleColor: string;
  isDark: boolean;
}) {
  const { t: wt2 } = useEditorialTheme();
  const displayName = useResolvedWaypointLabel({
    id: wp.id,
    name: wp.name,
    type: wp.type,
    lat: wp.lat,
    lng: wp.lng,
  });
  const wt = getWaypointIcon(wp.type);
  return (
    <Animated.View
      entering={FadeInUp.delay(index * 40).duration(200)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        marginBottom: 6,
        borderRadius: 10,
        borderCurve: 'continuous',
        backgroundColor: wt2.surface,
        borderWidth: 1,
        borderColor: wt2.line,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: wt.color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <wt.Icon size={16} color={palette.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: titleColor }} numberOfLines={2}>
          {displayName}
        </Text>
        {wp.notes ? (
          <Text
            style={{
              fontSize: 13,
              color: subtitleColor,
              marginTop: 2,
            }}
            numberOfLines={2}
          >
            {wp.notes}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function TemplateRouteStartEndLine({
  startWp,
  endWp,
  titleColor,
  subtitleColor,
  trip,
}: {
  startWp: TripWaypoint;
  endWp: TripWaypoint;
  titleColor: string;
  subtitleColor: string;
  trip: TripDetailQuery['tripDetail'];
  isDark: boolean;
}) {
  const { t } = useEditorialTheme();
  const startLabel = useResolvedWaypointLabel({
    id: startWp.id,
    name: startWp.name,
    type: startWp.type,
    lat: startWp.lat,
    lng: startWp.lng,
  });
  const endLabel = useResolvedWaypointLabel({
    id: endWp.id,
    name: endWp.name,
    type: endWp.type,
    lat: endWp.lat,
    lng: endWp.lng,
  });
  return (
    <Animated.View entering={FadeInUp.delay(90).duration(220)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          padding: 12,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
        }}
      >
        <MapPin size={16} color={t.warm} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: titleColor }}>
            {startLabel}
            {'  \u2192  '}
            {endLabel}
          </Text>
          {trip.city ? (
            <Text style={{ fontSize: 12, color: subtitleColor }}>
              {[trip.city, trip.regionCode?.toUpperCase(), trip.countryCode?.toUpperCase()]
                .filter(Boolean)
                .join(', ')}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

export default function TripDetailScreen() {
  const { t, isDark } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const sheetRef = useRef<BottomSheet>(null);
  const userId = useAuthStore((s) => s.session?.user?.id);
  const [actionLoading, setActionLoading] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const system = useMeasurementSystem();

  const bg = t.bg;
  const titleColor = t.ink;
  const subtitleColor = t.ink3;
  const sheetBg = t.surface;
  const bodyColor = t.ink2;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.trips.detail(tripId),
    queryFn: () => gqlFetcher(TripDetailDocument, { tripId }),
    enabled: !!tripId,
  });

  const trip = data?.tripDetail;

  const tripLoaded = trip?.id;
  useEffect(() => {
    if (trip && tripLoaded) {
      trackEvent(AnalyticsEvent.TRIP_VIEWED, {
        trip_id: tripId,
        difficulty: trip.difficulty,
        waypoint_count: trip.waypoints?.length ?? 0,
      });
    }
  }, [tripLoaded, tripId, trip]);

  const waypoints = useMemo(
    () => [...(trip?.waypoints ?? [])].sort((a, b) => a.sortOrder - b.sortOrder) as TripWaypoint[],
    [trip?.waypoints],
  );

  // Pre-ride readiness — recomputes whenever waypoints/trip shape changes.
  const { bikeId, tankLiters, kmPerLiter } = usePrimaryBikeFuelData();
  const readiness = useMemo(
    () =>
      computeReadiness(
        {
          startDate: trip?.startDate,
          endDate: trip?.endDate,
          visibility: trip?.visibility as 'private' | 'unlisted' | 'public' | null | undefined,
          participantCount: trip?.participantCount ?? 0,
          waypoints: waypoints.map((wp) => ({
            lat: wp.lat,
            lng: wp.lng,
            sortOrder: wp.sortOrder,
            name: wp.name,
          })),
        },
        bikeId ? { id: bikeId, tankLiters, kmPerLiter } : null,
      ),
    [
      trip?.startDate,
      trip?.endDate,
      trip?.visibility,
      trip?.participantCount,
      waypoints,
      bikeId,
      tankLiters,
      kmPerLiter,
    ],
  );

  // Offline pack — tile download + payload caching for on-the-road use.
  const offline = useOfflineTrip({
    tripId,
    waypoints: waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng })),
  });

  // Trip-context AI assistant.
  const assistant = useTripAssistant(tripId);

  // Whenever we have a live trip payload AND the user has an offline pack,
  // refresh the cached copy so trip-detail hydrates with fresh data next
  // time they open it without signal.
  useEffect(() => {
    if (!trip || !tripId) return;
    if (offline.status === 'ready') {
      cacheTripPayload(tripId, trip);
    }
  }, [trip, tripId, offline.status]);

  const handleShareBrief = useCallback(async () => {
    if (!trip) return;
    const brief = formatReadinessBrief({
      tripTitle: trip.title ?? 'Trip',
      startDate: trip.startDate,
      endDate: trip.endDate,
      waypoints: waypoints.map((wp) => ({ name: wp.name, notes: wp.notes })),
      readiness,
    });
    try {
      await Share.share({ message: brief, title: `${trip.title ?? 'Trip'} — tank-bag brief` });
      trackEvent(AnalyticsEvent.TRIP_BRIEF_SHARED, {
        trip_id: tripId,
        readiness_score: Math.round(readiness.score * 100),
      });
    } catch {
      /* user cancelled */
    }
  }, [trip, waypoints, readiness, tripId]);

  const tripDays = useMemo(() => {
    if (trip?.isTemplate) {
      const dc = trip.dayCount;
      if (dc != null && dc > 0) return dc;
    }
    if (!trip?.startDate || !trip?.endDate) return 1;
    const ms = new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime();
    return Math.max(1, Math.round(ms / 86_400_000) + 1);
  }, [trip?.isTemplate, trip?.dayCount, trip?.startDate, trip?.endDate]);

  const [collapsedDays, setCollapsedDays] = useState<Record<number, boolean>>({});

  const waypointsByDay = useMemo(() => {
    const grouped = new Map<number, TripWaypoint[]>();
    for (const wp of waypoints) {
      const day = wp.dayIndex ?? 0;
      const existing = grouped.get(day);
      if (existing) {
        existing.push(wp);
      } else {
        grouped.set(day, [wp]);
      }
    }
    return [...grouped.entries()].sort(([a], [b]) => a - b);
  }, [waypoints]);

  const toggleDay = useCallback((dayIndex: number) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollapsedDays((prev) => ({ ...prev, [dayIndex]: !prev[dayIndex] }));
  }, []);

  const formatDayDate = useCallback(
    (dayIndex: number): string => {
      if (trip?.isTemplate) return `Day ${dayIndex + 1}`;
      if (!trip?.startDate) return `Day ${dayIndex + 1}`;
      const date = new Date(trip.startDate);
      date.setDate(date.getDate() + dayIndex);
      const formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `Day ${dayIndex + 1} — ${formatted}`;
    },
    [trip?.isTemplate, trip?.startDate],
  );

  const waypointCoords = useMemo<[number, number][]>(
    () => waypoints.map((wp) => [wp.lng, wp.lat]),
    [waypoints],
  );

  const bounds = useMemo(() => {
    if (waypointCoords.length === 0) return undefined;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of waypointCoords) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    return {
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
    };
  }, [waypointCoords]);

  // Real road-routed geometry fetched from Mapbox Directions.
  // Falls back to straight lines between waypoints while loading or on failure.
  const [routedGeometry, setRoutedGeometry] = useState<GeoJSON.LineString | null>(null);

  useEffect(() => {
    if (waypointCoords.length < 2) {
      setRoutedGeometry(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      const coords = waypointCoords.map(([lng, lat]) => ({ lat, lng }));
      const result = await getRouteSegments(coords, controller.signal);
      if (!controller.signal.aborted && result) {
        setRoutedGeometry(result.geometry);
      }
    })();
    return () => controller.abort();
  }, [waypointCoords]);

  const routeGeoJSON = useMemo(() => {
    if (waypointCoords.length < 2) return null;
    return {
      type: 'Feature' as const,
      geometry:
        routedGeometry ?? ({ type: 'LineString' as const, coordinates: waypointCoords } as const),
      properties: {},
    };
  }, [waypointCoords, routedGeometry]);

  const isOrganiser = trip?.organiser.id === userId;
  const myParticipant = useMemo(
    () => trip?.participants?.find((p) => p.id === userId),
    [trip?.participants, userId],
  );
  // P5.1 — co-planners share accept/reject rights with the organiser.
  const isCoPlanner = myParticipant?.role === 'co_planner';
  const canDecideSuggestions = isOrganiser || isCoPlanner;

  const tripSuggestions = useTripSuggestions(tripId);
  const { showRolePicker } = useRolePicker({ tripId });

  const difficultyKey = (
    trip?.difficulty ?? 'easy'
  ).toLowerCase() as keyof typeof DIFFICULTY_LABELS;
  const difficultyLabel = DIFFICULTY_LABELS[difficultyKey] ?? 'Chill';

  const invalidateTrip = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
  }, [queryClient, tripId]);

  const joinMutation = useMutation({
    mutationFn: (status: string) => gqlFetcher(JoinTripDocument, { input: { tripId, status } }),
    onMutate: () => setActionLoading(true),
    onSettled: () => setActionLoading(false),
    onSuccess: (_data, status) => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEvent(AnalyticsEvent.TRIP_JOINED, { trip_id: tripId, status });
      invalidateTrip();
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => gqlFetcher(LeaveTripDocument, { tripId }),
    onMutate: () => setActionLoading(true),
    onSettled: () => setActionLoading(false),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      trackEvent(AnalyticsEvent.TRIP_LEFT, { trip_id: tripId });
      invalidateTrip();
    },
  });

  const handleLeave = useCallback(() => {
    Alert.alert('Leave this trip?', "You'll drop off the rider list and lose your spot.", [
      { text: 'Stay in', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate() },
    ]);
  }, [leaveMutation]);

  const [publishedToDiscover, setPublishedToDiscover] = useState(false);

  const publishToDiscoverMutation = useMutation({
    mutationFn: () => gqlFetcher(PublishTripToDiscoverDocument, { input: { tripId } }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPublishedToDiscover(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.tripTemplates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
      Alert.alert(
        'Published to Discover',
        'Your trip is now a template that other riders can browse and clone.',
      );
    },
    onError: (err: Error) => {
      if (err.message?.includes('Quality gate')) {
        Alert.alert(
          'Not Ready Yet',
          'Add at least 2 waypoints, a title, description, and difficulty before publishing.',
        );
      } else if (err.message?.includes('already published')) {
        setPublishedToDiscover(true);
      } else {
        Alert.alert('Publish Failed', err.message ?? 'Please try again.');
      }
    },
  });

  const handlePublishToDiscover = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Publish to Discover?',
      'This will create a public template of your trip. Dates, riders, and personal notes are never shared.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish', onPress: () => publishToDiscoverMutation.mutate() },
      ],
    );
  }, [publishToDiscoverMutation]);

  // ── Template-specific state & mutations ──────────────────────────────
  const isTemplate = trip?.isTemplate === true;
  const [isSaved, setIsSaved] = useState(false);
  useEffect(() => {
    if (trip) setIsSaved(!!trip.isSaved);
  }, [trip]);

  // Polyline-based route line for template map preview
  const polylineRoute = useMemo(() => {
    if (!trip?.polyline) return null;
    const coords = decodePolylineToCoords(trip.polyline);
    if (coords.length < 2) return null;
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: {},
    };
  }, [trip?.polyline]);

  const polylineBounds = useMemo(() => {
    if (!polylineRoute) return undefined;
    const coords = polylineRoute.geometry.coordinates;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    return {
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
    };
  }, [polylineRoute]);

  // Clone template mutation
  const cloneMutation = useMutation({
    mutationFn: () => gqlFetcher(CloneTripDocument, { tripId }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      Alert.alert('Cloned!', 'This trip has been added to your trips.');
    },
    onError: (err: Error) => {
      if (err.message?.includes('already cloned')) {
        Alert.alert('Already Cloned', 'You have already cloned this trip.');
      } else {
        Alert.alert('Clone Failed', err.message ?? 'Please try again.');
      }
    },
  });

  const handleCloneTemplate = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cloneMutation.mutate();
  }, [cloneMutation]);

  // Save / unsave mutations
  const saveMutation = useMutation({
    mutationFn: () => gqlFetcher(SaveTripDocument, { tripId }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSaved(true);
      invalidateTrip();
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: () => gqlFetcher(UnsaveTripDocument, { tripId }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsSaved(false);
      invalidateTrip();
    },
  });

  const handleToggleSave = useCallback(() => {
    if (isSaved) {
      unsaveMutation.mutate();
    } else {
      saveMutation.mutate();
    }
  }, [isSaved, saveMutation, unsaveMutation]);

  // Reviews query for template
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: queryKeys.tripReviews.byTrip(tripId),
    queryFn: () => gqlFetcher(TripReviewsDocument, { tripId, first: 10 }),
    enabled: !!tripId && isTemplate,
  });

  const reviews = reviewsData?.tripReviews ?? [];

  // Write review state
  const [reviewFormVisible, setReviewFormVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const createReviewMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(CreateTripReviewDocument, {
        input: { tripId, rating: reviewRating, text: reviewText || undefined },
      }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReviewFormVisible(false);
      setReviewText('');
      setReviewRating(5);
      queryClient.invalidateQueries({
        queryKey: queryKeys.tripReviews.byTrip(tripId),
      });
      invalidateTrip();
    },
    onError: (err: Error) => {
      Alert.alert('Review Failed', err.message ?? 'Please try again.');
    },
  });

  const handleSubmitReview = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createReviewMutation.mutate();
  }, [createReviewMutation]);

  const handleOpenShareSheet = useCallback(() => {
    if (!trip) return;
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareSheetVisible(true);
  }, [trip]);

  const handleExportGPX = useCallback(async () => {
    if (!trip) return;
    if (waypoints.length < 2) {
      Alert.alert(
        'Need at least two stops',
        'A GPX file needs a start and an end. Add one more stop and try again.',
      );
      return;
    }

    const esc = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const wptElements = waypoints
      .map(
        (wp) =>
          `  <wpt lat="${wp.lat}" lon="${wp.lng}">\n    <name>${esc(wp.name)}</name>${wp.notes ? `\n    <desc>${esc(wp.notes)}</desc>` : ''}\n  </wpt>`,
      )
      .join('\n');

    const rteptElements = waypoints
      .map(
        (wp) =>
          `    <rtept lat="${wp.lat}" lon="${wp.lng}">\n      <name>${esc(wp.name)}</name>${wp.notes ? `\n      <desc>${esc(wp.notes)}</desc>` : ''}\n    </rtept>`,
      )
      .join('\n');

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoVault" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(trip.title)}</name>${trip.description ? `\n    <desc>${esc(trip.description)}</desc>` : ''}
    <time>${trip.createdAt}</time>
  </metadata>
${wptElements}
  <rte>
    <name>${esc(trip.title)}</name>
${rteptElements}
  </rte>
</gpx>`;

    const slug = trip.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const fileName = `${slug}-motovault.gpx`;
    const file = new File(Paths.cache, fileName);
    file.create();
    file.write(gpx);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/gpx+xml',
      UTI: 'com.topografix.gpx',
    });

    trackEvent(AnalyticsEvent.TRIP_SHARED, { trip_id: tripId, method: 'gpx' });
  }, [trip, waypoints, tripId]);

  const navWaypoints = useMemo(
    () =>
      waypoints.map((w) => ({
        lat: w.lat,
        lng: w.lng,
        name: w.name,
        dayIndex: w.dayIndex ?? 0,
      })),
    [waypoints],
  );

  const rideThis = useRideThis({
    surface: 'trip',
    entityId: tripId,
    waypoints: navWaypoints,
    onGpxExport: handleExportGPX,
  });

  const handleProfilePress = useCallback(
    (username: string) => {
      router.push({ pathname: '/(tabs)/(profile)/rider/[username]', params: { username } });
    },
    [router],
  );

  if (isLoading || !trip) {
    return (
      <Animated.View
        exiting={FadeOut.duration(180)}
        style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={t.warm} />
      </Animated.View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View entering={FadeIn.duration(280)} style={{ flex: 1, backgroundColor: bg }}>
        {/* Map */}
        <MapboxGL.MapView
          style={{ flex: 1 }}
          styleURL={MAP_STYLES[isDark ? 'dark' : 'light']}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
        >
          {(polylineBounds ?? bounds) && (
            <MapboxGL.Camera
              bounds={{
                // biome-ignore lint/style/noNonNullAssertion: guarded by conditional render above
                ...(polylineBounds ?? bounds)!,
                paddingBottom: 200,
                paddingTop: 60,
                paddingLeft: 40,
                paddingRight: 40,
              }}
              animationMode="flyTo"
              animationDuration={500}
            />
          )}
          {/* Polyline route for templates, Directions route for regular trips */}
          {(polylineRoute ?? routeGeoJSON) && (
            // biome-ignore lint/style/noNonNullAssertion: guarded by truthy check above
            <MapboxGL.ShapeSource id="trip-route" shape={(polylineRoute ?? routeGeoJSON)!}>
              <MapboxGL.LineLayer
                id="trip-route-layer"
                style={{
                  lineColor: t.warm,
                  lineWidth: 4,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </MapboxGL.ShapeSource>
          )}
          {waypoints.map((wp) => {
            const wt = getWaypointIcon(wp.type);
            return (
              <MapboxGL.MarkerView key={wp.id} id={`wp-${wp.id}`} coordinate={[wp.lng, wp.lat]}>
                <Pressable
                  onPress={() =>
                    showMarkerActionSheet({
                      title: wp.name || 'Waypoint',
                      lat: wp.lat,
                      lng: wp.lng,
                    })
                  }
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    backgroundColor: wt.color,
                    borderWidth: 2.5,
                    borderColor: palette.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <wt.Icon size={14} color={palette.white} />
                </Pressable>
              </MapboxGL.MarkerView>
            );
          })}
        </MapboxGL.MapView>

        {/* Floating controls */}
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
              width: 48,
              height: 48,
              borderRadius: 24,
              borderCurve: 'continuous',
              backgroundColor: tint(t.bg, 0.7),
              borderWidth: 1,
              borderColor: t.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={20} color={t.ink} />
          </Pressable>
        </View>

        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 12,
            flexDirection: 'row',
            gap: 6,
          }}
        >
          {!isTemplate && (
            <Pressable
              onPress={() => {
                if (process.env.EXPO_OS === 'ios')
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAssistantOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Ask trip assistant"
              style={{ alignItems: 'center', gap: 3 }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderCurve: 'continuous',
                  backgroundColor: tint(t.bg, 0.7),
                  borderWidth: 1,
                  borderColor: t.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} color={t.warm} />
              </View>
              <Text style={{ fontSize: 9, fontWeight: '600', color: t.ink }}>AI</Text>
            </Pressable>
          )}
          {isOrganiser && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(modals)/create-trip',
                  params: { tripId: trip.id },
                } as never)
              }
              style={{ alignItems: 'center', gap: 3 }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderCurve: 'continuous',
                  backgroundColor: tint(t.bg, 0.7),
                  borderWidth: 1,
                  borderColor: t.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Pencil size={16} color={t.ink} />
              </View>
              <Text style={{ fontSize: 9, fontWeight: '600', color: t.ink }}>
                {i18n('trips.edit')}
              </Text>
            </Pressable>
          )}
          {isOrganiser && (
            <Pressable onPress={handleOpenShareSheet} style={{ alignItems: 'center', gap: 3 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderCurve: 'continuous',
                  backgroundColor: tint(t.bg, 0.7),
                  borderWidth: 1,
                  borderColor: t.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Share2 size={16} color={t.ink} />
              </View>
              <Text style={{ fontSize: 9, fontWeight: '600', color: t.ink }}>
                {i18n('trips.share')}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Bottom sheet */}
        <BottomSheet
          ref={sheetRef}
          snapPoints={['55%', '85%', '95%']}
          index={0}
          backgroundStyle={{
            backgroundColor: sheetBg,
            borderRadius: 24,
            borderCurve: 'continuous',
          }}
          handleIndicatorStyle={{
            backgroundColor: t.line,
          }}
        >
          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          >
            {/* Title */}
            <Animated.Text
              entering={FadeInUp.duration(220)}
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 30,
                color: t.ink,
                letterSpacing: -0.6,
                lineHeight: 32,
                marginBottom: 10,
              }}
            >
              {trip.title}
            </Animated.Text>

            {/* Badge row — difficulty + visibility */}
            <Animated.View
              entering={FadeInUp.delay(40).duration(220)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <View
                style={{
                  backgroundColor: tint(t.warm, 0.18),
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: t.warm }}>
                  {difficultyLabel}
                </Text>
              </View>
              {!isTemplate && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: t.surface2,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: t.line,
                  }}
                >
                  {trip.visibility === 'public' ? (
                    <Globe size={11} color={t.success} />
                  ) : trip.visibility === 'unlisted' ? (
                    <EyeOff size={11} color={t.warm} />
                  ) : (
                    <Lock size={11} color={t.ink3} />
                  )}
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color:
                        trip.visibility === 'public'
                          ? t.success
                          : trip.visibility === 'unlisted'
                            ? t.warm
                            : t.ink3,
                    }}
                  >
                    {trip.visibility === 'public'
                      ? 'Public'
                      : trip.visibility === 'unlisted'
                        ? 'Link only'
                        : 'Private'}
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Stats bar — the at-a-glance decision data */}
            <Animated.View
              entering={FadeInUp.delay(80).duration(220)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.line,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 14,
                borderCurve: 'continuous',
                marginBottom: 14,
                gap: 14,
              }}
            >
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text
                  style={{
                    fontFamily: 'InstrumentSerif-Regular',
                    fontSize: 20,
                    color: t.ink,
                  }}
                >
                  {tripDays}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: t.ink3,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  {tripDays === 1 ? 'day' : 'days'}
                </Text>
              </View>
              <View
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  backgroundColor: t.line,
                }}
              />
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text
                  style={{
                    fontFamily: 'InstrumentSerif-Regular',
                    fontSize: 20,
                    color: t.ink,
                  }}
                >
                  {waypoints.length}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: t.ink3,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  {waypoints.length === 1 ? 'stop' : 'stops'}
                </Text>
              </View>
              {!isTemplate && (
                <View
                  style={{
                    width: 1,
                    alignSelf: 'stretch',
                    backgroundColor: t.line,
                  }}
                />
              )}
              {!isTemplate && (
                <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: 'InstrumentSerif-Regular',
                      fontSize: 20,
                      color: t.ink,
                    }}
                  >
                    {trip.participantCount + 1}
                    <Text style={{ color: t.ink3 }}>/{trip.maxRiders}</Text>
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: t.ink3,
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    riders
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Date + organiser compact row — hidden for templates */}
            {!isTemplate && (
              <Animated.View
                entering={FadeInUp.delay(120).duration(220)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 14,
                  flexWrap: 'wrap',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Calendar size={13} color={t.warm} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: subtitleColor }}>
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <User size={13} color={subtitleColor} />
                  <Text style={{ fontSize: 13, color: subtitleColor }}>
                    Led by {trip.organiser.displayName}
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Description — now below the decision-relevant data */}
            {trip.description && (
              <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, lineHeight: 20, color: bodyColor }}>
                  {trip.description}
                </Text>
              </Animated.View>
            )}

            {/* ── Template-specific sections ──────────────────────────── */}
            {isTemplate && (
              <>
                {/* Template badges — surface, MotoVault Pick, etc. */}
                <Animated.View
                  entering={FadeInUp.delay(40).duration(220)}
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  {trip.surfaceType && (
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 10,
                        borderCurve: 'continuous',
                        backgroundColor: t.surface2,
                        borderWidth: 1,
                        borderColor: t.line,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: subtitleColor,
                        }}
                      >
                        {SURFACE_LABELS[trip.surfaceType] ?? trip.surfaceType}
                      </Text>
                    </View>
                  )}
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
                        backgroundColor: tint(t.warm, 0.18),
                      }}
                    >
                      <Award size={12} color={t.warm} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: t.warm }}>
                        MotoVault Pick
                      </Text>
                    </View>
                  )}
                </Animated.View>

                {/* Template stats — distance, elevation, rating, clones */}
                <Animated.View
                  entering={FadeInUp.delay(60).duration(220)}
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 16,
                    marginBottom: 20,
                    padding: 14,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    backgroundColor: t.surface,
                    borderWidth: 1,
                    borderColor: t.line,
                  }}
                >
                  {trip.distanceM != null && (
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={{
                          fontFamily: 'InstrumentSerif-Regular',
                          fontSize: 18,
                          color: t.ink,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {formatDistance(trip.distanceM, system)}
                      </Text>
                      <Text style={{ fontSize: 11, color: t.ink3 }}>{i18n('trips.distance')}</Text>
                    </View>
                  )}
                  {(trip.elevationGainM ?? 0) > 0 && (
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Mountain size={14} color={t.warm} />
                        <Text
                          style={{
                            fontFamily: 'InstrumentSerif-Regular',
                            fontSize: 18,
                            color: t.ink,
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {formatElevation(trip.elevationGainM ?? 0, system)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: t.ink3 }}>{i18n('trips.elevation')}</Text>
                    </View>
                  )}
                  {trip.estimatedDurationMinutes != null && trip.estimatedDurationMinutes > 0 && (
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={{
                          fontFamily: 'InstrumentSerif-Regular',
                          fontSize: 18,
                          color: t.ink,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {trip.estimatedDurationMinutes >= 60
                          ? `${Math.floor(trip.estimatedDurationMinutes / 60)}h ${trip.estimatedDurationMinutes % 60}m`
                          : `${trip.estimatedDurationMinutes}m`}
                      </Text>
                      <Text style={{ fontSize: 11, color: t.ink3 }}>{i18n('trips.duration')}</Text>
                    </View>
                  )}
                  {trip.averageRating != null &&
                    trip.reviewCount != null &&
                    trip.reviewCount > 0 && (
                      <View style={{ alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Star size={14} color={t.warm} fill={t.warm} />
                          <Text
                            style={{
                              fontFamily: 'InstrumentSerif-Regular',
                              fontSize: 18,
                              color: t.ink,
                            }}
                          >
                            {trip.averageRating.toFixed(1)}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: t.ink3 }}>
                          {trip.reviewCount} {trip.reviewCount === 1 ? 'review' : 'reviews'}
                        </Text>
                      </View>
                    )}
                  {trip.viewCount != null && trip.viewCount > 0 && (
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={{
                          fontFamily: 'InstrumentSerif-Regular',
                          fontSize: 18,
                          color: t.ink,
                        }}
                      >
                        {trip.viewCount}
                      </Text>
                      <Text style={{ fontSize: 11, color: t.ink3 }}>{i18n('trips.views')}</Text>
                    </View>
                  )}
                  {trip.cloneCount != null && trip.cloneCount > 0 && (
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Copy size={14} color={t.ink2} />
                        <Text
                          style={{
                            fontFamily: 'InstrumentSerif-Regular',
                            fontSize: 18,
                            color: t.ink,
                          }}
                        >
                          {trip.cloneCount}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: t.ink3 }}>{i18n('trips.clones')}</Text>
                    </View>
                  )}
                </Animated.View>

                {/* Curvature index badge */}
                {trip.curvatureIndex != null && trip.curvatureIndex > 0 && (
                  <Animated.View
                    entering={FadeInUp.delay(80).duration(220)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 14,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: subtitleColor }}>
                      Curvature index: {trip.curvatureIndex.toFixed(1)}
                    </Text>
                  </Animated.View>
                )}

                {/* Route start/end — resolve generic Start/End to place names when possible */}
                {(() => {
                  if (waypoints.length < 2) return null;
                  const first = waypoints[0];
                  const last = waypoints[waypoints.length - 1];
                  if (!first || !last) return null;
                  return (
                    <TemplateRouteStartEndLine
                      startWp={waypoints.find((w) => w.type === 'start') ?? first}
                      endWp={waypoints.find((w) => w.type === 'end') ?? last}
                      titleColor={titleColor}
                      subtitleColor={subtitleColor}
                      trip={trip}
                      isDark={isDark}
                    />
                  );
                })()}

                {/* Contributor / organiser attribution */}
                <Animated.View
                  entering={FadeInUp.delay(100).duration(220)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 20,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      backgroundColor: t.warm,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: palette.white }}>
                      {(trip.organiser.displayName ?? 'O').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: titleColor }}>
                      {trip.organiser.displayName}
                    </Text>
                    {trip.organiser.publicUsername && (
                      <Text style={{ fontSize: 12, color: subtitleColor }}>
                        @{trip.organiser.publicUsername}
                      </Text>
                    )}
                  </View>
                </Animated.View>

                {/* Template action buttons — clone itinerary or start a blank trip */}
                <Animated.View
                  entering={FadeInUp.delay(110).duration(220)}
                  style={{ gap: 10, marginBottom: 20 }}
                >
                  {!isOrganiser && (
                    <Pressable
                      onPress={handleCloneTemplate}
                      disabled={cloneMutation.isPending}
                      accessibilityRole="button"
                      accessibilityLabel="Clone to My Trips"
                      style={({ pressed }) => ({
                        backgroundColor: t.success,
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
                  )}
                  <Pressable
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios')
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      // Same as clone: pass source id so create-trip sets sane dates (templates have
                      // placeholder 1970 dates) and pre-fills route — user still edits title/dates.
                      router.push({
                        pathname: '/(modals)/create-trip',
                        params: { cloneFromTripId: tripId },
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Plan your own trip"
                    accessibilityHint="Opens the trip planner with this route pre-filled. You set the dates."
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor: t.surface2,
                      borderWidth: 1,
                      borderColor: t.line,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <PenLine size={17} color={t.ink} />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: t.ink,
                      }}
                    >
                      Plan your own trip
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleToggleSave}
                    disabled={saveMutation.isPending || unsaveMutation.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={isSaved ? 'Unsave trip' : 'Save trip'}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: isSaved ? t.warm : t.line,
                    }}
                  >
                    {saveMutation.isPending || unsaveMutation.isPending ? (
                      <ActivityIndicator size="small" color={t.ink3} />
                    ) : isSaved ? (
                      <>
                        <BookmarkCheck size={16} color={t.warm} />
                        <Text style={{ fontSize: 15, fontWeight: '700', color: t.warm }}>
                          Saved
                        </Text>
                      </>
                    ) : (
                      <>
                        <Bookmark size={16} color={t.ink} />
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '700',
                            color: t.ink,
                          }}
                        >
                          Save for Later
                        </Text>
                      </>
                    )}
                  </Pressable>
                </Animated.View>

                {/* Reviews section */}
                <Animated.View
                  entering={FadeInUp.delay(120).duration(220)}
                  style={{ marginBottom: 20 }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: t.ink2,
                      marginBottom: 12,
                      textTransform: 'uppercase',
                      letterSpacing: 2.2,
                    }}
                  >
                    Reviews
                  </Text>
                  {reviewsLoading ? (
                    <ActivityIndicator size="small" color={t.warm} />
                  ) : reviews.length === 0 ? (
                    <Text style={{ fontSize: 13, color: subtitleColor, marginBottom: 12 }}>
                      No reviews yet. Be the first to share your experience!
                    </Text>
                  ) : (
                    reviews.map((review, idx) => (
                      <Animated.View
                        key={review.id}
                        entering={FadeInUp.delay(idx * 40).duration(200)}
                        style={{
                          padding: 12,
                          marginBottom: 8,
                          borderRadius: 12,
                          borderCurve: 'continuous',
                          backgroundColor: t.surface,
                          borderWidth: 1,
                          borderColor: t.line,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            marginBottom: 4,
                          }}
                        >
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size star rating array
                              key={i}
                              size={14}
                              color={t.warm}
                              fill={i < review.rating ? t.warm : 'transparent'}
                            />
                          ))}
                        </View>
                        {review.text && (
                          <Text style={{ fontSize: 13, color: bodyColor, lineHeight: 18 }}>
                            {review.text}
                          </Text>
                        )}
                        <Text style={{ fontSize: 11, color: subtitleColor, marginTop: 4 }}>
                          {new Date(review.createdAt).toLocaleDateString()}
                        </Text>
                      </Animated.View>
                    ))
                  )}

                  {/* Write review toggle */}
                  {!reviewFormVisible ? (
                    <Pressable
                      onPress={() => {
                        if (process.env.EXPO_OS === 'ios')
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setReviewFormVisible(true);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderCurve: 'continuous',
                        borderWidth: 1,
                        borderColor: t.line,
                        marginTop: 4,
                      }}
                    >
                      <Star size={14} color={t.warm} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: titleColor }}>
                        Write a Review
                      </Text>
                    </Pressable>
                  ) : (
                    <Animated.View
                      entering={FadeInUp.duration(200)}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                        backgroundColor: t.surface,
                        borderWidth: 1,
                        borderColor: t.line,
                        marginTop: 8,
                      }}
                    >
                      {/* Rating selector */}
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Pressable
                            key={n}
                            onPress={() => {
                              if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
                              setReviewRating(n);
                            }}
                          >
                            <Star
                              size={24}
                              color={t.warm}
                              fill={n <= reviewRating ? t.warm : 'transparent'}
                            />
                          </Pressable>
                        ))}
                      </View>
                      <TextInput
                        value={reviewText}
                        onChangeText={setReviewText}
                        placeholder="Share your experience..."
                        placeholderTextColor={subtitleColor}
                        multiline
                        style={{
                          fontSize: 14,
                          color: titleColor,
                          minHeight: 60,
                          padding: 10,
                          borderRadius: 10,
                          borderCurve: 'continuous',
                          backgroundColor: t.bg,
                          textAlignVertical: 'top',
                          marginBottom: 10,
                        }}
                      />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => setReviewFormVisible(false)}
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 10,
                            borderCurve: 'continuous',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: t.line,
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink3 }}>
                            Cancel
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={handleSubmitReview}
                          disabled={createReviewMutation.isPending}
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 10,
                            borderCurve: 'continuous',
                            alignItems: 'center',
                            backgroundColor: t.warm,
                          }}
                        >
                          {createReviewMutation.isPending ? (
                            <ActivityIndicator size="small" color={palette.white} />
                          ) : (
                            <Text style={{ fontSize: 14, fontWeight: '600', color: palette.white }}>
                              Submit
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </Animated.View>
                  )}
                </Animated.View>
              </>
            )}

            {/* ── Regular trip sections (non-template) ───────────────── */}
            {!isTemplate && (
              <>
                {/* Pre-ride readiness — fed by waypoints/bike/visibility. */}
                <Animated.View entering={FadeInUp.delay(30).duration(250)}>
                  <ReadinessRing report={readiness} onShareBrief={handleShareBrief} />
                </Animated.View>

                {/* Offline pack — download tiles + trip payload for the ride. */}
                <Animated.View entering={FadeInUp.delay(40).duration(250)}>
                  <OfflinePackButton
                    status={offline.status}
                    progress={offline.progress}
                    meta={offline.meta}
                    onDownload={offline.download}
                    onRemove={offline.remove}
                  />
                </Animated.View>
              </>
            )}

            {/* Day-by-day itinerary */}
            {waypointsByDay.length > 0 && (
              <Animated.View
                entering={FadeInUp.delay(50).duration(250)}
                style={{ marginBottom: 16 }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: t.ink2,
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 2.2,
                  }}
                >
                  {isTemplate ? 'Sample itinerary' : 'Itinerary'}
                </Text>
                {isTemplate && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: subtitleColor,
                      marginBottom: 8,
                    }}
                  >
                    You set dates when you clone or plan. Below is the suggested day-by-day flow.
                  </Text>
                )}
                {waypointsByDay.map(([dayIndex, dayWaypoints], sectionIdx) => {
                  const isCollapsed = !!collapsedDays[dayIndex];
                  return (
                    <Animated.View
                      key={dayIndex}
                      entering={FadeInUp.delay(sectionIdx * 60).duration(250)}
                    >
                      {/* Day header */}
                      <Pressable
                        onPress={() => toggleDay(dayIndex)}
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
                          marginTop: 16,
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'InstrumentSerif-Regular',
                            fontSize: 17,
                            color: t.ink,
                          }}
                        >
                          {formatDayDate(dayIndex)}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: subtitleColor }}>
                            {dayWaypoints.length} {dayWaypoints.length === 1 ? 'stop' : 'stops'}
                          </Text>
                          <AnimatedChevron collapsed={isCollapsed} color={subtitleColor} />
                        </View>
                      </Pressable>

                      {/* Waypoints within the day — grouped by period when labelled. */}
                      {!isCollapsed &&
                        groupByPeriod(dayWaypoints).map((group) => (
                          <View key={`${dayIndex}-${group.period ?? 'unset'}`}>
                            {group.period && (
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: subtitleColor,
                                  letterSpacing: 0.6,
                                  textTransform: 'uppercase',
                                  marginTop: 4,
                                  marginBottom: 4,
                                }}
                              >
                                {group.label}
                              </Text>
                            )}
                            {group.items.map((wp, index) => (
                              <ItineraryWaypointRow
                                key={wp.id}
                                wp={wp}
                                index={index}
                                titleColor={titleColor}
                                subtitleColor={subtitleColor}
                                isDark={isDark}
                              />
                            ))}
                          </View>
                        ))}
                    </Animated.View>
                  );
                })}
              </Animated.View>
            )}

            {/* Nav handoff lives on the sticky "Ride this" CTA, not inside the sheet. */}

            {/* Participants — only for regular trips (non-template) */}
            {!isTemplate && trip.participants && trip.participants.length > 0 && (
              <Animated.View
                entering={FadeInUp.delay(100).duration(250)}
                style={{ marginBottom: 16 }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: t.ink2,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 2.2,
                  }}
                >
                  Riders ({trip.participantCount + 1})
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {/* Organizer — always shown first */}
                  <View style={{ alignItems: 'center', gap: 4, width: 64 }}>
                    {trip.organiser.avatarUrl ? (
                      <Image
                        source={{ uri: trip.organiser.avatarUrl }}
                        style={{ width: 36, height: 36, borderRadius: 18 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: t.warm,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.white }}>
                          {(trip.organiser.displayName ?? 'O').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={{ fontSize: 11, color: t.ink3, textAlign: 'center' }}
                      numberOfLines={1}
                    >
                      {trip.organiser.displayName ?? 'Organizer'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '700',
                        color: t.warm,
                        textTransform: 'uppercase',
                      }}
                    >
                      Lead
                    </Text>
                  </View>
                  {trip.participants.map((p) => {
                    const statusInfo =
                      STATUS_ICONS[p.status as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.going;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => p.publicUsername && handleProfilePress(p.publicUsername)}
                        onLongPress={
                          isOrganiser
                            ? () =>
                                showRolePicker({
                                  id: p.id,
                                  displayName: p.displayName,
                                  role: p.role,
                                })
                            : undefined
                        }
                        style={{ alignItems: 'center', gap: 4, width: 64 }}
                      >
                        <View>
                          {p.avatarUrl ? (
                            <Image
                              source={{ uri: p.avatarUrl }}
                              style={{ width: 36, height: 36, borderRadius: 18 }}
                            />
                          ) : (
                            <View
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: t.surface2,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <User size={16} color={subtitleColor} />
                            </View>
                          )}
                          <View
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              right: -2,
                              width: 14,
                              height: 14,
                              borderRadius: 7,
                              backgroundColor: sheetBg,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <statusInfo.Icon size={10} color={statusInfo.color} />
                          </View>
                        </View>
                        <Text
                          style={{ fontSize: 13, color: subtitleColor, textAlign: 'center' }}
                          numberOfLines={1}
                        >
                          {p.displayName}
                        </Text>
                        {p.role === 'co_planner' && (
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: t.warm,
                              textAlign: 'center',
                            }}
                          >
                            Co-planner
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            )}

            {/* P5.1 — async waypoint suggestions */}
            {!isTemplate && (
              <SuggestionsSection
                suggestions={tripSuggestions.suggestions}
                isLoading={tripSuggestions.isLoading}
                canDecide={canDecideSuggestions}
                currentUserId={userId ?? undefined}
                onRespond={tripSuggestions.respond}
                respondingIds={tripSuggestions.respondingIds}
              />
            )}

            {/* Action buttons — non-template trips only */}
            {!isTemplate && (
              <Animated.View
                entering={FadeInUp.delay(150).duration(250)}
                style={{ gap: 10, marginBottom: 20 }}
              >
                {/* Publish to Discover — organizer only, when trip has enough content */}
                {isOrganiser && !publishedToDiscover && waypoints.length >= 2 && (
                  <Pressable
                    onPress={handlePublishToDiscover}
                    disabled={publishToDiscoverMutation.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Publish to Discover"
                    accessibilityHint="Makes this trip a template other riders can browse and clone"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor: t.warm,
                    }}
                  >
                    {publishToDiscoverMutation.isPending ? (
                      <ActivityIndicator size="small" color={palette.white} />
                    ) : (
                      <>
                        <Compass size={16} color={palette.white} />
                        <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                          Publish to Discover
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}

                {/* Published indicator */}
                {isOrganiser && publishedToDiscover && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor: t.surface2,
                      borderWidth: 1,
                      borderColor: t.line,
                    }}
                  >
                    <CheckCircle size={16} color={t.success} />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: t.success,
                      }}
                    >
                      Published on Discover
                    </Text>
                  </View>
                )}

                {/* Clone — available to anyone viewing someone else's public trip. */}
                {!isOrganiser && trip.visibility === 'public' && waypoints.length > 0 && (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(modals)/create-trip',
                        params: { cloneFromTripId: tripId },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Clone this trip"
                    accessibilityHint="Opens the planner pre-filled with this trip's waypoints"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor: t.surface2,
                      borderWidth: 1,
                      borderColor: t.line,
                    }}
                  >
                    <Plus size={16} color={t.ink} />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: t.ink,
                      }}
                    >
                      Clone this trip
                    </Text>
                  </Pressable>
                )}

                {/* Join (going) */}
                {!myParticipant && !isOrganiser && (
                  <Pressable
                    onPress={() => joinMutation.mutate('going')}
                    disabled={actionLoading}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor: t.success,
                    }}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color={palette.white} />
                    ) : (
                      <>
                        <Users size={16} color={palette.white} />
                        <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                          I'm in
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}

                {/* Maybe */}
                {!myParticipant && !isOrganiser && (
                  <Pressable
                    onPress={() => joinMutation.mutate('maybe')}
                    disabled={actionLoading}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: t.warm,
                    }}
                  >
                    <HelpCircle size={16} color={t.warm} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: t.warm }}>
                      {i18n('trips.maybe')}
                    </Text>
                  </Pressable>
                )}

                {/* Leave */}
                {myParticipant && !isOrganiser && (
                  <Pressable
                    onPress={handleLeave}
                    disabled={actionLoading}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: t.danger,
                    }}
                  >
                    <LogOut size={16} color={t.danger} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: t.danger }}>
                      {i18n('trips.leave')}
                    </Text>
                  </Pressable>
                )}
              </Animated.View>
            )}

            {/* Comments */}
            <CommentList tripId={tripId} />
          </BottomSheetScrollView>
        </BottomSheet>

        {isOrganiser && (
          <TripShareSheet
            tripId={tripId}
            visible={shareSheetVisible}
            onClose={() => setShareSheetVisible(false)}
            tripStatus={trip?.status}
          />
        )}

        {/* Sticky primary CTA — one unambiguous action per screen.
            Hidden while the assistant or ride-this sheets are open so it
            doesn't bleed through over their input/footer rows. */}
        {navWaypoints.length >= 2 && !isTemplate && !assistantOpen && !rideThis.visible && (
          <RideThisStickyCta onPress={rideThis.open} subtitle={`${navWaypoints.length} stops`} />
        )}

        {/* Trip-context AI assistant sheet — triggered from the top-right AI button. */}
        <TripAssistantSheet
          visible={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          messages={assistant.messages}
          isPending={assistant.isPending}
          onAsk={assistant.ask}
          onReset={assistant.reset}
        />

        <RideThisSheet
          visible={rideThis.visible}
          onClose={rideThis.close}
          providers={rideThis.providers}
          activeSegment={rideThis.activeSegment}
          onProvider={rideThis.triggerProvider}
          onAdvance={rideThis.advanceSegment}
          selectedDay={rideThis.selectedDay}
          onSelectDay={rideThis.setSelectedDay}
          availableDays={rideThis.availableDays}
        />
      </Animated.View>
    </GestureHandlerRootView>
  );
}
