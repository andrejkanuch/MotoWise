import { palette } from '@motovault/design-system';
import {
  SavedTripsDocument,
  type SavedTripsQuery,
  UnsaveTripDocument,
} from '@motovault/graphql';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bookmark, Compass, Mountain, Route, Star } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeasurementSystem } from '../../../hooks/use-measurement-system';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { triggerImpact } from '../../../utils/haptics';
import { formatDistance } from '../../../utils/ride-formatters';

const PAGE_SIZE = 20;

type SavedTripEdge = SavedTripsQuery['savedTrips']['edges'][number];
type SavedTripNode = SavedTripEdge['node'];

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
  const isDark = useColorScheme() === 'dark';
  const system = useMeasurementSystem();

  const cardBg = isDark ? palette.cardDark : palette.white;
  const cardBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const statColor = isDark ? palette.neutral200 : palette.neutral700;
  const pressedBg = isDark ? palette.neutral800 : palette.neutral100;

  const surfaceLabel =
    trip.surfaceType === 'paved'
      ? 'Paved'
      : trip.surfaceType === 'mixed'
        ? 'Mixed'
        : trip.surfaceType === 'off_road'
          ? 'Off-road'
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
        accessibilityLabel={`Saved trip: ${trip.title}`}
        style={({ pressed }) => ({
          backgroundColor: pressed ? pressedBg : cardBg,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: cardBorder,
          padding: 14,
          gap: 8,
        })}
      >
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Route size={16} color={palette.accent500} />
          <Text
            style={{ flex: 1, fontSize: 15, fontWeight: '700', color: titleColor }}
            numberOfLines={1}
          >
            {trip.title}
          </Text>
          <Bookmark size={14} color={palette.accent500} fill={palette.accent500} />
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {trip.distanceM != null && (
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: statColor,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatDistance(trip.distanceM, system)}
            </Text>
          )}

          {(trip.elevationGainM ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Mountain size={12} color={palette.accent500} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: statColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {Math.round(trip.elevationGainM ?? 0)}m
              </Text>
            </View>
          )}

          {surfaceLabel && (
            <Text style={{ fontSize: 12, color: subtitleColor }}>{surfaceLabel}</Text>
          )}

          {trip.averageRating != null && trip.reviewCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Star size={12} color={palette.warning500} fill={palette.warning500} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: statColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {trip.averageRating.toFixed(1)}
              </Text>
              <Text style={{ fontSize: 11, color: subtitleColor }}>({trip.reviewCount})</Text>
            </View>
          )}
        </View>

        {/* Organiser */}
        {trip.organiser && (
          <Text style={{ fontSize: 12, color: subtitleColor }}>
            by {trip.organiser.displayName}
            {trip.organiser.publicUsername ? ` @${trip.organiser.publicUsername}` : ''}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
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
      // biome-ignore lint/suspicious/noExplicitAny: expo-router does not export typed route params for dynamic modals
      router.push({ pathname: '/(modals)/discover-trip-detail' as const, params: { discoverTripId: tripId } } as any);
    },
    [router],
  );

  const handleLongPress = useCallback(
    (trip: SavedTripNode) => {
      if (process.env.EXPO_OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Share Trip', 'Remove from Saved', 'Cancel'],
            destructiveButtonIndex: 1,
            cancelButtonIndex: 2,
            title: trip.title,
          },
          (buttonIndex) => {
            if (buttonIndex === 0) {
              Share.share({
                message: `Check out this trip on MotoVault: ${trip.title}`,
              });
            } else if (buttonIndex === 1) {
              triggerImpact();
              unsaveMutation.mutate(trip.id);
            }
          },
        );
      } else {
        // Android fallback: just unsave for now
        triggerImpact();
        unsaveMutation.mutate(trip.id);
      }
    },
    [unsaveMutation],
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
        entering={FadeIn.duration(300)}
        style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 16 }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            borderCurve: 'continuous',
            backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Bookmark size={36} color={isDark ? palette.neutral500 : palette.neutral400} />
        </View>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: isDark ? palette.white : palette.neutral950,
            textAlign: 'center',
          }}
        >
          No saved trips yet
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: isDark ? palette.neutral400 : palette.neutral500,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          Browse trips on the Discover tab and save the ones you want to ride later.
        </Text>
        <Pressable
          onPress={() => {
            triggerImpact();
            // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
            router.push('/(tabs)/(discover)' as any);
          }}
          accessibilityRole="button"
          accessibilityLabel="Explore Trips"
          style={({ pressed }) => ({
            backgroundColor: palette.primary700,
            borderRadius: 20,
            borderCurve: 'continuous',
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            marginTop: 8,
            flexDirection: 'row',
            gap: 8,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Compass size={20} color={palette.white} />
          <Text style={{ color: palette.white, fontSize: 16, fontWeight: '700' }}>
            Explore Trips
          </Text>
        </Pressable>
      </Animated.View>
    );
  }, [isLoading, isDark, router]);

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View style={{ paddingVertical: 20 }}>
          <ActivityIndicator size="small" color={palette.accent500} />
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage]);

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
          Saved Trips
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
            {allEdges?.length ?? 0} trip{(allEdges?.length ?? 0) !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.accent500} />
        </View>
      ) : (
        <FlatList
          data={allEdges ?? []}
          renderItem={renderItem}
          keyExtractor={(item) => item.node.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 20,
            gap: 12,
          }}
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
