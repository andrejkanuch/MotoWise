import { MyTripsDocument, type MyTripsQuery } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Calendar, MapPin, Plus, Users } from 'lucide-react-native';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '@/theme/type';
import { computeTripCompleteness } from '@/utils/trip-completeness';
import { CompletenessRing } from '../../trip/completeness-ring';
import { Avatar } from '../../ui/avatar';
import { DIFFICULTY_TOKEN } from '../discover-trip-card';

type TripNode = MyTripsQuery['myTrips']['edges'][number]['node'];

const DIFFICULTY_LABEL_KEYS = {
  easy: 'trips.difficultyEasy',
  moderate: 'trips.difficultyModerate',
  challenging: 'trips.difficultyChallenging',
  expert: 'trips.difficultyExpert',
} as const;

function dayCount(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (start === end) return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

function DraftTripCard({ trip, onPress }: { trip: TripNode; onPress: () => void }) {
  const { t } = useEditorialTheme();
  const { t: tr } = useTranslation();

  const waypointCount = trip.waypoints?.length ?? 0;
  const days = dayCount(trip.startDate, trip.endDate);
  const maxRiders = Math.max(1, trip.maxRiders ?? 1);
  const participantCount = Math.min(Math.max(0, trip.participantCount ?? 0), maxRiders);

  const diffKey = (trip.difficulty || 'easy').toLowerCase();
  const diffToken = DIFFICULTY_TOKEN[diffKey as keyof typeof DIFFICULTY_TOKEN];
  const diffColor = diffToken ? t[diffToken] : t.ink3;
  const diffLabel = tr(
    DIFFICULTY_LABEL_KEYS[diffKey as keyof typeof DIFFICULTY_LABEL_KEYS] ??
      DIFFICULTY_LABEL_KEYS.easy,
  );

  const completeness = useMemo(
    () =>
      computeTripCompleteness({
        description: trip.description,
        waypointCount,
        dayCount: days,
        participantCount,
        maxRiders,
      }),
    [trip.description, waypointCount, days, participantCount, maxRiders],
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('tripDrafts.cardA11y', {
        title: trip.title || tr('trips.untitledTrip'),
      })}
      style={({ pressed }) => ({
        width: 280,
        backgroundColor: pressed ? t.surface2 : t.surface,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        padding: 14,
        gap: 10,
      })}
    >
      {/* Badge row: DRAFT badge + completeness ring + difficulty */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            backgroundColor: t.plateDue,
            paddingHorizontal: space.xs,
            paddingVertical: 2,
            borderRadius: radius.chip,
            borderCurve: 'continuous',
          }}
        >
          <Text style={[type.caption, SYSTEM_WEIGHT.semibold, { color: t.onPlate }]}>
            {tr('trips.draftLabel')}
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        {completeness.percent < 100 && (
          <CompletenessRing percent={completeness.percent} size={26} stroke={2.5} />
        )}

        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            borderCurve: 'continuous',
            backgroundColor: tint(diffColor, 0.14),
          }}
        >
          <Text style={[type.caption, SYSTEM_WEIGHT.semibold, { color: diffColor }]}>
            {diffLabel}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={[type.bodyStrong, { color: t.ink }]} numberOfLines={1}>
        {trip.title || tr('trips.untitledTrip')}
      </Text>

      {/* Stats strip: days + stops + riders */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Calendar size={12} color={t.ink3} />
          <Text style={[type.figureSmall, { color: t.ink }]}>
            {days}
            <Text style={[type.caption, { color: t.ink3 }]}>{tr('tripDrafts.dayUnit')}</Text>
          </Text>
        </View>
        {waypointCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MapPin size={12} color={t.ink3} />
            <Text style={[type.figureSmall, { color: t.ink }]}>
              {waypointCount}
              <Text style={[type.caption, { color: t.ink3 }]}>
                {' '}
                {waypointCount === 1 ? tr('trips.stopSingular') : tr('trips.stopPlural')}
              </Text>
            </Text>
          </View>
        )}
        {maxRiders > 1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Users size={12} color={t.ink3} />
            <Text style={[type.figureSmall, { color: t.ink }]}>
              {participantCount}
              <Text style={[type.caption, { color: t.ink3 }]}>/{maxRiders}</Text>
            </Text>
          </View>
        )}
      </View>

      {/* Meta row: date range + organiser */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[type.caption, { color: t.ink3 }]} numberOfLines={1}>
          {formatDateRange(trip.startDate, trip.endDate)}
        </Text>
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: t.ink3,
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
          <Text style={[type.caption, { color: t.ink3, flexShrink: 1 }]} numberOfLines={1}>
            {trip.organiser.displayName}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function NewDraftCard({ onPress }: { onPress: () => void }) {
  const { t } = useEditorialTheme();
  const { t: tr } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('tripDrafts.newDraftA11y')}
      style={{
        width: 110,
        borderWidth: 1.5,
        borderColor: t.line,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={14} color={t.ink2} />
      </View>
      <Text style={[type.caption, SYSTEM_WEIGHT.medium, { color: t.ink2, textAlign: 'center' }]}>
        {tr('tripDrafts.newDraft')}
      </Text>
    </Pressable>
  );
}

export const DraftTripStrip = memo(function DraftTripStrip() {
  const { t } = useEditorialTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.trips.myDrafts,
    queryFn: () => gqlFetcher(MyTripsDocument, { first: 10 }),
    staleTime: 5 * 60 * 1000,
  });

  const drafts = useMemo(() => {
    if (!data?.myTrips?.edges) return [];
    return data.myTrips.edges
      .map((e) => e.node)
      .filter((trip) => trip.status === 'draft')
      .slice(0, 8);
  }, [data]);

  const handleDraftPress = useCallback(
    (tripId: string) => {
      const stillExists = drafts.some((d) => d.id === tripId);
      if (!stillExists) return;
      if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
      router.push({ pathname: '/(modals)/create-trip', params: { tripId } });
    },
    [drafts, router],
  );

  const handleNewDraft = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(modals)/create-trip');
  }, [router]);

  if (!isLoading && drafts.length === 0) {
    return null;
  }

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(300).delay(200)}
      style={{ gap: 10 }}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Text style={[type.sectionTitle, { color: t.ink }]} accessibilityRole="header">
          {tr('tripDrafts.continuePlanning')}
        </Text>
        {!isLoading && (
          <Text style={[type.caption, { color: t.ink3 }]}>
            {tr('tripDrafts.count', { count: drafts.length })}
          </Text>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={t.ink3} style={{ paddingVertical: 16 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          {drafts.map((draft) => (
            <DraftTripCard key={draft.id} trip={draft} onPress={() => handleDraftPress(draft.id)} />
          ))}
          <NewDraftCard onPress={handleNewDraft} />
        </ScrollView>
      )}
    </Animated.View>
  );
});
