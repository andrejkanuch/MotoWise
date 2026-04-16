import { palette } from '@motovault/design-system';
import {
  COUNTRY_EMOJIS,
  COUNTRY_NAMES,
  type SupportedCountryCode,
  SUPPORTED_COUNTRY_CODES,
} from '@motovault/types';
import {
  DiscoverRoutesDocument,
  type DiscoverRoutesFilterInput,
  type DiscoverRoutesQuery,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Award, Compass, Plus, Star, TrendingUp, Wind } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeInUp,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as typeof FlatList;

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeaturedRouteCard } from '../../../components/discover/featured-route-card';
import { FilterChipRow } from '../../../components/discover/filter-chip-row';
import { HorizontalRouteSection } from '../../../components/discover/horizontal-route-section';
import { RouteCard } from '../../../components/discover/route-card';
import { TripSection } from '../../../components/discover/trip-section';
import { TypeaheadSearch } from '../../../components/discover/typeahead-search';
import { usePrimaryBikeFuelData } from '../../../hooks/use-primary-bike-fuel-data';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { computeFuelStops } from '../../../utils/fuel-range';
import { getDefaultMapStyle, MAP_STYLES } from '../../../utils/map-styles';

// --- Types ---

type RouteNode = DiscoverRoutesQuery['discoverRoutes']['edges'][number]['node'];

// --- Filter chip definitions ---

const FILTER_CHIPS = [
  { key: 'popular', label: 'Popular', icon: TrendingUp },
  { key: 'picks', label: 'Picks', icon: Award },
  { key: 'twisty', label: 'Twisty', icon: Wind },
  { key: 'paved', label: 'Paved' },
  { key: 'mixed', label: 'Mixed' },
  { key: 'off-road', label: 'Off-road' },
  { key: 'highly-rated', label: 'Top Rated', icon: Star },
] as const;

type FilterKey = (typeof FILTER_CHIPS)[number]['key'];

const COUNTRY_CHIPS = SUPPORTED_COUNTRY_CODES.map((code) => ({
  key: code,
  label: COUNTRY_NAMES[code],
  emoji: COUNTRY_EMOJIS[code],
}));

// --- Consolidated filter state ---

interface DiscoverFilters {
  chips: Set<FilterKey>;
  countryCode: SupportedCountryCode | null;
}

// --- Memoized header ---

interface DiscoverHeaderProps {
  filters: DiscoverFilters;
  onToggleChip: (key: FilterKey) => void;
  onToggleCountry: (key: SupportedCountryCode) => void;
  featuredRoute: RouteNode | null;
  onRoutePress: (routeId: string) => void;
  showBelowFold: boolean;
}

const DiscoverHeader = memo(function DiscoverHeader({
  filters,
  onToggleChip,
  onToggleCountry,
  featuredRoute,
  onRoutePress,
  showBelowFold,
}: DiscoverHeaderProps) {
  const isDark = useColorScheme() === 'dark';
  const headerColor = isDark ? palette.white : palette.neutral950;

  const countryActiveKeys = useMemo(
    () => (filters.countryCode ? new Set([filters.countryCode]) : new Set<SupportedCountryCode>()),
    [filters.countryCode],
  );

  return (
    <View style={{ gap: 16, paddingTop: 8 }}>
      {/* Search */}
      <TypeaheadSearch onRouteSelect={onRoutePress} />

      {/* Filter chips */}
      <FilterChipRow
        chips={FILTER_CHIPS}
        activeKeys={filters.chips}
        onToggle={onToggleChip}
        accessibilityGroupLabel="Route filters"
      />

      {/* Featured route / Road of the Week */}
      {featuredRoute && (
        <FeaturedRouteCard route={featuredRoute} onPress={() => onRoutePress(featuredRoute.id)} />
      )}

      {/* Below-fold content — deferred by one frame for faster first paint */}
      {showBelowFold && (
        <>
          {/* Editor's Picks */}
          <HorizontalRouteSection
            title="Editor's Picks"
            icon={Award}
            iconColor={palette.signature500}
            queryKey={queryKeys.routes.editorPicks}
            filter={{ motovaultPicksOnly: true, sortByRating: true }}
            first={10}
            staleTime={10 * 60 * 1000}
            onRoutePress={onRoutePress}
          />

          {/* Country chips */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: headerColor,
                letterSpacing: -0.2,
              }}
            >
              Browse by country
            </Text>
            <FilterChipRow
              chips={COUNTRY_CHIPS}
              activeKeys={countryActiveKeys}
              onToggle={onToggleCountry}
              accessibilityGroupLabel="Country filters"
            />
          </View>

          {/* Trips */}
          <TripSection />
        </>
      )}

      {/* Section divider before main list */}
      <View style={{ paddingTop: 4 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: headerColor,
            letterSpacing: -0.2,
          }}
        >
          {filters.countryCode
            ? `Routes in ${COUNTRY_NAMES[filters.countryCode]}`
            : filters.chips.size > 0
              ? 'Filtered routes'
              : 'Roads worth riding'}
        </Text>
      </View>
    </View>
  );
});

// --- Main screen ---

export default function DiscoverScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [mapStyle] = useState(() => getDefaultMapStyle(isDark));

  // Deferred rendering for below-fold sections
  const [showBelowFold, setShowBelowFold] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShowBelowFold(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    trackEvent(AnalyticsEvent.DISCOVER_TAB_VIEWED);
  }, []);

  const { tankLiters, kmPerLiter } = usePrimaryBikeFuelData();
  const bg = isDark ? palette.neutral950 : palette.white;

  // --- Consolidated filter state ---
  const [filters, setFilters] = useState<DiscoverFilters>({
    chips: new Set(),
    countryCode: null,
  });

  const filterInput = useMemo((): DiscoverRoutesFilterInput | null => {
    const filter: DiscoverRoutesFilterInput = {};
    let hasFilter = false;

    if (filters.chips.has('popular')) {
      filter.sortByRating = true;
      hasFilter = true;
    }
    if (filters.chips.has('picks')) {
      filter.motovaultPicksOnly = true;
      hasFilter = true;
    }
    if (filters.chips.has('twisty')) {
      filter.minTwistScore = 6;
      hasFilter = true;
    }
    if (filters.chips.has('paved')) {
      filter.surfaceTypes = ['paved'];
      hasFilter = true;
    }
    if (filters.chips.has('mixed')) {
      filter.surfaceTypes = ['mixed'];
      hasFilter = true;
    }
    if (filters.chips.has('off-road')) {
      filter.surfaceTypes = ['off-road'];
      hasFilter = true;
    }
    if (filters.chips.has('highly-rated')) {
      filter.highlyRatedOnly = true;
      hasFilter = true;
    }
    if (filters.countryCode) {
      filter.countryCode = filters.countryCode.toLowerCase();
      hasFilter = true;
    }
    return hasFilter ? filter : null;
  }, [filters]);

  // --- Data fetching ---

  const filterKey = useMemo(() => JSON.stringify(filterInput ?? {}), [filterInput]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: queryKeys.routes.discover(filterKey),
    queryFn: ({ pageParam }) =>
      gqlFetcher(DiscoverRoutesDocument, {
        filter: filterInput,
        first: 20,
        after: pageParam ?? null,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      const pi = lastPage.discoverRoutes.pageInfo;
      return pi.hasNextPage ? (pi.endCursor ?? undefined) : undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  const allRoutes = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.discoverRoutes.edges.map((e) => e.node));
  }, [data]);

  // Featured route: first MotoVault Pick (when no filters active)
  const featuredRoute = useMemo(() => {
    if (filters.chips.size > 0 || filters.countryCode) return null;
    return allRoutes.find((r) => r.isMotovaultPick) ?? null;
  }, [allRoutes, filters]);

  // Routes for the list (exclude featured to avoid duplication)
  const listRoutes = useMemo(() => {
    if (!featuredRoute) return allRoutes;
    return allRoutes.filter((r) => r.id !== featuredRoute.id);
  }, [allRoutes, featuredRoute]);

  // --- GeoJSON for map pins ---

  const routeGeoJSON = useMemo(() => {
    const features = allRoutes
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
  }, [allRoutes]);

  // --- Callbacks ---

  const handleRoutePress = useCallback(
    (routeId: string) => {
      router.push({ pathname: '/(modals)/route-detail', params: { routeId } });
    },
    [router],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggleChip = useCallback((key: FilterKey) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilters((prev) => {
      const next = new Set(prev.chips);
      // Surface types are mutually exclusive
      const surfaceKeys: FilterKey[] = ['paved', 'mixed', 'off-road'];
      if (surfaceKeys.includes(key)) {
        for (const sk of surfaceKeys) {
          if (sk !== key) next.delete(sk);
        }
      }
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { ...prev, chips: next };
    });
  }, []);

  const toggleCountry = useCallback((key: SupportedCountryCode) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilters((prev) => ({
      ...prev,
      countryCode: prev.countryCode === key ? null : key,
    }));
  }, []);

  // --- Scroll animation ---

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const mapHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, 160], [280, 140], Extrapolation.CLAMP),
  }));

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const handleCreatePress = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(modals)/create-trip');
  }, [router]);

  const renderItem = useCallback(
    ({ item, index }: { item: RouteNode; index: number }) => (
      <RouteCard
        route={item}
        index={index}
        onPress={() => handleRoutePress(item.id)}
        fuelStopsRequired={computeFuelStops(item.distanceM / 1000, tankLiters, kmPerLiter)}
      />
    ),
    [handleRoutePress, tankLiters, kmPerLiter],
  );

  // --- Memoized header ---

  const headerComponent = useMemo(
    () => (
      <DiscoverHeader
        filters={filters}
        onToggleChip={toggleChip}
        onToggleCountry={toggleCountry}
        featuredRoute={featuredRoute}
        onRoutePress={handleRoutePress}
        showBelowFold={showBelowFold}
      />
    ),
    [filters, toggleChip, toggleCountry, featuredRoute, handleRoutePress, showBelowFold],
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Map */}
      <Animated.View style={[{ height: 280, position: 'relative' }, mapHeightStyle]}>
        <MapboxGL.MapView
          style={{ flex: 1 }}
          styleURL={MAP_STYLES[mapStyle]}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
        >
          <MapboxGL.Camera
            defaultSettings={{
              centerCoordinate: [12.4964, 41.9028], // Rome — center of target markets
              zoomLevel: 4,
            }}
          />

          {/* Route pins (clustered) — now tappable */}
          {routeGeoJSON.features.length > 0 && (
            <MapboxGL.ShapeSource
              id="route-pins"
              shape={routeGeoJSON}
              cluster
              clusterRadius={50}
              clusterMaxZoomLevel={14}
              onPress={(e) => {
                const feature = e.features?.[0];
                const routeId = feature?.properties?.id as string | undefined;
                if (routeId && !feature?.properties?.cluster) {
                  handleRoutePress(routeId);
                }
              }}
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
        </MapboxGL.MapView>

        {/* Bottom scrim */}
        <LinearGradient
          colors={['transparent', bg]}
          pointerEvents="none"
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48 }}
        />

        {/* Header overlay */}
        <View
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
              backgroundColor: palette.surfaceOverlay,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
              borderCurve: 'continuous',
            }}
          >
            <Compass size={20} color={palette.accent500} />
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: palette.white,
                letterSpacing: -0.3,
              }}
            >
              Discover
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Route list */}
      <AnimatedFlatList
        data={listRoutes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 160 }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator
              size="large"
              color={palette.accent500}
              style={{ paddingVertical: 40 }}
            />
          ) : (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInUp.duration(300)}
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
                  fontWeight: '700',
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
        accessibilityLabel="Plan a new trip"
        accessibilityHint="Opens the multi-day trip planner"
        style={[
          {
            position: 'absolute',
            bottom: insets.bottom + 88,
            right: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            height: 48,
            paddingHorizontal: 20,
            borderRadius: 24,
            borderCurve: 'continuous',
            backgroundColor: palette.accent500,
            shadowColor: palette.neutral950,
            shadowOpacity: 0.28,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          },
          fabStyle,
        ]}
      >
        <Plus size={20} color={palette.white} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>Plan Trip</Text>
      </AnimatedPressable>
    </View>
  );
}
