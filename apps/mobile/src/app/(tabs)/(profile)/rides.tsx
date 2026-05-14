import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument, MyRidesDocument, type MyRidesQuery } from '@motovault/graphql';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { LottieMotorcycle } from '../../../components/LottieMotorcycle';
import { RideCard } from '../../../components/ride/ride-card';
import { useMeasurementSystem } from '../../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { presentPaywall } from '../../../lib/subscription';
import { useSubscriptionStore } from '../../../stores/subscription.store';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';
import {
  distanceUnitLabel,
  formatDuration as fmtDuration,
  formatDistanceValue,
  speedUnitLabel,
} from '../../../utils/ride-formatters';

const FREE_TIER_LIMIT = 10;
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
    let totalDistance = 0;

    // Daily distances for sparkline (last 30 days)
    const dailyDistances: number[] = new Array(30).fill(0);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    for (const edge of edges) {
      const d = new Date(edge.node.startedAt);
      const dist = edge.node.distanceM ?? 0;
      const dur = edge.node.durationS ?? 0;
      const maxSpd = edge.node.maxSpeedMps ?? 0;
      totalDistance += dist;

      if (d >= periodStart) {
        periodDistance += dist;
        periodRides++;
        periodDuration += dur;
        if (maxSpd > periodMaxSpeed) periodMaxSpeed = maxSpd;
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

    return {
      periodDistance,
      periodRides,
      periodDuration,
      periodMaxSpeed,
      totalDistance,
      totalRides: edges.length,
      dailyDistances,
    };
  }, [edges, period]);
}

/** Mini sparkline area chart */
function Sparkline({
  data,
  color,
  height = 48,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
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

  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <Defs>
        <SvgGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d={areaPath} fill="url(#sparkGrad)" />
      <Path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function RidesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t: theme } = useEditorialTheme();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const { t } = useTranslation();
  const system = useMeasurementSystem();

  const [period, setPeriod] = useState<Period>('month');
  const ctaShownRef = useRef(false);
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
  const visibleEdges = isPro ? sortedEdges : sortedEdges.slice(0, FREE_TIER_LIMIT);
  const showUpgradeCta = !isPro && allEdges.length > FREE_TIER_LIMIT;
  const stats = useRideStats(allEdges, period);

  const handleRidePress = useCallback(
    (rideId: string) => {
      // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
      router.push({ pathname: '/(modals)/ride-detail' as const, params: { rideId } } as any);
    },
    [router],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && isPro) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isPro]);

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
            routePolyline: null,
            gpsQuality: node.gpsQuality ?? null,
            mileageApplied: false,
            isPublic: false,
            motorcycleId: node.motorcycleId ?? null,
            createdAt: node.startedAt,
            updatedAt: node.startedAt,
            routeThumbnailUri: node.routeThumbnailUri ?? null,
          }}
          index={index}
          onPress={() => handleRidePress(node.id)}
        />
      );
    },
    [handleRidePress],
  );

  const periodLabel = useMemo(() => {
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

  const renderHeader = useCallback(
    () => (
      <Animated.View entering={FadeIn.duration(300)} style={{ gap: 12, marginBottom: 16 }}>
        {/* Hero stat card */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 18,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.line,
            overflow: 'hidden',
          }}
        >
          <View style={{ padding: 18, paddingBottom: 14 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: theme.ink3,
                textTransform: 'uppercase',
                letterSpacing: 1.6,
                marginBottom: 4,
              }}
            >
              {periodLabel}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 6,
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 44,
                  fontWeight: '300',
                  color: theme.ink,
                  fontVariant: ['tabular-nums'],
                  letterSpacing: -1.5,
                }}
              >
                {formatDistanceValue(stats.periodDistance, system)}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: theme.ink3,
                }}
              >
                {distanceUnitLabel(system)}
              </Text>
            </View>
            {/* Sparkline */}
            <View style={{ marginTop: 8 }}>
              <Sparkline data={stats.dailyDistances} color={theme.warm} height={48} />
            </View>
          </View>
        </View>

        {/* 3 stat tiles */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            {
              label: t('myRides.rides'),
              value: String(stats.periodRides),
              sub: t('myRides.ofTotal', { count: stats.totalRides }),
            },
            {
              label: t('myRides.moving'),
              value: fmtDuration(stats.periodDuration),
              sub: '',
            },
            {
              label: t('myRides.max'),
              value:
                stats.periodMaxSpeed > 0
                  ? `${Math.round(stats.periodMaxSpeed * (system === 'imperial' ? 2.237 : 3.6))}`
                  : 'NA',
              sub: stats.periodMaxSpeed > 0 ? speedUnitLabel(system) : '',
            },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: '700',
                  color: theme.ink3,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  marginBottom: 6,
                }}
              >
                {s.label}
              </Text>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: theme.ink,
                  fontVariant: ['tabular-nums'],
                  letterSpacing: -0.5,
                  lineHeight: 24,
                }}
              >
                {s.value}
              </Text>
              {s.sub ? (
                <Text
                  style={{
                    fontSize: 10,
                    color: theme.ink3,
                    fontVariant: ['tabular-nums'],
                    marginTop: 4,
                  }}
                >
                  {s.sub}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Section header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginTop: 4,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: theme.ink3,
              textTransform: 'uppercase',
              letterSpacing: 1.6,
            }}
          >
            {t('myRides.recentRides')}
          </Text>
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') triggerImpact();
              setSortNewest((prev) => {
                trackEvent(AnalyticsEvent.RIDES_HISTORY_FILTERED, {
                  filter_type: 'sort',
                  value: prev ? 'oldest_first' : 'newest_first',
                  total_rides: stats.totalRides,
                });
                return !prev;
              });
            }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: theme.warm,
              }}
            >
              {sortNewest ? t('myRides.newestFirst') : t('myRides.oldestFirst')}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    ),
    [stats, system, theme, periodLabel, t, sortNewest],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 16 }}
      >
        <LottieMotorcycle animation="emptyGarage" size={160} loop />
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: theme.ink,
            textAlign: 'center',
          }}
        >
          {t('profile.ridesEmptyTitle')}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: theme.ink3,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          {t('profile.ridesEmptySubtitle')}
        </Text>
        <Pressable
          onPress={() => {
            triggerImpact();
            if (hasBikes) {
              // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
              router.push('/(modals)/start-ride' as any);
            } else {
              // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
              router.push('/(tabs)/(garage)/add-bike' as any);
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
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            marginTop: 8,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text style={{ color: palette.white, fontSize: 16, fontWeight: '700' }}>
            {hasBikes ? t('profile.ridesEmptyStartRide') : t('profile.ridesEmptyAddBike')}
          </Text>
        </Pressable>
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
    if (showUpgradeCta) {
      if (!ctaShownRef.current) {
        ctaShownRef.current = true;
        trackEvent(AnalyticsEvent.RIDE_UPGRADE_CTA_SHOWN, {
          ride_count: allEdges.length,
          cta_location: 'rides_history',
        });
      }
      return (
        <Animated.View
          entering={FadeInUp.duration(280)}
          style={{
            marginTop: 12,
            backgroundColor: theme.surface,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 20,
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          <TrendingUp size={24} color={theme.warm} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.ink }}>
            {t('myRides.unlockTitle')}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.ink3,
              textAlign: 'center',
            }}
          >
            {t('myRides.unlockDesc', { limit: FREE_TIER_LIMIT })}
          </Text>
          <Pressable
            onPress={() => {
              trackEvent(AnalyticsEvent.RIDE_UPGRADE_CTA_TAPPED, {
                ride_count: allEdges.length,
                cta_location: 'rides_history',
              });
              presentPaywall({
                source: 'rides_history',
                feature: 'subscription',
                surface: 'rides_history_limit',
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={t('myRides.upgradePro')}
            style={{
              overflow: 'hidden',
              borderRadius: 14,
              borderCurve: 'continuous',
              marginTop: 4,
            }}
          >
            <LinearGradient
              colors={[palette.signature400, palette.signature500]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                {t('myRides.upgradePro')}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      );
    }
    return null;
  }, [isFetchingNextPage, showUpgradeCta, allEdges.length, theme, t]);

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
        {/* Top row: back + title + count */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
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
              fontSize: 22,
              fontWeight: '700',
              color: theme.ink,
              letterSpacing: -0.5,
            }}
          >
            {t('myRides.title')}
          </Text>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.warm, 0.1),
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: theme.warm,
                fontVariant: ['tabular-nums'],
              }}
            >
              {t('myRides.total', { count: stats.totalRides })}
            </Text>
          </View>
        </View>

        {/* Period switcher */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
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
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? theme.ink : theme.surface,
                  borderWidth: 1,
                  borderColor: active ? theme.ink : theme.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: active ? theme.bg : theme.ink2,
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
          data={visibleEdges}
          renderItem={renderItem}
          keyExtractor={(item) => item.node.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 100,
            gap: 8,
          }}
          ListHeaderComponent={allEdges.length > 0 ? renderHeader : undefined}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.ink3} />
          }
          showsVerticalScrollIndicator={false}
          windowSize={7}
          maxToRenderPerBatch={5}
        />
      )}
    </View>
  );
}
