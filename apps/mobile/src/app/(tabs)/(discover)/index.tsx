import { palette } from '@motovault/design-system';
import { DiscoverRoutesDocument, type DiscoverRoutesQuery } from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupRideSection } from '../../../components/discover/group-ride-section';
import { RouteCard } from '../../../components/discover/route-card';
import { TripSection } from '../../../components/discover/trip-section';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { MAP_STYLES, type MapStyle } from '../../../utils/map-styles';

type RouteNode = DiscoverRoutesQuery['discoverRoutes']['edges'][number]['node'];

export default function DiscoverScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mapStyle] = useState<MapStyle>('dark');
  const mapRef = useRef<MapboxGL.MapView>(null);

  const bg = isDark ? palette.neutral950 : palette.white;
  const headerColor = isDark ? palette.white : palette.neutral950;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: [...queryKeys.routes.all],
    queryFn: ({ pageParam }) =>
      gqlFetcher(DiscoverRoutesDocument, {
        first: 20,
        after: pageParam ?? null,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      const pi = lastPage.discoverRoutes.pageInfo;
      return pi.hasNextPage ? (pi.endCursor ?? undefined) : undefined;
    },
  });

  const routes = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.discoverRoutes.edges.map((e) => e.node));
  }, [data]);

  // Build GeoJSON from route start points for map pins
  const geojson = useMemo(() => {
    const features = routes
      .filter((r) => r.startLat != null && r.startLng != null)
      .map((r) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [r.startLng ?? 0, r.startLat ?? 0],
        },
        properties: { id: r.id, name: r.name ?? 'Route' },
      }));
    return { type: 'FeatureCollection' as const, features };
  }, [routes]);

  const handleRoutePress = useCallback(
    (routeId: string) => {
      router.push({ pathname: '/(modals)/route-detail', params: { routeId } });
    },
    [router],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: RouteNode; index: number }) => (
      <RouteCard route={item} index={index} onPress={() => handleRoutePress(item.id)} />
    ),
    [handleRoutePress],
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Map */}
      <View style={{ height: 280, position: 'relative' }}>
        <MapboxGL.MapView
          ref={mapRef}
          style={{ flex: 1 }}
          styleURL={MAP_STYLES[mapStyle]}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
        >
          <MapboxGL.Camera
            defaultSettings={{
              centerCoordinate: [-98.5795, 39.8283], // Center of US
              zoomLevel: 3,
            }}
          />

          {/* Route pins */}
          {geojson.features.length > 0 && (
            <MapboxGL.ShapeSource
              id="route-pins"
              shape={geojson}
              cluster
              clusterRadius={50}
              clusterMaxZoomLevel={14}
            >
              {/* Clustered pins */}
              <MapboxGL.CircleLayer
                id="cluster-circles"
                filter={['has', 'point_count']}
                style={{
                  circleColor: palette.accent500,
                  circleRadius: ['step', ['get', 'point_count'], 18, 10, 24, 50, 32],
                  circleOpacity: 0.85,
                }}
              />
              <MapboxGL.SymbolLayer
                id="cluster-count"
                filter={['has', 'point_count']}
                style={{
                  textField: ['get', 'point_count_abbreviated'],
                  textSize: 13,
                  textColor: palette.white,
                  textFont: ['DIN Pro Medium'],
                }}
              />

              {/* Individual pins */}
              <MapboxGL.CircleLayer
                id="route-dots"
                filter={['!', ['has', 'point_count']]}
                style={{
                  circleColor: palette.accent500,
                  circleRadius: 8,
                  circleStrokeColor: palette.white,
                  circleStrokeWidth: 2,
                }}
              />
            </MapboxGL.ShapeSource>
          )}
        </MapboxGL.MapView>

        {/* Gradient overlay at bottom of map */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            backgroundColor: bg,
            opacity: 0.8,
          }}
        />

        {/* Header overlay */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            right: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Compass size={22} color={palette.accent500} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: palette.white }}>Discover</Text>
          </View>
        </Animated.View>
      </View>

      {/* Route list */}
      <FlatList
        data={routes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 80 }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <GroupRideSection />
            <TripSection />
            <View style={{ paddingVertical: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: headerColor }}>
                Routes{routes.length > 0 ? ` (${routes.length})` : ''}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator
              size="large"
              color={palette.accent500}
              style={{ paddingVertical: 40 }}
            />
          ) : (
            <Animated.View
              entering={FadeInUp.duration(300)}
              style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}
            >
              <Compass size={48} color={isDark ? palette.neutral600 : palette.neutral300} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: isDark ? palette.neutral400 : palette.neutral500,
                  textAlign: 'center',
                }}
              >
                No routes yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: isDark ? palette.neutral500 : palette.neutral400,
                  textAlign: 'center',
                  paddingHorizontal: 32,
                }}
              >
                Complete a ride and share it to Discover to see it here.
              </Text>
            </Animated.View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator
              size="small"
              color={palette.accent500}
              style={{ paddingVertical: 16 }}
            />
          ) : null
        }
      />
    </View>
  );
}
