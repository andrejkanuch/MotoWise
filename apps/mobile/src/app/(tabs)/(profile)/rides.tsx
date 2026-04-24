import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument, MyRidesDocument, type MyRidesQuery } from '@motovault/graphql';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, TrendingUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LottieMotorcycle } from '../../../components/LottieMotorcycle';
import { RideCard } from '../../../components/ride/ride-card';
import { useMeasurementSystem } from '../../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { presentPaywall } from '../../../lib/subscription';
import { useSubscriptionStore } from '../../../stores/subscription.store';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';
import {
  distanceUnitLabel,
  formatDuration as fmtDuration,
  formatDistanceValue,
} from '../../../utils/ride-formatters';

const FREE_TIER_LIMIT = 10;
const PAGE_SIZE = 20;

/** Extract the edge type from the generated MyRidesQuery */
type RideEdge = MyRidesQuery['myRides']['edges'][number];

/** Compute weekly/monthly/total stats from ride edges */
function useRideStats(edges: RideEdge[]) {
  return useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let weekDistance = 0;
    let weekRides = 0;
    let weekDuration = 0;
    let monthDistance = 0;
    let monthRides = 0;
    let totalDistance = 0;

    for (const edge of edges) {
      const d = new Date(edge.node.startedAt);
      const dist = edge.node.distanceM ?? 0;
      const dur = edge.node.durationS ?? 0;
      totalDistance += dist;

      if (d >= weekStart) {
        weekDistance += dist;
        weekRides++;
        weekDuration += dur;
      }
      if (d >= monthStart) {
        monthDistance += dist;
        monthRides++;
      }
    }

    return {
      weekDistance,
      weekRides,
      weekDuration,
      monthDistance,
      monthRides,
      totalDistance,
      totalRides: edges.length,
    };
  }, [edges]);
}

export default function RidesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useEditorialTheme();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const { t } = useTranslation();

  useEffect(() => {
    trackEvent(AnalyticsEvent.RIDES_HISTORY_VIEWED);
  }, []);

  const system = useMeasurementSystem();

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
  const visibleEdges = isPro ? allEdges : allEdges.slice(0, FREE_TIER_LIMIT);
  const showUpgradeCta = !isPro && allEdges.length > FREE_TIER_LIMIT;
  const stats = useRideStats(allEdges);

  const handleRidePress = useCallback(
    (rideId: string) => {
      // biome-ignore lint/suspicious/noExplicitAny: expo-router does not export typed route params for dynamic modals
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

  const renderHeader = useCallback(
    () => (
      <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16, marginBottom: 16 }}>
        {/* Stats hero card */}
        <View
          style={{
            backgroundColor: isDark ? palette.cardDark : palette.white,
            borderRadius: 20,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
            overflow: 'hidden',
          }}
        >
          <View style={{ padding: 20, gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} color={palette.accent500} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: isDark ? palette.neutral400 : palette.neutral500,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                This Week
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 20 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: '200',
                    color: isDark ? palette.white : palette.neutral950,
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -1,
                  }}
                >
                  {formatDistanceValue(stats.weekDistance, system)}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isDark ? palette.neutral500 : palette.neutral600,
                  }}
                >
                  {distanceUnitLabel(system)}
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: '200',
                    color: isDark ? palette.white : palette.neutral950,
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -1,
                  }}
                >
                  {stats.weekRides}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isDark ? palette.neutral500 : palette.neutral600,
                  }}
                >
                  ride{stats.weekRides !== 1 ? 's' : ''}
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: '200',
                    color: isDark ? palette.white : palette.neutral950,
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -1,
                  }}
                >
                  {fmtDuration(stats.weekDuration)}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isDark ? palette.neutral500 : palette.neutral600,
                  }}
                >
                  riding
                </Text>
              </View>
            </View>
          </View>

          {/* Monthly + Total strip */}
          <View
            style={{
              flexDirection: 'row',
              borderTopWidth: 1,
              borderTopColor: isDark ? palette.surfaceElevated : palette.neutral200,
            }}
          >
            <View
              style={{
                flex: 1,
                padding: 14,
                alignItems: 'center',
                borderRightWidth: 1,
                borderRightColor: isDark ? palette.surfaceElevated : palette.neutral200,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: isDark ? palette.neutral500 : palette.neutral600,
                  letterSpacing: 0.5,
                }}
              >
                THIS MONTH
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: isDark ? palette.white : palette.neutral950,
                  fontVariant: ['tabular-nums'],
                  marginTop: 4,
                }}
              >
                {formatDistanceValue(stats.monthDistance, system)} {distanceUnitLabel(system)}
              </Text>
            </View>
            <View style={{ flex: 1, padding: 14, alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: isDark ? palette.neutral500 : palette.neutral600,
                  letterSpacing: 0.5,
                }}
              >
                ALL TIME
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: isDark ? palette.white : palette.neutral950,
                  fontVariant: ['tabular-nums'],
                  marginTop: 4,
                }}
              >
                {formatDistanceValue(stats.totalDistance, system)} {distanceUnitLabel(system)}
              </Text>
            </View>
          </View>
        </View>

        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: isDark ? palette.neutral400 : palette.neutral500,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Activity
        </Text>
      </Animated.View>
    ),
    [stats, system, isDark],
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
            color: isDark ? palette.white : palette.neutral950,
            textAlign: 'center',
          }}
        >
          {t('profile.ridesEmptyTitle')}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: isDark ? palette.neutral400 : palette.neutral500,
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
            backgroundColor: palette.primary700,
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
  }, [isLoading, isDark, hasBikes, router, t]);

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View style={{ paddingVertical: 20 }}>
          <ActivityIndicator size="small" color={palette.accent500} />
        </View>
      );
    }
    if (showUpgradeCta) {
      return (
        <Animated.View
          entering={FadeInUp.duration(280)}
          style={{
            marginTop: 12,
            backgroundColor: isDark ? palette.cardDark : palette.white,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
          }}
        >
          <TrendingUp size={24} color={palette.signature500} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: isDark ? palette.white : palette.neutral950,
            }}
          >
            Unlock Full History
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: isDark ? palette.neutral400 : palette.neutral500,
              textAlign: 'center',
            }}
          >
            Free accounts show the last {FREE_TIER_LIMIT} rides. Upgrade for unlimited history and
            stats.
          </Text>
          <Pressable
            onPress={() => presentPaywall()}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Pro"
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
                Upgrade to Pro
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      );
    }
    return null;
  }, [isFetchingNextPage, showUpgradeCta, isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.surfaceDark : palette.neutral50 }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={isDark ? palette.white : palette.neutral950} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontSize: 28,
            fontWeight: '800',
            color: isDark ? palette.white : palette.neutral950,
            letterSpacing: -0.5,
          }}
        >
          My Rides
        </Text>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
            borderCurve: 'continuous',
            backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: palette.accent500,
              fontVariant: ['tabular-nums'],
            }}
          >
            {stats.totalRides} ride{stats.totalRides !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.accent500} />
        </View>
      ) : (
        <FlatList
          data={visibleEdges}
          renderItem={renderItem}
          keyExtractor={(item) => item.node.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 20,
            gap: 12,
          }}
          ListHeaderComponent={allEdges.length > 0 ? renderHeader : undefined}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={isDark ? palette.white : palette.neutral400}
            />
          }
          showsVerticalScrollIndicator={false}
          windowSize={7}
          maxToRenderPerBatch={5}
        />
      )}
    </View>
  );
}
