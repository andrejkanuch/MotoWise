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
import { SYSTEM_WEIGHT, space, type } from '../../theme/type';
import { formatDistance } from '../../utils/ride-formatters';
import { DIFFICULTY_TOKEN } from './discover-trip-card';

type TripNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

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
          <Text style={[type.sectionTitle, { color: theme.ink }]} accessibilityRole="header">
            {i18n('nearYou.sectionMeta', { country: countryName })}
          </Text>
        </View>
        <Pressable
          onPress={() => onViewAll(userCountry)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xxs,
            minHeight: 44,
            paddingLeft: space.sm,
          }}
          accessibilityRole="button"
        >
          <Text style={[type.label, { color: theme.warm2 }]}>{i18n('nearYou.viewAll')}</Text>
          <ChevronRight size={14} color={theme.warm2} />
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
  const diffToken = DIFFICULTY_TOKEN[trip.difficulty as keyof typeof DIFFICULTY_TOKEN] ?? null;
  const diffColor = diffToken ? theme[diffToken] : theme.ink3;

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
                  paddingHorizontal: space.xs,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: theme.plateReady,
                }}
              >
                <Award size={12} color={theme.onPlate} strokeWidth={2.2} />
                <Text style={[type.caption, SYSTEM_WEIGHT.semibold, { color: theme.onPlate }]}>
                  {i18n('nearYou.editorsPick')}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Body */}
        <View style={{ padding: 12, gap: 6 }}>
          <Text numberOfLines={2} style={[type.bodyStrong, { color: theme.ink }]}>
            {trip.title}
          </Text>
          {trip.countryCode && (
            <Text style={[type.caption, { color: theme.ink3 }]}>
              {COUNTRY_NAMES[trip.countryCode.toUpperCase() as SupportedCountryCode] ??
                trip.countryCode}
            </Text>
          )}

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
                <Text style={[type.caption, { color: theme.ink3, textTransform: 'capitalize' }]}>
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
      <Text style={[type.label, { color: theme.ink2, fontVariant: ['tabular-nums'] }]}>
        {label}
      </Text>
    </View>
  );
}
