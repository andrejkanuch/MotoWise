import { palette } from '@motovault/design-system';
import { RideOverviewDocument, type RideOverviewQuery } from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Compass,
  Gauge,
  Layers,
  Pencil,
  Receipt,
  Route,
  Share2,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react-native';
// NOTE: palette is kept only for speed-gradient colors (speedSlow/Medium/Fast)
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeToggle } from '../../components/ui/native-toggle';
import { finalizeEndedRide } from '../../features/ride/ride-controller';
import { RidePurposeSheet } from '../../features/ride/ride-purpose-sheet';
import { RideSummaryInsightsCard } from '../../features/ride/ride-summary-insights-card';
import { useBikeName } from '../../hooks/use-bike-name';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { CORE_ACTION_KIND, recordCoreAction } from '../../lib/core-action-milestones';
import { gqlFetcher } from '../../lib/graphql-client';
import { invalidateSavedRide } from '../../lib/invalidate';
import { logger } from '../../lib/logger';
import { MetaAnalytics } from '../../lib/meta-analytics';
import { queryKeys } from '../../lib/query-keys';
import { RIDE_SAVE_TRIGGER, trackRideCompleted } from '../../lib/ride-analytics';
import { requestRideReview } from '../../lib/store-review';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, type } from '../../theme/type';
import { triggerImpact, triggerNotification } from '../../utils/haptics';
import {
  cycleMapStyle as cycleMapStyleFn,
  getDefaultMapStyle,
  MAP_STYLES,
} from '../../utils/map-styles';
import { pbDeltaSuffix, recordLabel, rideShareMessage } from '../../utils/ride-constants';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatSpeed,
} from '../../utils/ride-formatters';
import { getPointBuffer, getWaypointChunks } from '../../utils/ride-storage';
import { dropDeadLetteredRide, enqueueOrExecute } from '../../utils/ride-sync-queue';

const MAP_HEIGHT = 260;
const SHEET_RADIUS = 28;

/** Smart ride naming using time-of-day, in the app language ("Saturday Morning Ride"). */
function smartRideName(startedAt: number, t: TFunction, locale: string): string {
  const date = new Date(startedAt);
  const hour = date.getHours();
  const day = date.toLocaleDateString(locale, { weekday: 'long' });
  if (hour < 6 || hour >= 21) return t('rideSummary.smartName.night', { day });
  if (hour < 12) return t('rideSummary.smartName.morning', { day });
  if (hour < 17) return t('rideSummary.smartName.afternoon', { day });
  return t('rideSummary.smartName.evening', { day });
}

export default function RideSummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const system = useMeasurementSystem();
  const params = useLocalSearchParams<{
    rideId: string;
    distanceM: string;
    durationS: string;
    maxSpeedMps: string;
    avgSpeedMps: string;
    elevationGain: string;
    elevationLoss: string;
    startedAt: string;
    motorcycleId: string;
    movingTimeS: string;
  }>();

  const rideId = params.rideId ?? '';
  const distanceM = Number(params.distanceM) || 0;
  const durationS = Number(params.durationS) || 0;
  const maxSpeedMps = Number(params.maxSpeedMps) || 0;
  const avgSpeedMps = Number(params.avgSpeedMps) || 0;
  const elevationGain = Number(params.elevationGain) || 0;
  const elevationLoss = Number(params.elevationLoss) || 0;
  const startedAtMs = Number(params.startedAt) || Date.now();
  const motorcycleId = params.motorcycleId ?? '';
  const movingTimeS = Number(params.movingTimeS) || 0;

  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const { t: theme, isDark } = useEditorialTheme();

  // Android back would leave without Save or Discard (a stranded ride, as the iOS swipe).
  // Focus-scoped: Add Expense is pushed on top and must keep its own back button.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );
  const [mapStyle, setMapStyle] = useState(() => getDefaultMapStyle(isDark));
  const [defaultRideName] = useState(() => smartRideName(startedAtMs, t, i18n.language));
  const [rideName, setRideName] = useState(defaultRideName);
  const [isSaving, setIsSaving] = useState(false);
  const [shareToDiscover, setShareToDiscover] = useState(false);
  const [pbDismissed, setPbDismissed] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);

  const bikeName = useBikeName(motorcycleId);

  const { data: overviewData } = useQuery<RideOverviewQuery>({
    queryKey: queryKeys.rides.overview,
    queryFn: () => gqlFetcher(RideOverviewDocument),
    staleTime: 0,
  });

  const newRecords = useMemo(
    () =>
      (overviewData?.rideOverview?.personalRecords ?? []).filter(
        (r) => r.rideId === rideId && r.previousValue != null,
      ),
    [overviewData?.rideOverview?.personalRecords, rideId],
  );

  const pbRecord = newRecords.length > 0 && !pbDismissed ? newRecords[0] : null;
  const pbDelta = pbRecord?.previousValue
    ? Math.round(((pbRecord.value - pbRecord.previousValue) / pbRecord.previousValue) * 100)
    : null;

  // Build route from stored waypoints
  const routeData = useMemo(() => {
    const chunks = getWaypointChunks(rideId);
    const allWaypoints = chunks.flat();
    const buffer = [...getPointBuffer()];
    const combined = [...allWaypoints, ...buffer];

    if (combined.length < 2) return null;

    const coordinates: [number, number][] = [];
    const speedValues: number[] = [];

    let minLng = combined[0].longitude;
    let maxLng = combined[0].longitude;
    let minLat = combined[0].latitude;
    let maxLat = combined[0].latitude;

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

    // Speed-gradient color stops — downsample to max ~200 entries
    const totalDist = cumulativeDistance || 1;
    const rawStops: [number, string][] = [];
    let lastPct = -1;
    for (let i = 0; i < combined.length; i++) {
      const pct = Math.round((distances[i] / totalDist) * 10000) / 10000;
      if (pct <= lastPct) continue;
      const speedKmh = (speedValues[i] ?? 0) * 3.6;
      let color: string;
      if (speedKmh < 30) color = palette.speedSlow;
      else if (speedKmh < 80) color = palette.speedMedium;
      else color = palette.speedFast;
      rawStops.push([pct, color]);
      lastPct = pct;
    }

    let colorStops = rawStops;
    if (rawStops.length > 200) {
      const step = Math.ceil(rawStops.length / 200);
      colorStops = rawStops.filter(
        (_, i) => i === 0 || i === rawStops.length - 1 || i % step === 0,
      );
    }

    if (colorStops.length === 0) {
      colorStops = [
        [0, palette.speedSlow],
        [1, palette.speedSlow],
      ];
    } else {
      if (colorStops[0][0] !== 0) colorStops.unshift([0, colorStops[0][1]]);
      if (colorStops[colorStops.length - 1][0] !== 1)
        colorStops.push([1, colorStops[colorStops.length - 1][1]]);
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
    triggerImpact();
    try {
      await Share.share({
        message: rideShareMessage(t, formatDistance(distanceM, system), formatDuration(durationS)),
      });
      trackEvent(AnalyticsEvent.RIDE_SHARED, {
        distance_m: distanceM,
        duration_s: durationS,
      });
    } catch {} // the rider cancelled the share sheet
  }, [distanceM, durationS, system, t]);

  // A ref guards a second tap synchronously (`isSaving` lands too late). Reset only on
  // failure: on success one replace (issue 4446) swaps the sheet for `destinationRef`.
  const savingRef = useRef(false);
  const destinationRef = useRef<Href>('/(tabs)/(profile)');
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      triggerNotification(Haptics.NotificationFeedbackType.Success);

      enqueueOrExecute('updateRide', {
        variables: {
          input: {
            rideId,
            name: rideName || null,
          },
        },
      });

      const stillPending = finalizeEndedRide(rideId);
      invalidateSavedRide(queryClient);
      if (stillPending) {
        trackRideCompleted({
          trigger: RIDE_SAVE_TRIGGER.SUMMARY,
          rideId,
          motorcycleId,
          distanceM,
          durationS,
          properties: {
            max_speed_kmh: Math.round(maxSpeedMps * 3.6),
            avg_speed_kmh: Math.round(avgSpeedMps * 3.6),
            shared_to_discover: shareToDiscover,
          },
        });
        MetaAnalytics.trackLogRide();
      }
      const localRideCount = recordCoreAction(CORE_ACTION_KIND.RIDE_SAVED);

      // Share to Discover (fire-and-forget, non-blocking)
      if (shareToDiscover) {
        import('@motovault/graphql').then(({ ShareRideAsTripDocument }) => {
          import('../../lib/graphql-client').then(({ gqlFetcher: fetcher }) => {
            fetcher(ShareRideAsTripDocument, {
              input: { rideId, name: rideName || undefined },
            }).catch((err: unknown) => logger.warn('[RideSummary] Share to Discover failed:', err));
          });
        });
      }

      // Ask while the ride's stats are still on screen; navigation waits for the dialog.
      const overview = overviewData?.rideOverview;
      await requestRideReview({ distanceM, durationS, rideId, localRideCount, overview });
      router.replace(destinationRef.current, { withAnchor: true });
    } catch (error) {
      savingRef.current = false;
      captureException(error, { source: 'ride-summary.saveRide', rideId });
    } finally {
      setIsSaving(false);
    }
  }, [
    rideId,
    rideName,
    router,
    distanceM,
    durationS,
    shareToDiscover,
    queryClient,
    motorcycleId,
    maxSpeedMps,
    avgSpeedMps,
    overviewData?.rideOverview,
  ]);

  const handleDiscard = useCallback(() => {
    Alert.alert(t('rideSummary.discardTitle'), t('rideSummary.discardMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('rideSummary.discardConfirm'),
        style: 'destructive',
        onPress: () => {
          trackEvent(AnalyticsEvent.RIDE_DISCARDED, {
            ride_id: rideId,
            distance_m: distanceM,
            duration_s: durationS,
          });
          // Completed on the server when it ended, so delete it or it stays in history.
          // Refetch after the delete drains: an immediate refetch brings it back.
          dropDeadLetteredRide(rideId);
          void enqueueOrExecute('deleteRide', { variables: { id: rideId } }).finally(() =>
            queryClient.invalidateQueries({ queryKey: queryKeys.rides.all }),
          );
          finalizeEndedRide(rideId);
          router.replace('/(tabs)/(profile)');
        },
      },
    ]);
  }, [rideId, router, distanceM, durationS, queryClient, t]);

  const handleCycleMapStyle = useCallback(() => {
    // Compute next outside the state updater: firing inside it double-counts under
    // StrictMode (see B2). Hit on every ride_completed, so preference shows up here.
    const next = cycleMapStyleFn(mapStyle);
    trackEvent(AnalyticsEvent.RIDE_MAP_STYLE_CHANGED, {
      from_style: mapStyle,
      to_style: next,
      surface: 'ride_summary',
    });
    setMapStyle(next);
  }, [mapStyle]);

  const stats = [
    {
      icon: Route,
      label: t('rideSummary.stats.distance'),
      value: formatDistance(distanceM, system),
    },
    { icon: Clock, label: t('rideSummary.stats.movingTime'), value: formatDuration(movingTimeS) },
    {
      icon: TrendingUp,
      label: t('rideSummary.stats.avgSpeed'),
      value: formatSpeed(avgSpeedMps, system),
    },
    {
      icon: Gauge,
      label: t('rideSummary.stats.maxSpeed'),
      value: formatSpeed(maxSpeedMps, system),
      priv: true,
    },
    {
      icon: ArrowUp,
      label: t('rideSummary.stats.ascent'),
      value: formatElevation(elevationGain, system),
    },
    {
      icon: ArrowDown,
      label: t('rideSummary.stats.descent'),
      value: formatElevation(elevationLoss, system),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ===== Map band (top) ===== */}
      <View style={{ height: MAP_HEIGHT, position: 'relative' }}>
        <MapboxGL.MapView
          ref={mapRef}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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
                animationDuration={0}
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
              <MapboxGL.MarkerView id="start-marker" coordinate={routeData.startPoint}>
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: theme.success,
                    borderWidth: 3,
                    borderColor: theme.ink,
                  }}
                />
              </MapboxGL.MarkerView>

              {/* End marker */}
              <MapboxGL.MarkerView id="end-marker" coordinate={routeData.endPoint}>
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: theme.warm,
                    borderWidth: 3,
                    borderColor: theme.ink,
                  }}
                />
              </MapboxGL.MarkerView>
            </>
          )}
        </MapboxGL.MapView>

        {/* Vignette overlay fading to sheet bg */}
        <LinearGradient
          colors={['transparent', 'transparent', tint(theme.bg, 0.18), theme.bg]}
          locations={[0, 0.55, 0.85, 1]}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: MAP_HEIGHT,
            pointerEvents: 'none',
          }}
        />

        {/* Map action buttons — glass morphism pills */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 10,
            right: 18,
            gap: 10,
          }}
        >
          <Pressable
            onPress={handleCycleMapStyle}
            accessibilityRole="button"
            accessibilityLabel={t('common.changeMapStyleA11y')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.surface, 0.86),
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: palette.black,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 14,
            }}
          >
            <Layers size={18} color={theme.ink} />
          </Pressable>
          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel={t('rideDetail.shareRideA11y')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.surface, 0.86),
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: palette.black,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 14,
            }}
          >
            <Share2 size={16} color={theme.ink} />
          </Pressable>
        </View>
      </View>

      {/* ===== Bottom Sheet ===== */}
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          borderTopLeftRadius: SHEET_RADIUS,
          borderTopRightRadius: SHEET_RADIUS,
          borderCurve: 'continuous',
          marginTop: -SHEET_RADIUS,
          shadowColor: palette.black,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.2,
          shadowRadius: 30,
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 99,
              backgroundColor: theme.line2,
            }}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: insets.bottom + 38,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {/* Name meta row */}
          <Animated.View entering={FadeIn.delay(100).duration(250)}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: theme.success,
                }}
              />
              <Text style={[type.caption, { color: theme.ink3 }]}>
                {t('rideSummary.savedJustNow')}
                {bikeName ? ` · ${bikeName}` : ''}
              </Text>
            </View>

            {/* Ride name — editable */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 4,
                marginTop: 4,
              }}
            >
              <TextInput
                value={rideName}
                onChangeText={setRideName}
                onBlur={() => {
                  if (rideName !== defaultRideName) {
                    trackEvent(AnalyticsEvent.RIDE_NAME_EDITED, {
                      ride_id: rideId,
                      name_length: rideName.length,
                      is_default_name: false,
                    });
                  }
                }}
                placeholder={t('rideSummary.namePlaceholder')}
                placeholderTextColor={theme.ink4}
                maxLength={100}
                accessibilityLabel={t('rideSummary.rideNameA11y')}
                style={[type.sheetTitle, { flex: 1, color: theme.ink, padding: 0 }]}
              />
              <Pencil size={16} color={theme.ink3} />
            </View>
          </Animated.View>

          {/* PB banner */}
          {pbRecord && (
            <Animated.View entering={FadeInUp.delay(200).duration(300)}>
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: radius.card,
                  borderCurve: 'continuous',
                  padding: 12,
                  paddingRight: 14,
                  paddingBottom: 13,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: theme.line,
                }}
              >
                {/* Trophy icon box */}
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.chip,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                    backgroundColor: theme.surface2,
                  }}
                >
                  <Trophy size={20} color={theme.ink2} />
                </View>

                {/* PB body */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[type.caption, { color: theme.ink3 }]}>
                      {t('rideSummary.personalBest')}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 1.5,
                        borderRadius: 99,
                        borderWidth: 1,
                        borderColor: theme.line2,
                      }}
                    >
                      <Text style={[type.caption, { color: theme.ink2 }]}>
                        {t('rideSummary.pbBadge')}
                      </Text>
                    </View>
                  </View>
                  <Text style={[type.bodyStrong, { color: theme.ink, marginTop: 2 }]}>
                    {recordLabel(t, pbRecord.recordType, t('rideSummary.record.fallback'))}
                  </Text>
                  <Text
                    style={[
                      type.caption,
                      { color: theme.ink2, marginTop: 2, fontVariant: ['tabular-nums'] },
                    ]}
                  >
                    {formatDistance(distanceM, system)}
                    {pbDeltaSuffix(t, pbDelta)}
                  </Text>
                </View>

                {/* Dismiss X */}
                <Pressable
                  onPress={() => setPbDismissed(true)}
                  hitSlop={12}
                  style={{ opacity: 0.6 }}
                >
                  <X size={14} color={theme.ink3} />
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* 2x3 stat grid */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(300)}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
          >
            {stats.map(({ icon: Icon, label, value, priv }, index) => (
              <Animated.View
                key={label}
                entering={FadeInUp.delay(300 + index * 50).duration(250)}
                style={{
                  flexBasis: '47%',
                  flexGrow: 1,
                  backgroundColor: theme.surface,
                  borderRadius: radius.card,
                  borderCurve: 'continuous',
                  padding: 12,
                  paddingHorizontal: 14,
                  paddingBottom: 14,
                  minHeight: 78,
                  borderWidth: 1,
                  borderColor: theme.line,
                }}
              >
                {/* Private pill for max speed */}
                {priv && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      backgroundColor: theme.line,
                      borderRadius: 99,
                      paddingHorizontal: 5,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={[type.caption, { fontSize: 10, lineHeight: 12, color: theme.ink3 }]}
                    >
                      {t('rideDetail.private')}
                    </Text>
                  </View>
                )}

                {/* Icon */}
                <View style={{ marginBottom: 6 }}>
                  <Icon size={18} color={theme.ink3} />
                </View>

                {/* Label */}
                <Text style={[type.caption, { color: theme.ink3 }]}>{label}</Text>

                {/* Value */}
                <Text style={[type.figure, { color: theme.ink, marginTop: 2 }]}>{value}</Text>
              </Animated.View>
            ))}
          </Animated.View>

          {/* Opening Rider insights saves the ride first: leaving unsaved strands it. */}
          <RideSummaryInsightsCard
            rideId={rideId}
            distanceM={distanceM}
            movingS={movingTimeS}
            onOpenInsights={(href) => {
              destinationRef.current = href;
              void handleSave();
            }}
          />
          <RidePurposeSheet rideId={rideId} motorcycleId={motorcycleId} />
          <Animated.View entering={FadeInUp.delay(600).duration(250)}>
            <Pressable
              onPress={() => {
                triggerImpact();
                router.push({
                  pathname: '/(modals)/add-ride-expense' as const,
                  params: { motorcycleId },
                });
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                height: 46,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: theme.line2,
                backgroundColor: 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Receipt size={16} color={theme.ink3} />
              <Text style={[type.label, { color: theme.ink2 }]}>
                {t('rideSummary.addExpense')}{' '}
                <Text style={{ color: theme.ink3 }}>{t('rideSummary.addExpenseHint')}</Text>
              </Text>
            </Pressable>
          </Animated.View>

          {/* Save ride CTA — emerald gradient, pill shape */}
          <Animated.View entering={FadeInUp.delay(650).duration(250)}>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={t(
                isSaving ? 'rideSummary.savingRideA11y' : 'rideSummary.saveRide',
              )}
              style={({ pressed }) => ({
                borderRadius: 999,
                borderCurve: 'continuous',
                overflow: 'hidden',
                opacity: isSaving ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  backgroundColor: theme.warm,
                  height: 54,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                {/* Check circle */}
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    backgroundColor: theme.onWarm,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={11} color={theme.warm} strokeWidth={2.5} />
                </View>
                <Text style={[type.bodyStrong, { color: theme.onWarm }]}>
                  {t(isSaving ? 'common.saving' : 'rideSummary.saveRide')}
                </Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* Share on Discover row */}
          <Animated.View
            entering={FadeInUp.delay(700).duration(250)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 4,
              paddingTop: 4,
            }}
          >
            {/* Compass icon box */}
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Compass size={16} color={theme.ink3} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[type.bodyStrong, { color: theme.ink }]}>
                {t('rideSummary.shareOnDiscover')}
              </Text>
              <Text style={[type.caption, { color: theme.ink3, marginTop: 1 }]}>
                {t('rideSummary.shareOnDiscoverHint')}
              </Text>
            </View>

            <NativeToggle value={shareToDiscover} onValueChange={setShareToDiscover} />
          </Animated.View>

          <Animated.View
            entering={FadeIn.delay(800).duration(250)}
            style={{ alignItems: 'center', paddingTop: 8 }}
          >
            <Pressable
              onPress={handleDiscard}
              accessibilityRole="button"
              accessibilityLabel={t('rideSummary.discardRide')}
              hitSlop={8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 8,
              }}
            >
              <Text style={[type.label, { color: theme.ink3 }]}>
                {t('rideSummary.discardRide')}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    </View>
  );
}
