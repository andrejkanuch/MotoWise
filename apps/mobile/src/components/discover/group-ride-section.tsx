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
  const _emptyIconColor = isDark ? palette.neutral600 : palette.neutral300;
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
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Users size={18} color={palette.accent500} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              color: headerColor,
              letterSpacing: -0.2,
            }}
          >
            Rides near you
          </Text>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <ActivityIndicator size="small" color={palette.accent500} style={{ paddingVertical: 24 }} />
      ) : rides.length === 0 ? (
        <View
          style={{
            alignItems: 'center',
            paddingVertical: 28,
            gap: 10,
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              borderCurve: 'continuous',
              backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={26} color={palette.accent500} />
          </View>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              color: headerColor,
              textAlign: 'center',
              letterSpacing: -0.3,
            }}
          >
            Nothing rolling yet
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: subtitleColor,
              textAlign: 'center',
            }}
          >
            Post a meetup and see who shows up.
          </Text>
          <Pressable
            onPress={handleCreate}
            accessibilityRole="button"
            accessibilityLabel="Start a group ride"
            accessibilityHint="Opens the group ride planner"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: palette.accent500,
              paddingHorizontal: 18,
              paddingVertical: 12,
              borderRadius: 14,
              borderCurve: 'continuous',
              marginTop: 6,
            }}
          >
            <Plus size={16} color={palette.white} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.white }}>
              Start a ride
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16 }}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 16 }}
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
            accessibilityLabel="Start a group ride"
            accessibilityHint="Opens the group ride planner"
            style={{
              width: 96,
              minHeight: 180,
              borderRadius: 16,
              borderCurve: 'continuous',
              borderWidth: 1,
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
