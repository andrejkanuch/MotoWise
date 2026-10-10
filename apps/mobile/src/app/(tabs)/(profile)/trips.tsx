import { DeleteTripDocument, MyTripsDocument, type MyTripsQuery } from '@motovault/graphql';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  Calendar,
  EyeOff,
  Globe,
  Lock,
  type LucideIcon,
  MapPin,
  Map as MapRoute,
  Plus,
  Users,
} from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { CompletenessRing } from '@/components/trip/completeness-ring';
import { Avatar } from '@/components/ui/avatar';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { type EditorialTokens, tint, useEditorialTheme } from '@/theme/editorial';
import { GUTTER, radius, readableWidth, space, type } from '@/theme/type';
import { showActionSheet } from '@/utils/action-sheet';
import { triggerImpact } from '@/utils/haptics';
import { computeTripCompleteness } from '@/utils/trip-completeness';
import { formatTripDateRangeShort } from '@/utils/trip-date-range';

const PAGE_SIZE = 20;
const TARGET_SIZE = process.env.EXPO_OS === 'android' ? 48 : 44;

type TripEdge = MyTripsQuery['myTrips']['edges'][number];
type TripNode = TripEdge['node'];

const VISIBILITY = {
  PRIVATE: 'private',
  UNLISTED: 'unlisted',
  PUBLIC: 'public',
} as const;
type VisibilityKey = (typeof VISIBILITY)[keyof typeof VISIBILITY];

const TRIP_STATUS_DRAFT = 'draft';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

function getVisibilityStyles(
  t: TFn,
  theme: EditorialTokens,
): Record<VisibilityKey, { Icon: LucideIcon; label: string; tint: string }> {
  return {
    private: { Icon: Lock, label: t('trips.visibilityPrivate'), tint: theme.ink3 },
    unlisted: { Icon: EyeOff, label: t('trips.visibilityUnlisted'), tint: theme.info },
    public: { Icon: Globe, label: t('trips.visibilityPublic'), tint: theme.success },
  };
}

function getDifficultyColors(theme: EditorialTokens) {
  return {
    easy: theme.success,
    moderate: theme.dueInk,
    challenging: theme.danger,
    expert: theme.ink,
  } as const;
}

function getDifficultyLabels(t: TFn) {
  return {
    easy: t('trips.difficultyEasy'),
    moderate: t('trips.difficultyModerate'),
    challenging: t('trips.difficultyChallenging'),
    expert: t('trips.difficultyExpert'),
  } as const;
}

function dayCount(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** One stat in the card strip: icon + condensed figure + unit caption. */
function TripStat({ icon: Icon, value, unit }: { icon: LucideIcon; value: number; unit: string }) {
  const { t: theme } = useEditorialTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xxs }}>
      <Icon size={13} color={theme.ink3} />
      <Text style={[type.figureSmall, { color: theme.ink }]}>{value}</Text>
      <Text style={[type.caption, { color: theme.ink3 }]}>{unit}</Text>
    </View>
  );
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
  const { t: theme, isDark } = useEditorialTheme();
  const { t } = useTranslation();

  const difficultyColors = getDifficultyColors(theme);
  const diffKey = (trip.difficulty || 'easy').toLowerCase() as keyof typeof difficultyColors;
  const diffColor = difficultyColors[diffKey] ?? theme.ink3;
  const diffLabels = getDifficultyLabels(t as TFn);
  const diffLabel = diffLabels[diffKey] ?? diffLabels.easy;

  const rawVis = (trip.visibility ?? VISIBILITY.PRIVATE).toLowerCase();
  const visKey: VisibilityKey = (Object.values(VISIBILITY) as string[]).includes(rawVis)
    ? (rawVis as VisibilityKey)
    : VISIBILITY.PRIVATE;
  const vis = getVisibilityStyles(t as TFn, theme)[visKey];
  const VisIcon = vis.Icon;

  const isDraft = trip.status === TRIP_STATUS_DRAFT;
  const days = dayCount(trip.startDate, trip.endDate);
  const stopCount = trip.waypoints?.length ?? 0;
  const maxRiders = Math.max(1, trip.maxRiders ?? 1);
  const participantCount = Math.min(Math.max(0, trip.participantCount ?? 0), maxRiders);
  const title = trip.title || t('trips.untitledTrip');

  // P4.2 — nudge the rider to finish drafts; hide ring when fully planned.
  // Memoised so scroll / draft-count re-renders of the parent list don't
  // replay the dimension scoring for every visible card.
  const completeness = useMemo(
    () =>
      computeTripCompleteness({
        description: trip.description,
        waypointCount: stopCount,
        dayCount: days,
        participantCount,
        maxRiders,
      }),
    [trip.description, stopCount, days, participantCount, maxRiders],
  );

  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 50, 300)).duration(250)}>
      <Pressable
        onPress={onPress}
        onLongPress={() => {
          triggerImpact();
          onLongPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={isDraft ? `${t('trips.draftLabel')}: ${title}` : title}
        android_ripple={{ color: tint(theme.ink, 0.08) }}
        style={({ pressed }) => ({
          backgroundColor:
            pressed && process.env.EXPO_OS === 'ios' ? theme.surface2 : theme.surface,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
          padding: space.md,
          gap: space.sm,
        })}
      >
        {/* Badge row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          {isDraft ? (
            <View
              style={{
                backgroundColor: theme.plateDue,
                paddingHorizontal: space.xs,
                paddingVertical: 2,
                borderRadius: radius.chip - 4,
                borderCurve: 'continuous',
              }}
            >
              <Text style={[type.label, { color: theme.onPlate }]}>{t('trips.draftLabel')}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
              <VisIcon size={12} color={vis.tint} />
              <Text style={[type.label, { color: vis.tint }]}>{vis.label}</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          {/* Planning-completeness ring — shown on anything less than fully
              planned so drafts stand out without a scolding progress bar. */}
          {completeness.percent < 100 && (
            <CompletenessRing percent={completeness.percent} dark={isDark} size={26} stroke={2.5} />
          )}

          <View
            style={{
              paddingHorizontal: space.xs,
              paddingVertical: 2,
              borderRadius: radius.chip - 4,
              borderCurve: 'continuous',
              backgroundColor: tint(diffColor, 0.16),
            }}
          >
            <Text style={[type.label, { color: diffColor }]}>{diffLabel}</Text>
          </View>
        </View>

        <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
          {title}
        </Text>

        {/* Stats strip */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.md }}>
          <TripStat icon={Calendar} value={days} unit="d" />
          {stopCount > 0 && (
            <TripStat
              icon={MapPin}
              value={stopCount}
              unit={stopCount === 1 ? t('trips.stopSingular') : t('trips.stopPlural')}
            />
          )}
          {!isDraft && <TripStat icon={Users} value={participantCount} unit={`/ ${maxRiders}`} />}
        </View>

        {/* Meta row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text style={[type.caption, { color: theme.ink3 }]} numberOfLines={1}>
            {formatTripDateRangeShort(trip.startDate, trip.endDate)}
          </Text>
          <Text style={[type.caption, { color: theme.ink4 }]}>·</Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs, flexShrink: 1 }}
          >
            <Avatar
              url={trip.organiser.avatarUrl}
              name={trip.organiser.displayName}
              size={16}
              variant="neutral"
            />
            <Text style={[type.caption, { color: theme.ink3, flexShrink: 1 }]} numberOfLines={1}>
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
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

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
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      queryClient.removeQueries({ queryKey: queryKeys.trips.detail(tripId) });
    },
    onError: (err) => {
      Alert.alert(
        t('trips.deleteFailed'),
        err instanceof Error && err.message ? err.message : t('trips.deleteFailedMessage'),
      );
    },
  });

  const allEdges = useMemo<TripEdge[]>(
    () => (data?.pages ?? []).flatMap((page) => page?.myTrips?.edges ?? []),
    [data?.pages],
  );

  // Draft trips float to the top — they're the ones the user is likely returning to finish.
  const sortedEdges = useMemo<TripEdge[]>(() => {
    const drafts = allEdges.filter((e) => e.node.status === TRIP_STATUS_DRAFT);
    const rest = allEdges.filter((e) => e.node.status !== TRIP_STATUS_DRAFT);
    return [...drafts, ...rest];
  }, [allEdges]);

  const handleTripPress = useCallback(
    (trip: TripNode) => {
      if (trip.status === TRIP_STATUS_DRAFT) {
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
        trip.status === TRIP_STATUS_DRAFT
          ? [t('trips.continueEditing'), t('trips.deleteDraft'), t('common.cancel')]
          : [t('trips.share'), t('trips.edit'), t('trips.deleteTrip'), t('common.cancel')];
      const confirmDelete = () => {
        Alert.alert(
          trip.status === TRIP_STATUS_DRAFT
            ? t('trips.confirmDeleteDraft')
            : t('trips.confirmDeleteTrip'),
          trip.status === TRIP_STATUS_DRAFT
            ? t('trips.confirmDeleteDraftMessage')
            : t('trips.confirmDeleteTripMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.delete'),
              style: 'destructive',
              onPress: () => deleteMutation.mutate(trip.id),
            },
          ],
        );
      };

      if (trip.status === TRIP_STATUS_DRAFT) {
        showActionSheet(trip.title || t('trips.untitledTrip'), [
          { label: options[0], onPress: () => handleTripPress(trip) },
          { label: options[1], onPress: confirmDelete, style: 'destructive' },
          { label: options[2], onPress: () => {}, style: 'cancel' },
        ]);
      } else {
        showActionSheet(trip.title || t('trips.untitledTrip'), [
          {
            label: options[0],
            onPress: () => {
              Share.share({
                message: t('trips.shareMessage', { title: trip.title }),
              });
            },
          },
          {
            label: options[1],
            onPress: () => {
              router.push({ pathname: '/(modals)/create-trip', params: { tripId: trip.id } });
            },
          },
          { label: options[2], onPress: confirmDelete, style: 'destructive' },
          { label: options[3], onPress: () => {}, style: 'cancel' },
        ]);
      }
    },
    [deleteMutation, handleTripPress, router, t],
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

  const openCreateTrip = useCallback(() => {
    triggerImpact();
    router.push('/(modals)/create-trip');
  }, [router]);

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
        <MapRoute size={36} color={theme.ink3} strokeWidth={1.6} />
        <Text style={[type.sectionTitle, { color: theme.ink, textAlign: 'center' }]}>
          {t('trips.emptyTitle')}
        </Text>
        <Text style={[type.subhead, { color: theme.ink3, textAlign: 'center' }]}>
          {t('trips.emptySubtitle')}
        </Text>
        <Pressable
          onPress={openCreateTrip}
          accessibilityRole="button"
          accessibilityLabel={t('trips.planATrip')}
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
          <Plus size={20} color={theme.onWarm} />
          <Text style={[type.bodyStrong, { color: theme.onWarm }]}>{t('trips.planATrip')}</Text>
        </Pressable>
      </Animated.View>
    );
  }, [isLoading, theme, t, openCreateTrip]);

  const draftCount = useMemo(
    () => allEdges.filter((e) => e.node.status === TRIP_STATUS_DRAFT).length,
    [allEdges],
  );

  const renderHeader = useCallback(() => {
    if (draftCount === 0) return null;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            borderCurve: 'continuous',
            backgroundColor: theme.dueInk,
          }}
        />
        <Text style={[type.label, { color: theme.ink2 }]}>
          {t('trips.draftCount', { count: draftCount })}
        </Text>
      </View>
    );
  }, [draftCount, theme, t]);

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
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={openCreateTrip}
              accessibilityRole="button"
              accessibilityLabel={t('trips.planATrip')}
              hitSlop={8}
              style={{
                minWidth: TARGET_SIZE,
                minHeight: TARGET_SIZE,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={24} color={theme.warm} strokeWidth={2.2} />
            </Pressable>
          ),
        }}
      />
      {isLoading ? (
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
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: theme.bg }}
          data={sortedEdges}
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
      )}
    </>
  );
}
