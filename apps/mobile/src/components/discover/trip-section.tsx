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
  const _emptyIconColor = isDark ? palette.neutral600 : palette.neutral300;
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
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} color={palette.accent500} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              color: headerColor,
              letterSpacing: -0.2,
            }}
          >
            Multi-day trips
          </Text>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <ActivityIndicator size="small" color={palette.accent500} style={{ paddingVertical: 24 }} />
      ) : trips.length === 0 ? (
        <Pressable
          onPress={handleCreate}
          accessibilityRole="button"
          accessibilityLabel="Plan a multi-day trip"
          accessibilityHint="Opens the trip planner"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 48,
            backgroundColor: isDark ? palette.cardDark : palette.white,
            borderRadius: 14,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: createBorder,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <MapPin size={18} color={palette.accent500} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: headerColor }}>
              Plan a multi-day trip
            </Text>
          </View>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: palette.accent500,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={16} color={palette.white} />
          </View>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16 }}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 16 }}
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
            accessibilityHint="Opens the trip planner"
            style={{
              width: 96,
              minHeight: 196,
              borderRadius: 18,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: createBorder,
              backgroundColor: createBg,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
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
