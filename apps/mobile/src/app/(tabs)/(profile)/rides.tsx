import SegmentedControl from '@expo/ui/community/segmented-control';
import {
  MyMotorcyclesDocument,
  MyRidesDocument,
  type MyRidesQuery,
  RideOverviewDocument,
  type RideOverviewQuery,
} from '@motovault/graphql';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { Flame, Route } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { RideCard } from '../../../components/ride/ride-card';
import { ESettingsGroup, ESettingsRow } from '../../../components/ui/editorial';
import { PROFILE_ROUTE } from '../../../config/routes';
import { useMeasurementSystem } from '../../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { GUTTER, radius, readableWidth, SYSTEM_WEIGHT, space, type } from '../../../theme/type';
import { triggerImpact, triggerSelection } from '../../../utils/haptics';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDuration as fmtDuration,
  formatDistanceValue,
  formatElevationValue,
  speedUnitLabel,
} from '../../../utils/ride-formatters';

const PAGE_SIZE = 20;

/** The period distance is the screen's one big figure: the figure face, scaled up. */
const HERO_FIGURE = { fontSize: 56, lineHeight: 58 } as const;

type Period = 'week' | 'month' | 'year' | 'all';
const PERIOD_KEYS: Period[] = ['week', 'month', 'year', 'all'];

type RideEdge = MyRidesQuery['myRides']['edges'][number];

function useRideStats(edges: RideEdge[], period: Period) {
  return useMemo(() => {
    const now = new Date();
    let periodStart: Date;

    switch (period) {
      case 'week': {
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - now.getDay());
        periodStart.setHours(0, 0, 0, 0);
        break;
      }
      case 'month': {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      }
      case 'year': {
        periodStart = new Date(now.getFullYear(), 0, 1);
        break;
      }
      default:
        periodStart = new Date(0);
    }

    let periodDistance = 0;
    let periodRides = 0;
    let periodDuration = 0;
    let periodMaxSpeed = 0;
    let periodElevation = 0;
    let totalDistance = 0;

    // Previous period stats for trend calculation
    const periodDurationMs = now.getTime() - periodStart.getTime();
    const prevPeriodStart = new Date(periodStart.getTime() - periodDurationMs);
    let prevPeriodDistance = 0;

    // Daily distances for sparkline (last 30 days)
    const dailyDistances: number[] = new Array(30).fill(0);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    for (const edge of edges) {
      const d = new Date(edge.node.startedAt);
      const dist = edge.node.distanceM ?? 0;
      const dur = edge.node.durationS ?? 0;
      const maxSpd = edge.node.maxSpeedMps ?? 0;
      const elev = edge.node.elevationGain ?? 0;
      totalDistance += dist;

      if (d >= periodStart) {
        periodDistance += dist;
        periodRides++;
        periodDuration += dur;
        periodElevation += elev;
        if (maxSpd > periodMaxSpeed) periodMaxSpeed = maxSpd;
      }

      // Previous period
      if (d >= prevPeriodStart && d < periodStart) {
        prevPeriodDistance += dist;
      }

      // Sparkline data
      if (d >= thirtyDaysAgo) {
        const dayIndex = Math.floor(
          (d.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (dayIndex >= 0 && dayIndex < 30) {
          dailyDistances[dayIndex] += dist / 1000; // km
        }
      }
    }

    // Trend percentage
    let trendPercent = 0;
    if (prevPeriodDistance > 0) {
      trendPercent = Math.round(((periodDistance - prevPeriodDistance) / prevPeriodDistance) * 100);
    }

    return {
      periodDistance,
      periodRides,
      periodDuration,
      periodMaxSpeed,
      periodElevation,
      totalDistance,
      totalRides: edges.length,
      dailyDistances,
      trendPercent,
    };
  }, [edges, period]);
}

/** Mini sparkline area chart */
const Sparkline = React.memo(function Sparkline({
  data,
  color,
  height = 48,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const paths = useMemo(() => {
    if (!data || data.length < 2) return null;

    const max = Math.max(...data, 1);
    const w = 320;
    const h = height;
    const padding = 4;

    const points = data.map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (w - padding * 2);
      const y = h - padding - (v / max) * (h - padding * 2);
      return `${x},${y}`;
    });

    const linePath = `M${points.join(' L')}`;
    const areaPath = `${linePath} L${w - padding},${h} L${padding},${h} Z`;

    return { linePath, areaPath, w, h };
  }, [data, height]);

  if (!paths) return null;

  return (
    <Svg
      width="100%"
      height={paths.h}
      viewBox={`0 0 ${paths.w} ${paths.h}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <SvgGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.34" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d={paths.areaPath} fill="url(#sparkGrad)" />
      <Path
        d={paths.linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

export default function RidesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const system = useMeasurementSystem();

  const [period, setPeriod] = useState<Period>('month');
  const [sortNewest, setSortNewest] = useState(true);

  const periodLabelsMap: Record<Period, string> = useMemo(
    () => ({
      week: t('myRides.week'),
      month: t('myRides.month'),
      year: t('myRides.year'),
      all: t('myRides.all'),
    }),
    [t],
  );

  useEffect(() => {
    trackEvent(AnalyticsEvent.RIDES_HISTORY_VIEWED);
  }, []);

  // Server-side analytics overview (last ride, 7-day summary, records)
  const { data: overviewData } = useQuery<RideOverviewQuery>({
    queryKey: queryKeys.rides.overview,
    queryFn: () => gqlFetcher(RideOverviewDocument),
  });
  const overview = overviewData?.rideOverview;

  // Fire once when the overview block (records / summary) is actually
  // populated — lets us measure how often the rich header is seen vs the raw list.
  const overviewViewedRef = useRef(false);
  useEffect(() => {
    if (overview && !overviewViewedRef.current) {
      overviewViewedRef.current = true;
      trackEvent(AnalyticsEvent.OVERVIEW_VIEWED, {
        record_count: overview.personalRecords?.length ?? 0,
      });
    }
  }, [overview]);

  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const hasBikes = useMemo(
    () => (motorcyclesData?.myMotorcycles?.length ?? 0) > 0,
    [motorcyclesData],
  );

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isRefetching } =
    useInfiniteQuery<MyRidesQuery>({
      queryKey: queryKeys.rides.all,
      queryFn: ({ pageParam }) =>
        gqlFetcher(MyRidesDocument, {
          first: PAGE_SIZE,
          after: (pageParam as string) ?? null,
        }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => {
        const pageInfo = lastPage?.myRides?.pageInfo;
        if (!pageInfo?.hasNextPage) return undefined;
        return pageInfo.endCursor ?? undefined;
      },
    });

  const allEdges = useMemo<RideEdge[]>(
    () => (data?.pages ?? []).flatMap((page) => page?.myRides?.edges ?? []),
    [data?.pages],
  );
  const sortedEdges = useMemo(
    () => (sortNewest ? allEdges : [...allEdges].reverse()),
    [allEdges, sortNewest],
  );
  const stats = useRideStats(allEdges, period);

  // Map rideId → record types for badge display
  const recordsByRideId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rec of overview?.personalRecords ?? []) {
      if (!rec.rideId) continue;
      const existing = map.get(rec.rideId) ?? [];
      existing.push(rec.recordType);
      map.set(rec.rideId, existing);
    }
    return map;
  }, [overview?.personalRecords]);

  const handleRidePress = useCallback(
    (rideId: string, listIndex: number, hasRecord: boolean) => {
      // Tapping a card that carries a personal-record badge counts as engaging the badge.
      if (hasRecord) {
        trackEvent(AnalyticsEvent.RECORD_BADGE_TAPPED, { ride_id: rideId });
      }
      // `source` attributes the ride_viewed back to this tab so we can build a
      // My-Rides → ride-detail tap-through funnel.
      router.push({
        pathname: '/(modals)/ride-detail',
        params: { rideId, source: 'my_rides_tab', listIndex: String(listIndex) },
      } as Href);
    },
    [router],
  );

  // --- My Rides engagement: scroll depth + record-badge visibility (per visit) ---
  // recordsByRideId can update after the overview query resolves, so read it from a
  // ref inside the (stable) viewability callback rather than closing over a stale value.
  const recordsByRideIdRef = useRef(recordsByRideId);
  recordsByRideIdRef.current = recordsByRideId;

  const maxIndexRef = useRef(0);
  const viewedRecordRidesRef = useRef<Set<string>>(new Set());
  const scrollMetaRef = useRef({ total: 0, pages: 0, hasNext: true });
  scrollMetaRef.current = {
    total: stats.totalRides,
    pages: data?.pages?.length ?? 0,
    hasNext: !!hasNextPage,
  };

  const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    for (const vi of viewableItems) {
      if (typeof vi.index === 'number' && vi.index > maxIndexRef.current) {
        maxIndexRef.current = vi.index;
      }
      const id = (vi.item as RideEdge | undefined)?.node?.id;
      if (
        id &&
        (recordsByRideIdRef.current.get(id)?.length ?? 0) > 0 &&
        !viewedRecordRidesRef.current.has(id)
      ) {
        viewedRecordRidesRef.current.add(id);
        trackEvent(AnalyticsEvent.RECORD_BADGE_VIEWED, { ride_id: id });
      }
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Emit how far the rider scrolled when they leave the tab (one event per visit).
  useFocusEffect(
    useCallback(() => {
      maxIndexRef.current = 0;
      return () => {
        if (maxIndexRef.current > 0) {
          trackEvent(AnalyticsEvent.RIDES_TAB_SCROLL_DEPTH, {
            max_index_reached: maxIndexRef.current,
            total_rides: scrollMetaRef.current.total,
            pages_loaded: scrollMetaRef.current.pages,
            reached_end: !scrollMetaRef.current.hasNext,
          });
        }
      };
    }, []),
  );

  // P10 — pull-to-refresh re-engagement on the rides overview.
  const handleRefresh = useCallback(() => {
    trackEvent(AnalyticsEvent.RIDES_OVERVIEW_REFRESHED, { total_rides: stats.totalRides });
    refetch();
  }, [refetch, stats.totalRides]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: RideEdge; index: number }) => {
      const { node } = item;
      return (
        <RideCard
          ride={{
            id: node.id,
            userId: '',
            status: node.status,
            name: node.name ?? null,
            startedAt: node.startedAt,
            endedAt: node.endedAt ?? null,
            durationS: node.durationS ?? null,
            distanceM: node.distanceM ?? null,
            maxSpeedMps: node.maxSpeedMps ?? null,
            avgSpeedMps: node.avgSpeedMps ?? null,
            elevationGain: node.elevationGain ?? null,
            elevationLoss: null,
            pausedDurationS: node.pausedDurationS,
            autoPausedDurationS: node.autoPausedDurationS,
            routePolyline: node.routePolyline ?? null,
            gpsQuality: node.gpsQuality ?? null,
            mileageApplied: false,
            isPublic: false,
            motorcycleId: node.motorcycleId ?? null,
            createdAt: node.startedAt,
            updatedAt: node.startedAt,
            routeThumbnailUri: node.routeThumbnailUri ?? null,
          }}
          index={index}
          onPress={() =>
            handleRidePress(node.id, index, (recordsByRideId.get(node.id)?.length ?? 0) > 0)
          }
          recordTypes={recordsByRideId.get(node.id)}
        />
      );
    },
    [handleRidePress, recordsByRideId],
  );

  const _periodLabel = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'week':
        return t('myRides.thisWeek');
      case 'month':
        return now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      case 'year':
        return String(now.getFullYear());
      default:
        return t('myRides.allTime');
    }
  }, [period, t]);

  const periodMetaLabel = useMemo(() => {
    switch (period) {
      case 'week':
        return t('myRides.thisWeek');
      case 'month':
        return t('myRides.thisMonth');
      case 'year':
        return t('myRides.thisYear');
      default:
        return t('myRides.allTime');
    }
  }, [period, t]);

  const trendLabel = useMemo(() => {
    if (stats.trendPercent === 0 || period === 'all') return null;
    const sign = stats.trendPercent > 0 ? '+' : '';
    const vs =
      period === 'week'
        ? t('myRides.vsLastWeek')
        : period === 'month'
          ? t('myRides.vsLastMonth')
          : t('myRides.vsLastYear');
    return `${sign} ${stats.trendPercent}% ${vs}`;
  }, [stats.trendPercent, period, t]);

  const heroSubText = useMemo(() => {
    const parts: string[] = [];
    if (stats.periodRides > 0) {
      parts.push(t('myRides.ride', { count: stats.periodRides }));
    }
    if (stats.periodDuration > 0) {
      parts.push(fmtDuration(stats.periodDuration));
    }
    if (stats.periodElevation > 0) {
      parts.push(
        `${formatElevationValue(stats.periodElevation, system)}${elevationUnitLabel(system)} ${t('myRides.elev')}`,
      );
    }
    return parts;
  }, [stats, system, t]);

  const handleSeeAll = useCallback(() => {
    triggerImpact();
    setPeriod('all');
    trackEvent(AnalyticsEvent.RIDES_HISTORY_FILTERED, {
      filter_type: 'period',
      value: 'all',
      total_rides: stats.totalRides,
    });
  }, [stats.totalRides]);

  const handlePeriodChange = useCallback(
    (key: Period) => {
      triggerSelection();
      setPeriod(key);
      trackEvent(AnalyticsEvent.RIDES_HISTORY_FILTERED, {
        filter_type: 'period',
        value: key,
        total_rides: stats.totalRides,
      });
    },
    [stats.totalRides],
  );

  const renderHeader = useCallback(
    () => (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{ gap: space.sm, marginBottom: space.md }}
      >
        {/* Period switcher */}
        <SegmentedControl
          values={PERIOD_KEYS.map((key) => periodLabelsMap[key])}
          selectedIndex={PERIOD_KEYS.indexOf(period)}
          onChange={(e) => {
            const next = PERIOD_KEYS[e.nativeEvent.selectedSegmentIndex];
            if (next) handlePeriodChange(next);
          }}
        />

        {/* Period summary */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            padding: space.md,
            gap: space.xs,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space.xs,
            }}
          >
            <Text style={[type.label, { color: theme.ink3 }]}>{periodMetaLabel}</Text>
            {trendLabel ? (
              <Text style={[type.label, { color: theme.ink2, fontVariant: ['tabular-nums'] }]}>
                {trendLabel}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xxs }}>
            <Text style={[type.figure, HERO_FIGURE, { color: theme.ink }]}>
              {formatDistanceValue(stats.periodDistance, system)}
            </Text>
            <Text style={[type.figureSmall, { color: theme.ink3 }]}>
              {distanceUnitLabel(system)}
            </Text>
          </View>

          <View style={{ marginHorizontal: -2 }}>
            <Sparkline data={stats.dailyDistances} color={theme.ink2} height={48} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              columnGap: space.xs,
            }}
          >
            {heroSubText.map((part, i) => (
              <React.Fragment key={part}>
                {i > 0 && (
                  <View
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: radius.pill,
                      backgroundColor: theme.ink4,
                    }}
                  />
                )}
                <Text style={[type.caption, { color: theme.ink2 }]}>{part}</Text>
              </React.Fragment>
            ))}
            <View style={{ flex: 1 }} />
            {/* "See all" widens the summary to every ride (the All period). */}
            {period !== 'all' ? (
              <Pressable
                onPress={handleSeeAll}
                accessibilityRole="button"
                accessibilityLabel={t('myRides.allTime')}
                testID="rides-see-all"
                hitSlop={{ top: 4, bottom: 4 }}
                android_ripple={{ color: tint(theme.ink, 0.08), borderless: true }}
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: 'center',
                  paddingHorizontal: space.xxs,
                  opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.6 : 1,
                })}
              >
                <Text style={[type.label, SYSTEM_WEIGHT.semibold, { color: theme.warm2 }]}>
                  {t('myRides.seeAllRides')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Stats trio */}
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {[
            {
              label: t('myRides.rides'),
              value: String(stats.periodRides),
              unit: undefined,
              sub: t('myRides.ofTotal', { count: stats.totalRides }),
            },
            {
              label: t('myRides.topSpeed'),
              value:
                stats.periodMaxSpeed > 0
                  ? `${Math.round(stats.periodMaxSpeed * (system === 'imperial' ? 2.237 : 3.6))}`
                  : '--',
              unit: stats.periodMaxSpeed > 0 ? speedUnitLabel(system) : undefined,
              sub: stats.periodMaxSpeed > 0 ? t('myRides.personalBest') : '',
            },
            {
              label: t('myRides.elevation'),
              value:
                stats.periodElevation > 0
                  ? `${formatElevationValue(stats.periodElevation, system)}`
                  : '--',
              unit: stats.periodElevation > 0 ? elevationUnitLabel(system) : undefined,
              sub: stats.periodElevation > 0 ? t('myRides.totalGain') : '',
            },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                padding: space.sm,
                minHeight: 88,
              }}
            >
              <Text numberOfLines={1} style={[type.caption, { color: theme.ink3 }]}>
                {s.label}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: 3,
                  marginTop: space.xs,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[type.figure, { color: s.value === '--' ? theme.ink3 : theme.ink }]}
                >
                  {s.value}
                </Text>
                {s.unit ? (
                  <Text style={[type.caption, { color: theme.ink3 }]}>{s.unit}</Text>
                ) : null}
              </View>
              <View style={{ flex: 1 }} />
              {s.sub ? (
                <Text
                  numberOfLines={1}
                  style={[type.caption, { color: theme.ink3, paddingTop: space.xxs }]}
                >
                  {s.sub}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Lifetime heatmap + year recap */}
        <ESettingsGroup>
          <ESettingsRow
            icon={Flame}
            title={t('profile.roadsTitle')}
            subtitle={t('profile.roadsSubtitle')}
            testID="rides-heatmap-row"
            onPress={() => router.push(PROFILE_ROUTE.HEATMAP)}
          />
        </ESettingsGroup>

        {/* Section header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: space.xs,
          }}
        >
          <Text accessibilityRole="header" style={[type.sectionTitle, { color: theme.ink }]}>
            {t('myRides.recentRides')}
          </Text>
          <Pressable
            onPress={() => {
              triggerSelection();
              // Track BEFORE the state update — firing inside the setState updater
              // double-counted under StrictMode (72 events / 2 users). `sortNewest`
              // here is the pre-toggle value, so this reports the order being switched to.
              trackEvent(AnalyticsEvent.RIDES_HISTORY_FILTERED, {
                filter_type: 'sort',
                value: sortNewest ? 'oldest_first' : 'newest_first',
                total_rides: stats.totalRides,
              });
              setSortNewest((prev) => !prev);
            }}
            accessibilityRole="button"
            android_ripple={{ color: tint(theme.ink, 0.08), borderless: true }}
            style={({ pressed }) => ({
              minHeight: 44,
              justifyContent: 'center',
              paddingLeft: space.xs,
              opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.6 : 1,
            })}
          >
            <Text style={[type.label, SYSTEM_WEIGHT.semibold, { color: theme.warm2 }]}>
              {sortNewest ? t('myRides.newestFirst') : t('myRides.oldestFirst')}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    ),
    [
      stats,
      system,
      theme,
      period,
      periodLabelsMap,
      periodMetaLabel,
      trendLabel,
      heroSubText,
      t,
      sortNewest,
      handleSeeAll,
      handlePeriodChange,
      router,
    ],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <Animated.View entering={FadeIn.duration(300)} style={{ paddingTop: 24 }}>
        <View
          style={{
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: theme.surface,
            paddingVertical: space.xxl,
            paddingHorizontal: space.xl,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              backgroundColor: theme.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: space.sm,
            }}
          >
            <Route size={24} color={theme.ink3} />
          </View>

          <Text
            style={[
              type.sectionTitle,
              { color: theme.ink, textAlign: 'center', marginBottom: space.xxs },
            ]}
          >
            {t('profile.ridesEmptyTitle')}
          </Text>
          <Text style={[type.subhead, { color: theme.ink2, textAlign: 'center', maxWidth: 260 }]}>
            {t('profile.ridesEmptySubtitle')}
          </Text>

          <Pressable
            onPress={() => {
              triggerImpact();
              if (hasBikes) {
                router.push('/(modals)/start-ride');
              } else {
                router.push('/(tabs)/(garage)/add-bike');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={
              hasBikes ? t('profile.ridesEmptyStartRide') : t('profile.ridesEmptyAddBike')
            }
            android_ripple={{ color: tint(theme.onWarm, 0.2) }}
            style={({ pressed }) => ({
              backgroundColor: theme.warm,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              overflow: 'hidden',
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'stretch',
              marginTop: space.md,
              opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.85 : 1,
            })}
          >
            <Text style={[type.bodyStrong, { color: theme.onWarm }]}>
              {hasBikes ? t('profile.ridesEmptyStartRide') : t('profile.ridesEmptyAddBike')}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }, [isLoading, theme, hasBikes, router, t]);

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View style={{ paddingVertical: space.lg }}>
          <ActivityIndicator size="small" color={theme.ink3} />
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage, theme]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.ink3} />
        </View>
      ) : (
        <FlatList
          data={sortedEdges}
          renderItem={renderItem}
          keyExtractor={(item) => item.node.id}
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: theme.bg }}
          contentContainerStyle={{
            ...readableWidth,
            paddingHorizontal: GUTTER,
            paddingTop: space.xs,
            paddingBottom: insets.bottom + 100,
            gap: space.sm,
          }}
          ListHeaderComponent={allEdges.length > 0 ? renderHeader : undefined}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={theme.ink3}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          windowSize={5}
          maxToRenderPerBatch={5}
        />
      )}
    </View>
  );
}
