import { palette } from '@motovault/design-system';
import {
  MyMotorcyclesDocument,
  MyRidesDocument,
  type MyRidesQuery,
  RideOverviewDocument,
  type RideOverviewQuery,
} from '@motovault/graphql';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Route } from 'lucide-react-native';
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
import { useMeasurementSystem } from '../../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDuration as fmtDuration,
  formatDistanceValue,
  formatElevationValue,
  speedUnitLabel,
} from '../../../utils/ride-formatters';

const PAGE_SIZE = 20;

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

  // Server-side analytics overview (last ride, 7-day summary, streak, records)
  const { data: overviewData } = useQuery<RideOverviewQuery>({
    queryKey: queryKeys.rides.overview,
    queryFn: () => gqlFetcher(RideOverviewDocument),
  });
  const overview = overviewData?.rideOverview;

  // Fire once when the overview block (streak / records / summary) is actually
  // populated — lets us measure how often the rich header is seen vs the raw list.
  const overviewViewedRef = useRef(false);
  useEffect(() => {
    if (overview && !overviewViewedRef.current) {
      overviewViewedRef.current = true;
      trackEvent(AnalyticsEvent.OVERVIEW_VIEWED, {
        has_streak: (overview.currentStreak ?? 0) > 0,
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

  const renderHeader = useCallback(
    () => (
      <Animated.View entering={FadeIn.duration(300)} style={{ gap: 12, marginBottom: 16 }}>
        {/* Hero summary card */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 22,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.line,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Copper radial gradient accent (decorative) */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '60%',
              backgroundColor: tint(theme.warm, 0.1),
              borderTopRightRadius: 22,
              borderBottomRightRadius: 22,
              opacity: 0.6,
            }}
            pointerEvents="none"
          />

          <View style={{ padding: 16, paddingHorizontal: 18, paddingBottom: 14 }}>
            {/* Meta row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Text
                style={{
                  fontFamily: 'GeistMono',
                  fontSize: 9.5,
                  fontWeight: '500',
                  letterSpacing: 0.2 * 9.5,
                  textTransform: 'uppercase',
                  color: theme.ink3,
                }}
              >
                {periodMetaLabel}
              </Text>
              {trendLabel && (
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 9.5,
                    fontWeight: '500',
                    letterSpacing: 0.08 * 9.5,
                    color: theme.warm,
                  }}
                >
                  {trendLabel}
                </Text>
              )}
            </View>

            {/* Large distance number */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 6,
                marginTop: 6,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Text
                style={{
                  fontSize: 60,
                  fontWeight: '700',
                  color: theme.ink,
                  fontVariant: ['tabular-nums'],
                  letterSpacing: -0.04 * 60,
                  lineHeight: 64,
                }}
              >
                {formatDistanceValue(stats.periodDistance, system)}
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '500',
                  color: theme.ink3,
                  letterSpacing: -0.01 * 18,
                  marginLeft: 2,
                }}
              >
                {distanceUnitLabel(system)}
              </Text>
            </View>

            {/* Sparkline */}
            <View style={{ marginTop: 8, marginHorizontal: -2, position: 'relative', zIndex: 1 }}>
              <Sparkline data={stats.dailyDistances} color={theme.warm} height={48} />
            </View>

            {/* Sub row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 6,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {heroSubText.map((part, i) => (
                <React.Fragment key={part}>
                  {i > 0 && (
                    <View
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: 99,
                        backgroundColor: theme.ink4,
                      }}
                    />
                  )}
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '500',
                      color: theme.ink2,
                      letterSpacing: -0.005 * 12.5,
                    }}
                  >
                    {part}
                  </Text>
                </React.Fragment>
              ))}
              {heroSubText.length > 0 && (
                <>
                  <View style={{ flex: 1 }} />
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '600',
                      color: theme.warm,
                    }}
                  >
                    {t('myRides.seeAllRides')}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Stats trio */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
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
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 12,
                paddingHorizontal: 14,
                paddingBottom: 14,
                minHeight: 88,
              }}
            >
              <Text
                style={{
                  fontFamily: 'GeistMono',
                  fontSize: 9.5,
                  fontWeight: '500',
                  letterSpacing: 0.2 * 9.5,
                  textTransform: 'uppercase',
                  color: theme.ink3,
                }}
              >
                {s.label}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: 3,
                  marginTop: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: '700',
                    color: s.value === '--' ? theme.ink3 : theme.ink,
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -0.03 * 26,
                    lineHeight: 26,
                  }}
                >
                  {s.value}
                </Text>
                {s.unit && (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: theme.ink3,
                      letterSpacing: -0.01 * 12,
                      marginLeft: 1,
                    }}
                  >
                    {s.unit}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }} />
              {s.sub ? (
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 9.5,
                    fontWeight: '500',
                    letterSpacing: 0.08 * 9.5,
                    color: theme.ink3,
                    paddingTop: 6,
                  }}
                >
                  {s.sub}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Streak + records row */}
        {overview && overview.currentStreak > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.line,
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 12,
            }}
          >
            <Text style={{ fontSize: 20 }}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: theme.ink,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {overview.currentStreak}{' '}
                {overview.currentStreak === 1 ? t('myRides.streakWeek') : t('myRides.streakWeeks')}
              </Text>
              <Text style={{ fontSize: 11, color: theme.ink3, marginTop: 2 }}>
                {t('myRides.streakDesc')}
              </Text>
            </View>
          </View>
        )}

        {/* Section header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
            marginHorizontal: 2,
          }}
        >
          <Text
            style={{
              fontFamily: 'GeistMono',
              fontSize: 10.5,
              fontWeight: '600',
              letterSpacing: 0.22 * 10.5,
              textTransform: 'uppercase',
              color: theme.ink3,
            }}
          >
            {t('myRides.recentRides')}
          </Text>
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') triggerImpact();
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
            hitSlop={8}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: theme.warm,
                letterSpacing: -0.01 * 12.5,
              }}
            >
              {sortNewest ? `${t('myRides.newestFirst')} ↓` : `${t('myRides.oldestFirst')} ↑`}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    ),
    [stats, system, theme, periodMetaLabel, trendLabel, heroSubText, t, sortNewest, overview],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <Animated.View entering={FadeIn.duration(300)} style={{ paddingTop: 24 }}>
        <View
          style={{
            borderRadius: 22,
            borderCurve: 'continuous',
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.line2,
            padding: 32,
            paddingHorizontal: 24,
            alignItems: 'center',
          }}
        >
          {/* Icon box */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: theme.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Route size={24} color={theme.ink3} />
          </View>

          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              letterSpacing: -0.018 * 17,
              color: theme.ink,
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            {t('profile.ridesEmptyTitle')}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: theme.ink2,
              textAlign: 'center',
              lineHeight: 18,
              maxWidth: 240,
            }}
          >
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
            style={({ pressed }) => ({
              backgroundColor: theme.warm,
              borderRadius: 20,
              borderCurve: 'continuous',
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'stretch',
              marginTop: 16,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Text style={{ color: palette.white, fontSize: 15, fontWeight: '700' }}>
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
        <View style={{ paddingVertical: 20 }}>
          <ActivityIndicator size="small" color={theme.warm} />
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage, theme]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 8,
        }}
      >
        {/* Top row: back + title + total pill */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginBottom: 12,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={16} color={theme.ink2} />
          </Pressable>
          <Text
            style={{
              flex: 1,
              fontSize: 24,
              fontWeight: '700',
              color: theme.ink,
              letterSpacing: -0.022 * 24,
            }}
          >
            {t('myRides.title')}
          </Text>
          <View
            style={{
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.warm, 0.12),
              borderWidth: 1,
              borderColor: tint(theme.warm, 0.28),
              flexShrink: 0,
            }}
          >
            <Text
              style={{
                fontFamily: 'GeistMono',
                fontSize: 10.5,
                fontWeight: '500',
                letterSpacing: 0.08 * 10.5,
                color: theme.warm,
                fontVariant: ['tabular-nums'],
              }}
            >
              {stats.totalRides} {t('myRides.rides')}
            </Text>
          </View>
        </View>

        {/* Period switcher */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PERIOD_KEYS.map((key) => {
            const active = period === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  if (process.env.EXPO_OS === 'ios') triggerImpact();
                  setPeriod(key);
                  trackEvent(AnalyticsEvent.RIDES_HISTORY_FILTERED, {
                    filter_type: 'period',
                    value: key,
                    total_rides: stats.totalRides,
                  });
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? theme.warm : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? theme.warm : theme.line,
                  ...(active
                    ? {
                        shadowColor: 'rgba(200,119,44,1)',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.4,
                        shadowRadius: 12,
                        elevation: 6,
                      }
                    : {}),
                }}
              >
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: '600',
                    letterSpacing: -0.005 * 13.5,
                    color: active ? palette.white : theme.ink2,
                  }}
                >
                  {periodLabelsMap[key]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.warm} />
        </View>
      ) : (
        <FlatList
          data={sortedEdges}
          renderItem={renderItem}
          keyExtractor={(item) => item.node.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 100,
            gap: 12,
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
