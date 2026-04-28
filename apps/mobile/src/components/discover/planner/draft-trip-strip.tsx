import { palette } from '@motovault/design-system';
import { MyTripsDocument, type MyTripsQuery } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Plus, Route } from 'lucide-react-native';
import { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useEditorialTheme } from '../../../theme/editorial';

type TripNode = MyTripsQuery['myTrips']['edges'][number]['node'];

// Rotate through accent colors for draft cards
const DRAFT_COLORS = [
  palette.editorialInfo,
  palette.signature500,
  palette.editorialSuccess,
  palette.editorialPurple,
] as const;

function DraftTripCard({
  trip,
  color,
  onPress,
}: {
  trip: TripNode;
  color: string;
  onPress: () => void;
}) {
  const { t } = useEditorialTheme();
  const waypointCount = trip.waypoints?.length ?? 0;

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 200,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Route size={13} color="#fff" />
        </View>
        <Text
          style={{
            fontFamily: 'GeistMono',
            fontSize: 9,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: t.ink3,
          }}
        >
          Draft
        </Text>
      </View>

      <Text
        style={{
          fontSize: 13.5,
          fontWeight: '600',
          color: t.ink,
          lineHeight: 16,
          letterSpacing: -0.1,
          marginBottom: 4,
        }}
        numberOfLines={1}
      >
        {trip.title}
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 10.5, color: t.ink3 }}>{waypointCount} stops</Text>
        {trip.difficulty && (
          <>
            <Text style={{ fontSize: 10.5, color: t.ink3, opacity: 0.4 }}>·</Text>
            <Text style={{ fontSize: 10.5, color: t.ink3 }}>{trip.difficulty}</Text>
          </>
        )}
      </View>

      {trip.description ? (
        <Text style={{ fontSize: 10.5, color: t.ink3, lineHeight: 14 }} numberOfLines={2}>
          {trip.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

function NewDraftCard({ onPress }: { onPress: () => void }) {
  const { t } = useEditorialTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 130,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: t.line,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 12,
        justifyContent: 'space-between',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={14} color={t.ink2} />
      </View>
      <View style={{ marginTop: 12 }}>
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: '600',
            color: t.ink2,
            lineHeight: 15,
            marginBottom: 4,
          }}
        >
          Blank trip
        </Text>
        <Text style={{ fontSize: 10.5, color: t.ink3, lineHeight: 14 }}>Start from scratch</Text>
      </View>
    </Pressable>
  );
}

export const DraftTripStrip = memo(function DraftTripStrip() {
  const { t } = useEditorialTheme();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.trips.my,
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
      // Validate draft still exists before navigating
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

  // Don't render the section if no drafts and not loading
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
        <Text
          style={{
            fontFamily: 'GeistMono',
            fontSize: 10.5,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: t.ink2,
            fontWeight: '600',
          }}
        >
          Continue planning
        </Text>
        {!isLoading && (
          <Text style={{ fontFamily: 'GeistMono', fontSize: 10.5, color: t.ink3 }}>
            {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
          </Text>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={palette.accent500} style={{ paddingVertical: 16 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          {drafts.map((draft, i) => (
            <DraftTripCard
              key={draft.id}
              trip={draft}
              color={DRAFT_COLORS[i % DRAFT_COLORS.length]}
              onPress={() => handleDraftPress(draft.id)}
            />
          ))}
          <NewDraftCard onPress={handleNewDraft} />
        </ScrollView>
      )}
    </Animated.View>
  );
});
