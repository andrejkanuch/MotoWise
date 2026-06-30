import { palette } from '@motovault/design-system';
import { TripTemplatesDocument, type TripTemplatesQuery } from '@motovault/graphql';
import { COUNTRY_NAMES, type SupportedCountryCode } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Award, ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { useUserCountry } from '../../hooks/use-user-country';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useEditorialTheme } from '../../theme/editorial';
import { formatDistance } from '../../utils/ride-formatters';

type TripNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: palette.editorialSuccess,
  moderate: palette.editorialDarkWarm,
  challenging: palette.danger500,
  expert: palette.editorialPurple,
};

interface NearYouSectionProps {
  onTripPress: (tripId: string) => void;
  onViewAll: (countryCode: SupportedCountryCode) => void;
}

export const NearYouSection = memo(function NearYouSection({
  onTripPress,
  onViewAll,
}: NearYouSectionProps) {
  const { t: theme } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { data: detected } = useUserCountry();
  const userCountry = detected?.countryCode ?? null;

  const { data: tripsData } = useQuery({
    queryKey: queryKeys.tripTemplates.list(`near-you-${userCountry}`),
    queryFn: () =>
      gqlFetcher(TripTemplatesDocument, {
        filter: { country: userCountry?.toLowerCase() },
        first: 6,
        after: null,
      }),
    enabled: !!userCountry,
    staleTime: 10 * 60 * 1000,
  });

  if (!userCountry) return null;

  const trips = tripsData?.tripTemplates?.edges?.map((e) => e.node) ?? [];
  if (trips.length === 0) return null;

  const countryName = COUNTRY_NAMES[userCountry];

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(300)}
      style={{ gap: 14, paddingTop: 6 }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'GeistMono',
              fontSize: 10,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: palette.accent500,
              fontWeight: '600',
              marginBottom: 6,
            }}
          >
            {i18n('nearYou.sectionMeta', { country: countryName })}
          </Text>
          <Text
            style={{
              fontFamily: 'InstrumentSerif',
              fontSize: 26,
              color: theme.ink,
              letterSpacing: -0.5,
              lineHeight: 30,
            }}
          >
            {i18n('nearYou.heading')}{' '}
            <Text style={{ fontStyle: 'italic', color: palette.accent500 }}>
              {i18n('nearYou.headingCountry', { country: countryName })}
            </Text>
          </Text>
        </View>
        <Pressable
          onPress={() => onViewAll(userCountry)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          <Text
            style={{
              fontFamily: 'GeistMono',
              fontSize: 10,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: theme.ink2,
              fontWeight: '500',
            }}
          >
            {i18n('nearYou.viewAll')}
          </Text>
          <ChevronRight size={12} color={theme.ink3} />
        </Pressable>
      </View>

      {/* Horizontal trip cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {trips.map((trip, index) => (
          <NearYouCard
            key={trip.id}
            trip={trip}
            index={index}
            onPress={() => onTripPress(trip.id)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
});

// --- Card ---

const NearYouCard = memo(function NearYouCard({
  trip,
  index,
  onPress,
}: {
  trip: TripNode;
  index: number;
  onPress: () => void;
}) {
  const { t: theme } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  const system = useMeasurementSystem();
  const reducedMotion = useReducedMotion();
  const km = trip.distanceM != null ? Math.round(trip.distanceM / 1000) : null;
  const elevM = trip.elevationGainM != null ? Math.round(trip.elevationGainM) : null;
  const hours = trip.estimatedDurationMinutes
    ? Math.floor(trip.estimatedDurationMinutes / 60)
    : null;
  const mins = trip.estimatedDurationMinutes ? trip.estimatedDurationMinutes % 60 : null;
  const diffColor = DIFFICULTY_COLORS[trip.difficulty] ?? theme.ink3;

  return (
    <Animated.View
      entering={
        reducedMotion
          ? undefined
          : FadeInUp.delay(index * 50)
              .springify()
              .damping(14)
      }
    >
      <Pressable
        onPress={onPress}
        style={{
          width: 260,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 16,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {/* Cover image */}
        {trip.coverImageUrl ? (
          <View style={{ height: 140, position: 'relative' }}>
            <Image
              source={{ uri: trip.coverImageUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              recyclingKey={trip.id}
            />
            {trip.isMotovaultPick && (
              <View
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: 'rgba(212,136,74,0.95)',
                }}
              >
                <Award size={10} color={palette.editorialDarkBg} strokeWidth={2.2} />
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '700',
                    letterSpacing: 0.7,
                    textTransform: 'uppercase',
                    color: palette.editorialDarkBg,
                  }}
                >
                  {i18n('nearYou.editorsPick')}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Body */}
        <View style={{ padding: 12, gap: 6 }}>
          {trip.countryCode && (
            <Text
              style={{
                fontFamily: 'GeistMono',
                fontSize: 9,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: theme.ink3,
              }}
            >
              {COUNTRY_NAMES[trip.countryCode.toUpperCase() as SupportedCountryCode] ??
                trip.countryCode}
            </Text>
          )}
          <Text
            numberOfLines={2}
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: theme.ink,
              letterSpacing: -0.3,
              lineHeight: 20,
            }}
          >
            {trip.title}
          </Text>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 }}>
            {km != null && <StatBadge label={formatDistance(km, system)} />}
            {elevM != null && (
              <StatBadge label={i18n('nearYou.elevLabel', { value: elevM.toLocaleString() })} />
            )}
            {hours != null && <StatBadge label={`${hours}h${mins ? ` ${mins}m` : ''}`} />}
          </View>

          {/* Rating + difficulty */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
            {trip.averageRating != null && trip.averageRating > 0 && (
              <StatBadge
                label={i18n('nearYou.ratingLabel', { value: trip.averageRating.toFixed(1) })}
              />
            )}
            {trip.difficulty && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: diffColor,
                  }}
                />
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 10,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: theme.ink3,
                    fontWeight: '500',
                  }}
                >
                  {trip.difficulty}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

function StatBadge({ label }: { label: string }) {
  const { t: theme } = useEditorialTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View
        style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: palette.accent500 }}
      />
      <Text
        style={{
          fontFamily: 'GeistMono',
          fontSize: 10,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: theme.ink3,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
