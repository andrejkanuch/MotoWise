import { palette } from '@motovault/design-system';
import { MyRidesDocument } from '@motovault/graphql';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { MapPin, Search } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RideCard } from '../../../components/ride/ride-card';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useSubscriptionStore } from '../../../stores/subscription.store';

const FREE_TIER_LIMIT = 10;
const PAGE_SIZE = 20;

type RideEdge = {
  node: {
    id: string;
    status: string;
    name?: string | null;
    startedAt: string;
    endedAt?: string | null;
    distanceM?: number | null;
    maxSpeedMps?: number | null;
    avgSpeedMps?: number | null;
    elevationGain?: number | null;
    pausedDurationS?: number | null;
    autoPausedDurationS?: number | null;
    durationS?: number | null;
    motorcycleId?: string | null;
    routeThumbnailUri?: string | null;
    gpsQuality?: number | null;
  };
  cursor: string;
};

export default function RidesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const [searchVisible, setSearchVisible] = useState(false);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isRefetching } =
    useInfiniteQuery({
      queryKey: queryKeys.rides.all,
      queryFn: ({ pageParam }) =>
        gqlFetcher(MyRidesDocument, {
          first: PAGE_SIZE,
          after: pageParam ?? null,
        } as any),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage: any) => {
        const pageInfo = lastPage?.myRides?.pageInfo;
        return pageInfo?.hasNextPage ? pageInfo.endCursor : undefined;
      },
    });

  const allEdges: RideEdge[] = data?.pages.flatMap((page: any) => page?.myRides?.edges ?? []) ?? [];

  // Free tier: limit to last 10
  const visibleEdges = isPro ? allEdges : allEdges.slice(0, FREE_TIER_LIMIT);
  const showUpgradeCta = !isPro && allEdges.length > FREE_TIER_LIMIT;

  const handleRidePress = useCallback(
    (rideId: string) => {
      // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
      router.push({
        pathname: '/(modals)/ride-summary',
        params: { rideId },
      } as any);
    },
    [router],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && isPro) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isPro]);

  const renderItem = useCallback(
    ({ item, index }: { item: RideEdge; index: number }) => (
      <RideCard
        ride={{
          id: item.node.id,
          userId: '',
          status: item.node.status as any,
          name: item.node.name ?? null,
          startedAt: item.node.startedAt,
          endedAt: item.node.endedAt ?? null,
          durationS: item.node.durationS ?? null,
          distanceM: item.node.distanceM ?? null,
          maxSpeedMps: item.node.maxSpeedMps ?? null,
          avgSpeedMps: item.node.avgSpeedMps ?? null,
          elevationGain: item.node.elevationGain ?? null,
          elevationLoss: null,
          pausedDurationS: item.node.pausedDurationS ?? 0,
          autoPausedDurationS: item.node.autoPausedDurationS ?? 0,
          routePolyline: null,
          gpsQuality: item.node.gpsQuality ?? null,
          mileageApplied: false,
          isPublic: false,
          motorcycleId: item.node.motorcycleId ?? null,
          createdAt: item.node.startedAt,
          updatedAt: item.node.startedAt,
          routeThumbnailUri: item.node.routeThumbnailUri,
        }}
        index={index}
        onPress={() => handleRidePress(item.node.id)}
      />
    ),
    [handleRidePress],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <Animated.View
        entering={FadeInUp.duration(300)}
        style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 16 }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(45,158,120,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MapPin size={32} color={palette.accent500} />
        </View>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: palette.white,
            textAlign: 'center',
          }}
        >
          No rides yet
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: palette.neutral400,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          Start your first ride! Tap the record button on the home screen to begin tracking.
        </Text>
      </Animated.View>
    );
  }, [isLoading]);

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
            margin: 20,
            backgroundColor: palette.cardDark,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
            Upgrade for full history
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: palette.neutral400,
              textAlign: 'center',
            }}
          >
            Free accounts show the last {FREE_TIER_LIMIT} rides. Unlock unlimited ride history with
            Pro.
          </Text>
          <Pressable
            onPress={() =>
              // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
              router.push('/(tabs)/(profile)/upgrade' as any)
            }
            style={{
              backgroundColor: palette.signature500,
              borderRadius: 14,
              borderCurve: 'continuous',
              paddingHorizontal: 24,
              paddingVertical: 12,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
              Upgrade to Pro
            </Text>
          </Pressable>
        </Animated.View>
      );
    }
    return null;
  }, [isFetchingNextPage, showUpgradeCta, router]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.surfaceDark }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: '800', color: palette.white }}>My Rides</Text>
        <Pressable
          onPress={() => setSearchVisible(!searchVisible)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Search size={18} color={palette.neutral400} />
        </Pressable>
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
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 20,
            gap: 10,
          }}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={palette.accent500}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
