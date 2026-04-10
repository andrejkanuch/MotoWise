import { palette } from '@motovault/design-system';
import {
  DiscoverRoutesDocument,
  type DiscoverRoutesQuery,
  GetTripsDocument,
  type GetTripsQuery,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Compass, Map as MapIcon, Plus, Users } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupRideSection } from '../../../components/discover/group-ride-section';
import { RouteCard } from '../../../components/discover/route-card';
import { TripSection } from '../../../components/discover/trip-section';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { getDefaultMapStyle, MAP_STYLES } from '../../../utils/map-styles';

type RouteNode = DiscoverRoutesQuery['discoverRoutes']['edges'][number]['node'];

export default function DiscoverScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mapStyle] = useState(() => getDefaultMapStyle(isDark));
  const mapRef = useRef<MapboxGL.MapView>(null);

  useEffect(() => {
    trackEvent(AnalyticsEvent.DISCOVER_TAB_VIEWED);
  }, []);

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

  // Fetch upcoming trips so we can plot their origins on the discovery map.
  const { data: tripsData } = useQuery({
    queryKey: queryKeys.trips.all,
    queryFn: () => gqlFetcher(GetTripsDocument, { first: 20 }),
  });

  type TripNode = GetTripsQuery['getTrips']['edges'][number]['node'];
  const trips: TripNode[] = useMemo(
    () => tripsData?.getTrips?.edges?.map((e) => e.node) ?? [],
    [tripsData],
  );

  // Build GeoJSON from route start points for map pins
  const routeGeoJSON = useMemo(() => {
    const features = routes
      .filter((r) => r.startLat != null && r.startLng != null)
      .map((r) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [r.startLng ?? 0, r.startLat ?? 0],
        },
        properties: { id: r.id, name: r.name ?? 'Route', kind: 'route' },
      }));
    return { type: 'FeatureCollection' as const, features };
  }, [routes]);

  // Plot trip starting waypoints so riders see WHERE trips are geographically.
  const tripGeoJSON = useMemo(() => {
    const features = trips
      .flatMap((t) => {
        const wps = t.waypoints ?? [];
        if (wps.length === 0) return [];
        const sorted = [...wps].sort((a, b) => a.sortOrder - b.sortOrder);
        const origin = sorted.find((w) => w.lat != null && w.lng != null);
        if (!origin) return [];
        return [
          {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [origin.lng, origin.lat],
            },
            properties: { id: t.id, title: t.title, kind: 'trip' },
          },
        ];
      });
    return { type: 'FeatureCollection' as const, features };
  }, [trips]);

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

  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // FAB press animation
  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  const handleCreatePress = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Group ride', 'Multi-day trip', 'Cancel'],
          cancelButtonIndex: 2,
          title: 'New ride',
          message: 'One-day meetup or multi-day trip?',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) router.push('/(modals)/create-group-ride');
          if (buttonIndex === 1) router.push('/(modals)/create-trip');
        },
      );
    } else {
      setShowCreateSheet(true);
    }
  }, [router]);

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

          {/* Route pins (clustered) */}
          {routeGeoJSON.features.length > 0 && (
            <MapboxGL.ShapeSource
              id="route-pins"
              shape={routeGeoJSON}
              cluster
              clusterRadius={50}
              clusterMaxZoomLevel={14}
            >
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
              <MapboxGL.CircleLayer
                id="route-dots"
                filter={['!', ['has', 'point_count']]}
                style={{
                  circleColor: palette.accent500,
                  circleRadius: 6,
                  circleStrokeColor: palette.white,
                  circleStrokeWidth: 2,
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          {/* Trip origin pins — indigo to match the "Trip" badge */}
          {tripGeoJSON.features.length > 0 && (
            <MapboxGL.ShapeSource
              id="trip-pins"
              shape={tripGeoJSON}
              onPress={(e) => {
                const feature = e.features?.[0];
                const tripId = feature?.properties?.id as string | undefined;
                if (tripId) {
                  router.push({ pathname: '/(modals)/trip-detail', params: { tripId } });
                }
              }}
            >
              <MapboxGL.CircleLayer
                id="trip-dots-halo"
                style={{
                  circleColor: palette.indigo500,
                  circleRadius: 11,
                  circleOpacity: 0.25,
                }}
              />
              <MapboxGL.CircleLayer
                id="trip-dots"
                style={{
                  circleColor: palette.indigo500,
                  circleRadius: 6,
                  circleStrokeColor: palette.white,
                  circleStrokeWidth: 2,
                }}
              />
            </MapboxGL.ShapeSource>
          )}
        </MapboxGL.MapView>

        {/* Bottom scrim — fades the map into the list background */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 48,
            backgroundColor: bg,
            opacity: 0.85,
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: palette.neutral950,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
              borderCurve: 'continuous',
              opacity: 0.78,
            }}
          >
            <Compass size={20} color={palette.accent500} />
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: palette.white,
                letterSpacing: -0.3,
              }}
            >
              Discover
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Route list */}
      <FlatList
        data={routes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 160 }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <GroupRideSection />
            <TripSection />
            <View style={{ paddingVertical: 12 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: headerColor,
                  letterSpacing: -0.2,
                }}
              >
                Roads worth riding
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
              style={{ alignItems: 'center', paddingVertical: 44, gap: 10 }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  borderCurve: 'continuous',
                  backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Compass size={30} color={palette.accent500} />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: isDark ? palette.white : palette.neutral950,
                  textAlign: 'center',
                  letterSpacing: -0.3,
                }}
              >
                Put this region on the map
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  color: isDark ? palette.neutral400 : palette.neutral500,
                  textAlign: 'center',
                  paddingHorizontal: 32,
                }}
              >
                Be the first to drop a road here. Every one you pin helps the next rider find it.
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

      {/* FAB */}
      <AnimatedPressable
        onPress={handleCreatePress}
        onPressIn={() => {
          fabScale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
        }}
        onPressOut={() => {
          fabScale.value = withTiming(1, { duration: 200 });
        }}
        accessibilityRole="button"
        accessibilityLabel="Plan a new ride"
        style={[
          {
            position: 'absolute',
            bottom: insets.bottom + 88,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            borderCurve: 'continuous',
            backgroundColor: palette.accent500,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: palette.neutral950,
            shadowOpacity: 0.28,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          },
          fabStyle,
        ]}
      >
        <Plus size={24} color={palette.white} />
      </AnimatedPressable>

      {/* Android create sheet */}
      {showCreateSheet && Platform.OS !== 'ios' && (
        <Pressable
          onPress={() => setShowCreateSheet(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: palette.neutral950,
            opacity: 0.5,
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: isDark ? palette.neutral900 : palette.white,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderCurve: 'continuous',
              paddingTop: 20,
              paddingBottom: insets.bottom + 16,
              paddingHorizontal: 20,
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: headerColor,
                letterSpacing: -0.3,
                marginBottom: 4,
              }}
            >
              New ride
            </Text>

            <Pressable
              onPress={() => {
                setShowCreateSheet(false);
                router.push('/(modals)/create-group-ride');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: palette.signature500,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={20} color={palette.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: headerColor }}>
                  Group ride
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: isDark ? palette.neutral400 : palette.neutral500,
                  }}
                >
                  One meetup point, one day out
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowCreateSheet(false);
                router.push('/(modals)/create-trip');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: palette.indigo500,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MapIcon size={20} color={palette.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: headerColor }}>
                  Multi-day trip
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: isDark ? palette.neutral400 : palette.neutral500,
                  }}
                >
                  Days on the road, stops along the way
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setShowCreateSheet(false)}
              style={{
                alignItems: 'center',
                paddingVertical: 14,
                marginTop: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: isDark ? palette.neutral400 : palette.neutral500,
                }}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </View>
  );
}
