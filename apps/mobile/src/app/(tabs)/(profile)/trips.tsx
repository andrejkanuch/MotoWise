import { palette } from '@motovault/design-system';
import { DeleteTripDocument, MyTripsDocument, type MyTripsQuery } from '@motovault/graphql';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  EyeOff,
  Globe,
  Lock,
  MapPin,
  Map as MapRoute,
  Plus,
  Users,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useCallback, useMemo } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
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
import { Avatar } from '../../../components/ui/avatar';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { triggerImpact } from '../../../utils/haptics';

const PAGE_SIZE = 20;

type TripEdge = MyTripsQuery['myTrips']['edges'][number];
type TripNode = TripEdge['node'];

type VisibilityKey = 'private' | 'unlisted' | 'public';

const VISIBILITY_STYLES: Record<
  VisibilityKey,
  { Icon: ComponentType<{ size?: number; color?: string }>; label: string; tint: string }
> = {
  private: { Icon: Lock, label: 'Private', tint: palette.neutral500 },
  unlisted: { Icon: EyeOff, label: 'Link only', tint: palette.warning500 },
  public: { Icon: Globe, label: 'Public', tint: palette.success500 },
};

const DIFFICULTY_COLORS = {
  easy: palette.success500,
  moderate: palette.warning500,
  challenging: palette.danger500,
  expert: palette.signature500,
} as const;

const DIFFICULTY_LABELS = {
  easy: 'Chill',
  moderate: 'Spirited',
  challenging: 'Technical',
  expert: 'Expert',
} as const;

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (start === end) return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

function dayCount(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function MyTripCard({
  trip,
  index,
  onPress,
  onLongPress,
}: {
  trip: TripNode;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const isDark = useColorScheme() === 'dark';

  const cardBg = isDark ? palette.cardDark : palette.white;
  const cardBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const metaColor = isDark ? palette.neutral300 : palette.neutral600;
  const pressedBg = isDark ? palette.neutral800 : palette.neutral100;

  const diffKey = (trip.difficulty || 'easy').toLowerCase() as keyof typeof DIFFICULTY_COLORS;
  const diffColor = DIFFICULTY_COLORS[diffKey] ?? palette.neutral500;
  const diffLabel = DIFFICULTY_LABELS[diffKey] ?? 'Chill';

  const rawVis = (trip.visibility ?? 'private').toLowerCase();
  const visKey: VisibilityKey =
    rawVis === 'public' || rawVis === 'unlisted' || rawVis === 'private'
      ? (rawVis as VisibilityKey)
      : 'private';
  const vis = VISIBILITY_STYLES[visKey];
  const VisIcon = vis.Icon;

  const isDraft = trip.status === 'draft';
  const days = dayCount(trip.startDate, trip.endDate);
  const stopCount = trip.waypoints?.length ?? 0;
  const maxRiders = Math.max(1, trip.maxRiders ?? 1);
  const participantCount = Math.min(Math.max(0, trip.participantCount ?? 0), maxRiders);

  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 50, 300)).duration(250)}>
      <Pressable
        onPress={onPress}
        onLongPress={() => {
          triggerImpact();
          onLongPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${isDraft ? 'Draft trip' : 'Trip'}: ${trip.title}`}
        style={({ pressed }) => ({
          backgroundColor: pressed ? pressedBg : cardBg,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: isDraft ? (isDark ? palette.warning500 : palette.warning500) : cardBorder,
          padding: 14,
          gap: 10,
          opacity: isDraft ? 1 : 1,
        })}
      >
        {/* Badge row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {isDraft ? (
            <View
              style={{
                backgroundColor: palette.warning500,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderCurve: 'continuous',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '800',
                  color: palette.white,
                  letterSpacing: 0.5,
                }}
              >
                DRAFT
              </Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: isDark ? palette.surfaceElevated : palette.neutral100,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderCurve: 'continuous',
              }}
            >
              <VisIcon size={10} color={vis.tint} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: vis.tint }}>{vis.label}</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              borderCurve: 'continuous',
              backgroundColor: diffColor,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.white }}>
              {diffLabel}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text
          style={{
            fontSize: 17,
            fontWeight: '800',
            color: titleColor,
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
        >
          {trip.title || 'Untitled trip'}
        </Text>

        {/* Stats strip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Calendar size={12} color={palette.accent500} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: titleColor }}>
              {days}
              <Text style={{ fontWeight: '500', color: metaColor }}>d</Text>
            </Text>
          </View>
          {stopCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} color={palette.accent500} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: titleColor }}>
                {stopCount}
                <Text style={{ fontWeight: '500', color: metaColor }}>
                  {stopCount === 1 ? ' stop' : ' stops'}
                </Text>
              </Text>
            </View>
          )}
          {!isDraft && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Users size={12} color={palette.accent500} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: titleColor }}>
                {participantCount}
                <Text style={{ fontWeight: '500', color: metaColor }}>/{maxRiders}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* Meta row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 12, color: subtitleColor, fontWeight: '500' }} numberOfLines={1}>
            {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: subtitleColor,
              opacity: 0.6,
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
            <Avatar
              url={trip.organiser.avatarUrl}
              name={trip.organiser.displayName}
              size={16}
              variant="neutral"
            />
            <Text style={{ fontSize: 12, color: subtitleColor, flexShrink: 1 }} numberOfLines={1}>
              {trip.organiser.displayName}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function MyTripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isRefetching } =
    useInfiniteQuery<MyTripsQuery>({
      queryKey: queryKeys.trips.my,
      queryFn: ({ pageParam }) =>
        gqlFetcher(MyTripsDocument, { first: PAGE_SIZE, after: (pageParam as string) ?? null }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => {
        const pageInfo = lastPage?.myTrips?.pageInfo;
        if (!pageInfo?.hasNextPage) return undefined;
        return pageInfo.endCursor ?? undefined;
      },
    });

  const deleteMutation = useMutation({
    mutationFn: (tripId: string) => gqlFetcher(DeleteTripDocument, { tripId }),
    onSuccess: (_data, tripId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.removeQueries({ queryKey: queryKeys.trips.detail(tripId) });
    },
    onError: (err) => {
      Alert.alert(
        'Could not delete',
        err instanceof Error && err.message ? err.message : 'Check your connection and try again.',
      );
    },
  });

  const allEdges = useMemo<TripEdge[]>(
    () => (data?.pages ?? []).flatMap((page) => page?.myTrips?.edges ?? []),
    [data?.pages],
  );

  // Draft trips float to the top — they're the ones the user is likely returning to finish.
  const sortedEdges = useMemo<TripEdge[]>(() => {
    const drafts = allEdges.filter((e) => e.node.status === 'draft');
    const rest = allEdges.filter((e) => e.node.status !== 'draft');
    return [...drafts, ...rest];
  }, [allEdges]);

  const handleTripPress = useCallback(
    (trip: TripNode) => {
      if (trip.status === 'draft') {
        // Drafts resume in the create-trip editor so the user can finish and publish.
        router.push({ pathname: '/(modals)/create-trip', params: { tripId: trip.id } });
      } else {
        router.push({ pathname: '/(modals)/trip-detail', params: { tripId: trip.id } });
      }
    },
    [router],
  );

  const handleLongPress = useCallback(
    (trip: TripNode) => {
      const options =
        trip.status === 'draft'
          ? ['Continue Editing', 'Delete Draft', 'Cancel']
          : ['Share', 'Edit', 'Delete Trip', 'Cancel'];
      const destructiveIndex = trip.status === 'draft' ? 1 : 2;
      const cancelIndex = options.length - 1;

      const confirmDelete = () => {
        Alert.alert(
          trip.status === 'draft' ? 'Delete this draft?' : 'Delete this trip?',
          trip.status === 'draft'
            ? 'The draft and all its stops will be gone.'
            : "The route, every stop, and all the riders on it will be gone. Can't be undone.",
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => deleteMutation.mutate(trip.id),
            },
          ],
        );
      };

      if (process.env.EXPO_OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            destructiveButtonIndex: destructiveIndex,
            cancelButtonIndex: cancelIndex,
            title: trip.title || 'Trip',
          },
          (i) => {
            if (trip.status === 'draft') {
              if (i === 0) handleTripPress(trip);
              else if (i === 1) confirmDelete();
            } else {
              if (i === 0) {
                Share.share({
                  message: `Check out this trip on MotoVault: ${trip.title}`,
                });
              } else if (i === 1) {
                router.push({ pathname: '/(modals)/create-trip', params: { tripId: trip.id } });
              } else if (i === 2) confirmDelete();
            }
          },
        );
      } else {
        confirmDelete();
      }
    },
    [deleteMutation, handleTripPress, router],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: TripEdge; index: number }) => (
      <MyTripCard
        trip={item.node}
        index={index}
        onPress={() => handleTripPress(item.node)}
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
          <MapRoute size={36} color={isDark ? palette.neutral500 : palette.neutral400} />
        </View>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: isDark ? palette.white : palette.neutral950,
            textAlign: 'center',
          }}
        >
          No trips yet
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: isDark ? palette.neutral400 : palette.neutral500,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          Plan a multi-day ride with stops, then share it with your crew.
        </Text>
        <Pressable
          onPress={() => {
            triggerImpact();
            router.push('/(modals)/create-trip');
          }}
          accessibilityRole="button"
          accessibilityLabel="Plan a Trip"
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
          <Plus size={20} color={palette.white} />
          <Text style={{ color: palette.white, fontSize: 16, fontWeight: '700' }}>Plan a Trip</Text>
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

  const draftCount = useMemo(
    () => allEdges.filter((e) => e.node.status === 'draft').length,
    [allEdges],
  );

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
          My Trips
        </Text>
        <Pressable
          onPress={() => {
            triggerImpact();
            router.push('/(modals)/create-trip');
          }}
          accessibilityRole="button"
          accessibilityLabel="Plan a new trip"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: palette.accent500,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={20} color={palette.white} />
        </Pressable>
      </View>

      {/* Draft summary chip */}
      {draftCount > 0 && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: `${palette.warning500}22`,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: palette.warning500,
              }}
            />
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.warning500 }}>
              {draftCount} draft{draftCount !== 1 ? 's' : ''} — tap to finish
            </Text>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.accent500} />
        </View>
      ) : (
        <FlatList
          data={sortedEdges}
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
