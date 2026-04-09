import { palette } from '@motovault/design-system';
import { GetTripsDocument, type GetTripsQuery } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { MapPin, Plus } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { TripCard } from './trip-card';

type TripNode = GetTripsQuery['getTrips']['edges'][number]['node'];

export function TripSection() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();

  const headerColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const emptyIconColor = isDark ? palette.neutral600 : palette.neutral300;
  const createBg = isDark ? palette.cardDark : palette.white;
  const createBorder = isDark ? palette.surfaceElevated : palette.neutral200;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.trips.all,
    queryFn: () => gqlFetcher(GetTripsDocument, { first: 5 }),
  });

  const trips = useMemo(() => {
    if (!data?.getTrips?.edges) return [];
    return data.getTrips.edges.map((e) => e.node);
  }, [data]);

  const handleTripPress = useCallback(
    (tripId: string) => {
      router.push({ pathname: '/(modals)/trip-detail', params: { tripId } });
    },
    [router],
  );

  const handleCreate = useCallback(() => {
    router.push('/(modals)/create-trip');
  }, [router]);

  return (
    <Animated.View entering={FadeInUp.duration(300).delay(100)} style={{ gap: 10 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} color={palette.accent500} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: headerColor }}>
            Upcoming Trips{trips.length > 0 ? ` (${trips.length})` : ''}
          </Text>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <ActivityIndicator size="small" color={palette.accent500} style={{ paddingVertical: 24 }} />
      ) : trips.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10, paddingHorizontal: 16 }}>
          <MapPin size={36} color={emptyIconColor} />
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: subtitleColor,
              textAlign: 'center',
            }}
          >
            No upcoming trips
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: isDark ? palette.neutral500 : palette.neutral400,
              textAlign: 'center',
            }}
          >
            Plan a multi-day adventure with the community.
          </Text>
          <Pressable
            onPress={handleCreate}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: palette.accent500,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              borderCurve: 'continuous',
              marginTop: 4,
            }}
          >
            <Plus size={16} color={palette.white} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: palette.white }}>
              Create Trip
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {trips.map((trip: TripNode, index: number) => (
            <TripCard
              key={trip.id}
              trip={trip}
              index={index}
              onPress={() => handleTripPress(trip.id)}
            />
          ))}

          {/* Create button at end */}
          <Pressable
            onPress={handleCreate}
            accessibilityRole="button"
            accessibilityLabel="Create a trip"
            style={{
              width: 80,
              borderRadius: 16,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: createBorder,
              backgroundColor: createBg,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: palette.accent500,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={18} color={palette.white} />
            </View>
            <Text
              style={{ fontSize: 11, fontWeight: '600', color: subtitleColor, textAlign: 'center' }}
            >
              Create
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </Animated.View>
  );
}
