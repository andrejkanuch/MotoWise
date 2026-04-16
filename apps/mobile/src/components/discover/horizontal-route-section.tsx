import { palette } from '@motovault/design-system';
import {
  DiscoverRoutesDocument,
  type DiscoverRoutesFilterInput,
  type DiscoverRoutesQuery,
} from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react-native';
import { memo, useCallback, useMemo } from 'react';
import { FlatList, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { usePrimaryBikeFuelData } from '../../hooks/use-primary-bike-fuel-data';
import { gqlFetcher } from '../../lib/graphql-client';
import { computeFuelStops } from '../../utils/fuel-range';
import { RouteCard } from './route-card';

type RouteNode = DiscoverRoutesQuery['discoverRoutes']['edges'][number]['node'];

const CARD_WIDTH = 280;
const CARD_GAP = 12;

interface HorizontalRouteSectionProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  queryKey: readonly unknown[];
  filter: DiscoverRoutesFilterInput;
  first?: number;
  staleTime?: number;
  onRoutePress: (routeId: string) => void;
}

export const HorizontalRouteSection = memo(function HorizontalRouteSection({
  title,
  icon: Icon,
  iconColor,
  queryKey,
  filter,
  first = 10,
  staleTime = 10 * 60 * 1000,
  onRoutePress,
}: HorizontalRouteSectionProps) {
  const isDark = useColorScheme() === 'dark';
  const headerColor = isDark ? palette.white : palette.neutral950;
  const accentColor = iconColor ?? palette.accent500;
  const { tankLiters, kmPerLiter } = usePrimaryBikeFuelData();

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      gqlFetcher(DiscoverRoutesDocument, {
        filter,
        first,
        after: null,
      }),
    staleTime,
  });

  const routes = useMemo(() => {
    if (!data?.discoverRoutes?.edges) return [];
    return data.discoverRoutes.edges.map((e) => e.node);
  }, [data]);

  const renderItem = useCallback(
    ({ item, index }: { item: RouteNode; index: number }) => (
      <View style={{ width: CARD_WIDTH }}>
        <RouteCard
          route={item}
          index={index}
          onPress={() => onRoutePress(item.id)}
          fuelStopsRequired={computeFuelStops(item.distanceM / 1000, tankLiters, kmPerLiter)}
        />
      </View>
    ),
    [onRoutePress, tankLiters, kmPerLiter],
  );

  // Hide entirely if no data and not loading
  if (!isLoading && routes.length === 0) return null;

  // Show skeleton while loading
  if (isLoading) {
    return (
      <Animated.View entering={FadeInUp.duration(200)} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon size={18} color={accentColor} />
          <Text
            style={{ fontSize: 16, fontWeight: '800', color: headerColor, letterSpacing: -0.2 }}
          >
            {title}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: CARD_GAP, paddingLeft: 0 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: CARD_WIDTH,
                height: 140,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.cardDark : palette.neutral100,
                borderWidth: 1,
                borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
              }}
            />
          ))}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(300)} style={{ gap: 10 }}>
      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon size={18} color={accentColor} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: headerColor, letterSpacing: -0.2 }}>
          {title}
        </Text>
      </View>

      {/* Horizontal card list */}
      <View
        accessibilityRole="list"
        accessibilityLabel={title}
        accessibilityHint={`Swipe left or right to see more. ${routes.length} routes`}
      >
        <FlatList
          horizontal
          data={routes}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: CARD_GAP }}
          style={{ marginHorizontal: -16 }}
          initialNumToRender={3}
          maxToRenderPerBatch={2}
          windowSize={5}
          getItemLayout={(_, index) => ({
            length: CARD_WIDTH + CARD_GAP,
            offset: 16 + (CARD_WIDTH + CARD_GAP) * index,
            index,
          })}
        />
      </View>
    </Animated.View>
  );
});
