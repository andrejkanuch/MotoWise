import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import {
  JoinTripDocument,
  LeaveTripDocument,
  TripDetailDocument,
  type TripDetailQuery,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system/next';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Globe,
  HelpCircle,
  Lock,
  LogOut,
  Pencil,
  Share2,
  User,
  Users,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentList } from '../../components/comments/comment-list';
import { RideThisSheet, RideThisStickyCta } from '../../components/ride-this-sheet';
import { getWaypointIcon } from '../../components/trip/waypoint-type-picker';
import { TripShareSheet } from '../../components/trip-share-sheet';
import { useRideThis } from '../../hooks/use-ride-this';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { MAP_STYLES } from '../../utils/map-styles';
import { getRouteSegments } from '../../utils/mapbox-directions';
import { showMarkerActionSheet } from '../../utils/marker-action-sheet';
import { groupByPeriod } from '../../utils/period-of-day';

type TripWaypoint = TripDetailQuery['tripDetail']['waypoints'] extends
  | (infer W)[]
  | null
  | undefined
  ? W
  : never;

const DIFFICULTY_COLORS = {
  easy: { bg: palette.successBgLight, bgDark: palette.successBgDark, text: palette.success500 },
  moderate: { bg: palette.warningBgLight, bgDark: palette.warningBgDark, text: palette.warning500 },
  challenging: {
    bg: palette.dangerBgLight,
    bgDark: palette.dangerBgDark,
    text: palette.danger500,
  },
  expert: {
    bg: palette.signatureBgLight,
    bgDark: palette.signatureBgDark,
    text: palette.signature500,
  },
} as const;

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

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} \u2013 ${e.toLocaleDateString('en-US', opts)}`;
}

export default function TripDetailScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const sheetRef = useRef<BottomSheet>(null);
  const userId = useAuthStore((s) => s.session?.user?.id);
  const [actionLoading, setActionLoading] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  const bg = isDark ? palette.neutral950 : palette.white;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const sheetBg = isDark ? palette.cardDark : palette.white;
  const sectionLabelColor = isDark ? palette.neutral500 : palette.neutral400;
  const bodyColor = isDark ? palette.neutral300 : palette.neutral600;

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

  const tripDays = useMemo(() => {
    if (!trip?.startDate || !trip?.endDate) return 1;
    const ms = new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime();
    return Math.max(1, Math.round(ms / 86_400_000) + 1);
  }, [trip?.startDate, trip?.endDate]);

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
      if (!trip?.startDate) return `Day ${dayIndex + 1}`;
      const date = new Date(trip.startDate);
      date.setDate(date.getDate() + dayIndex);
      const formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `Day ${dayIndex + 1} — ${formatted}`;
    },
    [trip?.startDate],
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

  const difficultyKey = (
    trip?.difficulty ?? 'easy'
  ).toLowerCase() as keyof typeof DIFFICULTY_COLORS;
  const difficultyStyle = DIFFICULTY_COLORS[difficultyKey] ?? DIFFICULTY_COLORS.easy;
  const difficultyLabel = DIFFICULTY_LABELS[difficultyKey] ?? 'Chill';

  const invalidateTrip = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
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
      <View
        style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={palette.accent500} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: bg }}>
        {/* Map */}
        <MapboxGL.MapView
          style={{ flex: 1 }}
          styleURL={MAP_STYLES[isDark ? 'dark' : 'light']}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
        >
          {bounds && (
            <MapboxGL.Camera
              bounds={{
                ...bounds,
                paddingBottom: 200,
                paddingTop: 60,
                paddingLeft: 40,
                paddingRight: 40,
              }}
              animationMode="flyTo"
              animationDuration={500}
            />
          )}
          {routeGeoJSON && (
            <MapboxGL.ShapeSource id="trip-route" shape={routeGeoJSON}>
              <MapboxGL.LineLayer
                id="trip-route-layer"
                style={{
                  lineColor: palette.accent500,
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
              <MapboxGL.PointAnnotation
                key={wp.id}
                id={`wp-${wp.id}`}
                coordinate={[wp.lng, wp.lat]}
                onSelected={() =>
                  showMarkerActionSheet({
                    title: wp.name || 'Waypoint',
                    lat: wp.lat,
                    lng: wp.lng,
                  })
                }
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: wt.color,
                    borderWidth: 2,
                    borderColor: palette.white,
                  }}
                />
              </MapboxGL.PointAnnotation>
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
              width: 40,
              height: 40,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: palette.neutral950,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={20} color={palette.white} />
          </Pressable>
        </View>

        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 12,
            flexDirection: 'row',
            gap: 8,
          }}
        >
          {isOrganiser && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(modals)/create-trip',
                  params: { tripId: trip.id },
                } as never)
              }
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderCurve: 'continuous',
                backgroundColor: palette.neutral950,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pencil size={18} color={palette.white} />
            </Pressable>
          )}
          {isOrganiser && (
            <Pressable
              onPress={handleOpenShareSheet}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderCurve: 'continuous',
                backgroundColor: palette.neutral950,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Share2 size={18} color={palette.white} />
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
            backgroundColor: isDark ? palette.neutral600 : palette.neutral300,
          }}
        >
          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          >
            {/* Title */}
            <Text
              style={{
                fontSize: 24,
                fontWeight: '800',
                color: titleColor,
                letterSpacing: -0.5,
                marginBottom: 10,
              }}
            >
              {trip.title}
            </Text>

            {/* Badge row — difficulty + visibility */}
            <View
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
                  backgroundColor: isDark ? difficultyStyle.bgDark : difficultyStyle.bg,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: difficultyStyle.text }}>
                  {difficultyLabel}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: isDark ? palette.surfaceElevated : palette.neutral100,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                }}
              >
                {trip.visibility === 'public' ? (
                  <Globe size={11} color={palette.success500} />
                ) : trip.visibility === 'unlisted' ? (
                  <EyeOff size={11} color={palette.warning500} />
                ) : (
                  <Lock size={11} color={palette.neutral500} />
                )}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color:
                      trip.visibility === 'public'
                        ? palette.success500
                        : trip.visibility === 'unlisted'
                          ? palette.warning500
                          : palette.neutral500,
                  }}
                >
                  {trip.visibility === 'public'
                    ? 'Public'
                    : trip.visibility === 'unlisted'
                      ? 'Link only'
                      : 'Private'}
                </Text>
              </View>
            </View>

            {/* Stats bar — the at-a-glance decision data */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
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
                    fontSize: 18,
                    fontWeight: '800',
                    color: titleColor,
                    letterSpacing: -0.3,
                  }}
                >
                  {tripDays}
                </Text>
                <Text style={{ fontSize: 11, color: subtitleColor, fontWeight: '600' }}>
                  {tripDays === 1 ? 'day' : 'days'}
                </Text>
              </View>
              <View
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  backgroundColor: isDark ? palette.surfaceElevated : palette.neutral200,
                }}
              />
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    color: titleColor,
                    letterSpacing: -0.3,
                  }}
                >
                  {waypoints.length}
                </Text>
                <Text style={{ fontSize: 11, color: subtitleColor, fontWeight: '600' }}>
                  {waypoints.length === 1 ? 'stop' : 'stops'}
                </Text>
              </View>
              <View
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  backgroundColor: isDark ? palette.surfaceElevated : palette.neutral200,
                }}
              />
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    color: titleColor,
                    letterSpacing: -0.3,
                  }}
                >
                  {trip.participantCount}
                  <Text style={{ color: subtitleColor }}>/{trip.maxRiders}</Text>
                </Text>
                <Text style={{ fontSize: 11, color: subtitleColor, fontWeight: '600' }}>
                  riders
                </Text>
              </View>
            </View>

            {/* Date + organiser compact row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={13} color={palette.accent500} />
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
            </View>

            {/* Description — now below the decision-relevant data */}
            {trip.description && (
              <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, lineHeight: 20, color: bodyColor }}>
                  {trip.description}
                </Text>
              </Animated.View>
            )}

            {/* Day-by-day itinerary */}
            {waypointsByDay.length > 0 && (
              <Animated.View
                entering={FadeInUp.delay(50).duration(250)}
                style={{ marginBottom: 16 }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: sectionLabelColor,
                    marginBottom: 4,
                  }}
                >
                  Itinerary
                </Text>
                {waypointsByDay.map(([dayIndex, dayWaypoints], sectionIdx) => {
                  const isCollapsed = !!collapsedDays[dayIndex];
                  const DayChevron = isCollapsed ? ChevronDown : ChevronUp;
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
                          backgroundColor: isDark ? palette.surfaceElevated : palette.neutral100,
                          borderRadius: 12,
                          borderCurve: 'continuous',
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          marginTop: 16,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: '700', color: titleColor }}>
                          {formatDayDate(dayIndex)}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: subtitleColor }}>
                            {dayWaypoints.length} {dayWaypoints.length === 1 ? 'stop' : 'stops'}
                          </Text>
                          <DayChevron size={16} color={subtitleColor} />
                        </View>
                      </Pressable>

                      {/* Waypoints within the day — grouped by period when labelled. */}
                      {!isCollapsed &&
                        groupByPeriod(dayWaypoints).map((group) => (
                          <View key={`${dayIndex}-${group.period ?? 'unset'}`}>
                            {group.period && (
                              <Text
                                style={{
                                  fontSize: 11,
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
                            {group.items.map((wp, index) => {
                              const wt = getWaypointIcon(wp.type);
                              return (
                                <Animated.View
                                  key={wp.id}
                                  entering={FadeInUp.delay(index * 40).duration(200)}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: 10,
                                    marginBottom: 6,
                                    borderRadius: 10,
                                    borderCurve: 'continuous',
                                    backgroundColor: isDark
                                      ? palette.surfaceSubtle
                                      : palette.neutral50,
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
                                    <Text
                                      style={{ fontSize: 14, fontWeight: '600', color: titleColor }}
                                      numberOfLines={1}
                                    >
                                      {wp.name}
                                    </Text>
                                    {wp.notes ? (
                                      <Text
                                        style={{
                                          fontSize: 12,
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
                            })}
                          </View>
                        ))}
                    </Animated.View>
                  );
                })}
              </Animated.View>
            )}

            {/* Nav handoff lives on the sticky "Ride this" CTA, not inside the sheet. */}

            {/* Participants */}
            {trip.participants && trip.participants.length > 0 && (
              <Animated.View
                entering={FadeInUp.delay(100).duration(250)}
                style={{ marginBottom: 16 }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: sectionLabelColor,
                    marginBottom: 8,
                  }}
                >
                  Riders ({trip.participantCount})
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {trip.participants.map((p) => {
                    const statusInfo =
                      STATUS_ICONS[p.status as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.going;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => p.publicUsername && handleProfilePress(p.publicUsername)}
                        style={{ alignItems: 'center', gap: 4, width: 56 }}
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
                                backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
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
                          style={{ fontSize: 10, color: subtitleColor, textAlign: 'center' }}
                          numberOfLines={1}
                        >
                          {p.displayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            )}

            {/* Action buttons */}
            <Animated.View
              entering={FadeInUp.delay(150).duration(250)}
              style={{ gap: 10, marginBottom: 20 }}
            >
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
                    backgroundColor: palette.accent500,
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
                    borderColor: palette.warning500,
                  }}
                >
                  <HelpCircle size={16} color={palette.warning500} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: palette.warning500 }}>
                    Maybe
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
                    borderColor: palette.danger500,
                  }}
                >
                  <LogOut size={16} color={palette.danger500} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: palette.danger500 }}>
                    Leave
                  </Text>
                </Pressable>
              )}
            </Animated.View>

            {/* Comments */}
            <CommentList tripId={tripId} />
          </BottomSheetScrollView>
        </BottomSheet>

        {isOrganiser && (
          <TripShareSheet
            tripId={tripId}
            visible={shareSheetVisible}
            onClose={() => setShareSheetVisible(false)}
          />
        )}

        {/* Sticky primary CTA — one unambiguous action per screen. */}
        {navWaypoints.length >= 2 && (
          <RideThisStickyCta onPress={rideThis.open} subtitle={`${navWaypoints.length} stops`} />
        )}

        <RideThisSheet
          visible={rideThis.visible}
          onClose={rideThis.close}
          providers={rideThis.providers}
          activeSegment={rideThis.activeSegment}
          onProvider={rideThis.triggerProvider}
          onAdvance={rideThis.advanceSegment}
        />
      </View>
    </GestureHandlerRootView>
  );
}
