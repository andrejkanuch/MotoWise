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
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileDown,
  HelpCircle,
  LogOut,
  Navigation,
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
  Linking,
  Platform,
  Pressable,
  Share,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentList } from '../../components/comments/comment-list';
import { getWaypointIcon } from '../../components/trip/waypoint-type-picker';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { MAP_STYLES } from '../../utils/map-styles';

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

  const routeGeoJSON = useMemo(() => {
    if (waypointCoords.length < 2) return null;
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: waypointCoords },
      properties: {},
    };
  }, [waypointCoords]);

  const isOrganiser = trip?.organiser.id === userId;
  const myParticipant = useMemo(
    () => trip?.participants?.find((p) => p.id === userId),
    [trip?.participants, userId],
  );

  const difficultyKey = (
    trip?.difficulty ?? 'easy'
  ).toLowerCase() as keyof typeof DIFFICULTY_COLORS;
  const difficultyStyle = DIFFICULTY_COLORS[difficultyKey] ?? DIFFICULTY_COLORS.easy;
  const difficultyLabel = difficultyKey.charAt(0).toUpperCase() + difficultyKey.slice(1);

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
    Alert.alert('Leave Trip', 'Are you sure you want to leave this trip?', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate() },
    ]);
  }, [leaveMutation]);

  const handleOpenInMaps = useCallback(() => {
    if (waypoints.length === 0) return;
    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];
    const isIOS = Platform.OS === 'ios';

    trackEvent(AnalyticsEvent.TRIP_OPENED_IN_MAPS, {
      trip_id: tripId,
      waypoint_count: waypoints.length,
    });

    if (isIOS) {
      const url = `maps://?saddr=${first.lat},${first.lng}&daddr=${last.lat},${last.lng}`;
      Linking.openURL(url);
    } else {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${first.lat},${first.lng}&destination=${last.lat},${last.lng}`;
      Linking.openURL(url);
    }
  }, [waypoints, tripId]);

  const handleShare = useCallback(async () => {
    if (!trip) return;
    await Share.share({
      message: `Check out this trip on MotoVault: ${trip.title}`,
      url: `https://motovault.app/trips/${tripId}`,
    });
    trackEvent(AnalyticsEvent.TRIP_SHARED, { trip_id: tripId });
  }, [trip, tripId]);

  const handleExportGPX = useCallback(async () => {
    if (!trip) return;
    if (waypoints.length < 2) {
      Alert.alert('Not enough stops', 'Add at least 2 stops before exporting.');
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
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, gpx, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/gpx+xml',
      UTI: 'com.topografix.gpx',
    });

    trackEvent(AnalyticsEvent.TRIP_SHARED, { trip_id: tripId, method: 'gpx' });
  }, [trip, waypoints, tripId]);

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
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Map */}
      <MapboxGL.MapView
        style={{ flex: 1 }}
        styleURL={MAP_STYLES.dark}
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
            <MapboxGL.PointAnnotation key={wp.id} id={`wp-${wp.id}`} coordinate={[wp.lng, wp.lat]}>
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
            backgroundColor: 'rgba(0,0,0,0.5)',
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
        <Pressable
          onPress={handleShare}
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
          <Share2 size={18} color={palette.white} />
        </Pressable>
      </View>

      {/* Bottom sheet */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={['40%', '70%', '92%']}
        index={0}
        backgroundStyle={{ backgroundColor: sheetBg, borderRadius: 24, borderCurve: 'continuous' }}
        handleIndicatorStyle={{ backgroundColor: isDark ? palette.neutral600 : palette.neutral300 }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {/* Title */}
          <Text style={{ fontSize: 22, fontWeight: '800', color: titleColor, marginBottom: 4 }}>
            {trip.title}
          </Text>

          {/* Difficulty badge + organiser */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <View
              style={{
                backgroundColor: isDark ? difficultyStyle.bgDark : difficultyStyle.bg,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderCurve: 'continuous',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: difficultyStyle.text }}>
                {difficultyLabel}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <User size={13} color={subtitleColor} />
              <Text style={{ fontSize: 13, color: subtitleColor }}>
                {trip.organiser.displayName}
              </Text>
            </View>
          </View>

          {/* Date range */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Calendar size={14} color={palette.accent500} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: subtitleColor }}>
              {formatDateRange(trip.startDate, trip.endDate)}
            </Text>
          </View>

          {/* Description */}
          {trip.description && (
            <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, lineHeight: 20, color: bodyColor }}>
                {trip.description}
              </Text>
            </Animated.View>
          )}

          {/* Rider count */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderCurve: 'continuous',
              marginBottom: 16,
            }}
          >
            <Users size={16} color={palette.accent500} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: titleColor }}>
              {trip.participantCount}/{trip.maxRiders} riders
            </Text>
          </View>

          {/* Day-by-day itinerary */}
          {waypointsByDay.length > 0 && (
            <Animated.View entering={FadeInUp.delay(50).duration(250)} style={{ marginBottom: 16 }}>
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

                    {/* Waypoints within the day */}
                    {!isCollapsed &&
                      dayWaypoints.map((wp, index) => {
                        const wt = getWaypointIcon(wp.type);
                        return (
                          <Animated.View
                            key={wp.id}
                            entering={FadeInUp.delay(index * 50).duration(200)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 12,
                              padding: 10,
                              marginBottom: 6,
                              borderRadius: 10,
                              borderCurve: 'continuous',
                              backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral50,
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
                                  style={{ fontSize: 12, color: subtitleColor, marginTop: 2 }}
                                  numberOfLines={2}
                                >
                                  {wp.notes}
                                </Text>
                              ) : null}
                            </View>
                          </Animated.View>
                        );
                      })}
                  </Animated.View>
                );
              })}
            </Animated.View>
          )}

          {/* Open in Maps */}
          {waypoints.length > 0 && (
            <Pressable
              onPress={handleOpenInMaps}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 12,
                borderRadius: 12,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: palette.accent500,
                marginBottom: 16,
              }}
            >
              <Navigation size={16} color={palette.accent500} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accent500 }}>
                Open in Maps
              </Text>
            </Pressable>
          )}

          {/* Export GPX */}
          {waypoints.length > 0 && (
            <Pressable
              onPress={handleExportGPX}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 12,
                borderRadius: 12,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: palette.accent500,
                marginBottom: 16,
              }}
            >
              <FileDown size={16} color={palette.accent500} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accent500 }}>
                Export GPX
              </Text>
            </Pressable>
          )}

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
                      Join Trip
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
                  Leave Trip
                </Text>
              </Pressable>
            )}
          </Animated.View>

          {/* Comments */}
          <CommentList tripId={tripId} />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
