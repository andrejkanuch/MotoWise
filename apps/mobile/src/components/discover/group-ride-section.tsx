import { palette } from '@motovault/design-system';
import { GetGroupRidesDocument, type GetGroupRidesQuery } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { GroupRideCard } from './group-ride-card';

type GroupRideNode = GetGroupRidesQuery['getGroupRides']['edges'][number]['node'];

export function GroupRideSection() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();

  const headerColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const emptyIconColor = isDark ? palette.neutral600 : palette.neutral300;
  const createBg = isDark ? palette.cardDark : palette.white;
  const createBorder = isDark ? palette.surfaceElevated : palette.neutral200;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.groupRides.all,
    queryFn: () => gqlFetcher(GetGroupRidesDocument, { first: 10 }),
  });

  const rides = useMemo(() => {
    if (!data?.getGroupRides?.edges) return [];
    return data.getGroupRides.edges.map((e) => e.node);
  }, [data]);

  const handleRidePress = useCallback(
    (groupRideId: string) => {
      router.push({ pathname: '/(modals)/group-ride-detail', params: { groupRideId } });
    },
    [router],
  );

  const handleCreate = useCallback(() => {
    router.push('/(modals)/create-group-ride');
  }, [router]);

  return (
    <Animated.View entering={FadeInUp.duration(300)} style={{ gap: 10 }}>
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
          <Users size={18} color={palette.accent500} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: headerColor }}>
            Group Rides{rides.length > 0 ? ` (${rides.length})` : ''}
          </Text>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <ActivityIndicator size="small" color={palette.accent500} style={{ paddingVertical: 24 }} />
      ) : rides.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10, paddingHorizontal: 16 }}>
          <Users size={36} color={emptyIconColor} />
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: subtitleColor,
              textAlign: 'center',
            }}
          >
            No group rides yet
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: isDark ? palette.neutral500 : palette.neutral400,
              textAlign: 'center',
            }}
          >
            Be the first to organize a ride with the community.
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
              Create Ride
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {rides.map((ride: GroupRideNode, index: number) => (
            <GroupRideCard
              key={ride.id}
              groupRide={ride}
              index={index}
              onPress={() => handleRidePress(ride.id)}
            />
          ))}

          {/* Create button at end */}
          <Pressable
            onPress={handleCreate}
            accessibilityRole="button"
            accessibilityLabel="Create a group ride"
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
