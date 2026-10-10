import { SavedTripsDocument, type SavedTripsQuery, UnsaveTripDocument } from '@motovault/graphql';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { Bookmark, Compass, Mountain, Star } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useMeasurementSystem } from '@/hooks/use-measurement-system';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { GUTTER, radius, readableWidth, space, type } from '@/theme/type';
import { showActionSheet } from '@/utils/action-sheet';
import { triggerImpact } from '@/utils/haptics';
import { formatDistance } from '@/utils/ride-formatters';

const PAGE_SIZE = 20;

type SavedTripEdge = SavedTripsQuery['savedTrips']['edges'][number];
type SavedTripNode = SavedTripEdge['node'];

const SURFACE_LABEL_KEYS = {
  paved: 'discoverFilters.surfacePaved',
  mixed: 'discoverFilters.surfaceMixed',
  off_road: 'discoverFilters.surfaceOffRoad',
} as const;

function SavedTripCard({
  trip,
  index,
  onPress,
  onLongPress,
}: {
  trip: SavedTripNode;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const system = useMeasurementSystem();

  const surfaceKey =
    trip.surfaceType && trip.surfaceType in SURFACE_LABEL_KEYS
      ? SURFACE_LABEL_KEYS[trip.surfaceType as keyof typeof SURFACE_LABEL_KEYS]
      : null;

  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 50, 300)).duration(250)}>
      <Pressable
        onPress={onPress}
        onLongPress={() => {
          triggerImpact();
          onLongPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('saved.tripA11y', { title: trip.title })}
        android_ripple={{ color: tint(theme.ink, 0.08) }}
        style={({ pressed }) => ({
          backgroundColor:
            pressed && process.env.EXPO_OS === 'ios' ? theme.surface2 : theme.surface,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
          padding: space.md,
          gap: space.xs,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text style={[type.bodyStrong, { flex: 1, color: theme.ink }]} numberOfLines={1}>
            {trip.title}
          </Text>
          <Bookmark size={16} color={theme.ink2} fill={theme.ink2} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.md }}>
          {trip.distanceM != null && (
            <Text style={[type.figureSmall, { color: theme.ink }]}>
              {formatDistance(trip.distanceM, system)}
            </Text>
          )}

          {(trip.elevationGainM ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xxs }}>
              <Mountain size={13} color={theme.ink3} />
              <Text style={[type.figureSmall, { color: theme.ink }]}>
                {t('saved.elevationMeters', { value: Math.round(trip.elevationGainM ?? 0) })}
              </Text>
            </View>
          )}

          {surfaceKey && <Text style={[type.caption, { color: theme.ink3 }]}>{t(surfaceKey)}</Text>}

          {trip.averageRating != null && trip.reviewCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xxs }}>
              <Star size={12} color={theme.dueInk} fill={theme.dueInk} />
              <Text style={[type.label, { color: theme.ink2, fontVariant: ['tabular-nums'] }]}>
                {trip.averageRating.toFixed(1)}
              </Text>
              <Text style={[type.caption, { color: theme.ink3 }]}>({trip.reviewCount})</Text>
            </View>
          )}
        </View>

        {trip.organiser && (
          <Text style={[type.caption, { color: theme.ink3 }]}>
            {t('saved.byOrganiser', {
              name: trip.organiser.publicUsername
                ? `${trip.organiser.displayName} @${trip.organiser.publicUsername}`
                : trip.organiser.displayName,
            })}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function SavedScreen() {
  const router = useRouter();
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isRefetching } =
    useInfiniteQuery<SavedTripsQuery>({
      queryKey: queryKeys.savedTrips.all,
      queryFn: ({ pageParam }) =>
        gqlFetcher(SavedTripsDocument, {
          first: PAGE_SIZE,
          after: (pageParam as string) ?? null,
        }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => {
        const pageInfo = lastPage?.savedTrips?.pageInfo;
        if (!pageInfo?.hasNextPage) return undefined;
        return pageInfo.endCursor ?? undefined;
      },
    });

  const unsaveMutation = useMutation({
    mutationFn: (tripId: string) => gqlFetcher(UnsaveTripDocument, { tripId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedTrips.all });
    },
  });

  const allEdges = useMemo<SavedTripEdge[]>(
    () => (data?.pages ?? []).flatMap((page) => page?.savedTrips?.edges ?? []),
    [data?.pages],
  );

  const handleTripPress = useCallback(
    (tripId: string) => {
      router.push({
        pathname: '/(modals)/trip-detail',
        params: { tripId },
      } as Href);
    },
    [router],
  );

  const handleLongPress = useCallback(
    (trip: SavedTripNode) => {
      showActionSheet(trip.title, [
        {
          label: t('trips.share'),
          onPress: () => {
            Share.share({
              message: t('trips.shareMessage', { title: trip.title }),
            });
          },
        },
        {
          label: t('saved.removeFromSaved'),
          onPress: () => {
            triggerImpact();
            unsaveMutation.mutate(trip.id);
          },
          style: 'destructive',
        },
        { label: t('common.cancel'), onPress: () => {}, style: 'cancel' },
      ]);
    },
    [unsaveMutation, t],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: SavedTripEdge; index: number }) => (
      <SavedTripCard
        trip={item.node}
        index={index}
        onPress={() => handleTripPress(item.node.id)}
        onLongPress={() => handleLongPress(item.node)}
      />
    ),
    [handleTripPress, handleLongPress],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <Animated.View
        entering={FadeIn.duration(250)}
        style={{
          alignItems: 'center',
          paddingTop: space.xxxl,
          paddingHorizontal: space.xxl,
          gap: space.sm,
        }}
      >
        <Bookmark size={36} color={theme.ink3} strokeWidth={1.6} />
        <Text style={[type.sectionTitle, { color: theme.ink, textAlign: 'center' }]}>
          {t('saved.emptyTitle')}
        </Text>
        <Text style={[type.subhead, { color: theme.ink3, textAlign: 'center' }]}>
          {t('saved.emptyDesc')}
        </Text>
        <Pressable
          onPress={() => {
            triggerImpact();
            router.push('/(tabs)/(discover)');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('saved.exploreTrips')}
          android_ripple={{ color: tint(theme.onWarm, 0.12) }}
          style={({ pressed }) => ({
            backgroundColor: theme.warm,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            overflow: 'hidden',
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            marginTop: space.xs,
            flexDirection: 'row',
            gap: space.xs,
            opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.85 : 1,
          })}
        >
          <Compass size={20} color={theme.onWarm} />
          <Text style={[type.bodyStrong, { color: theme.onWarm }]}>{t('saved.exploreTrips')}</Text>
        </Pressable>
      </Animated.View>
    );
  }, [isLoading, t, theme, router]);

  const renderHeader = useCallback(() => {
    if (allEdges.length === 0) return null;
    return (
      <Text style={[type.label, { color: theme.ink3 }]}>
        {t('saved.tripCount', { count: allEdges.length })}
      </Text>
    );
  }, [allEdges.length, theme, t]);

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

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.bg,
        }}
      >
        <ActivityIndicator size="large" color={theme.ink3} />
      </View>
    );
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: theme.bg }}
      data={allEdges}
      renderItem={renderItem}
      keyExtractor={(item) => item.node.id}
      contentContainerStyle={{
        ...readableWidth,
        paddingHorizontal: GUTTER,
        paddingTop: space.xs,
        paddingBottom: space.xxxl,
        gap: space.sm,
      }}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            triggerImpact();
            refetch();
          }}
          tintColor={theme.ink3}
        />
      }
      showsVerticalScrollIndicator={false}
      windowSize={7}
      maxToRenderPerBatch={5}
    />
  );
}
