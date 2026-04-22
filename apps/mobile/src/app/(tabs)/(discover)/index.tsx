import { palette } from '@motovault/design-system';
import {
  type TripTemplateFilterInput,
  TripTemplatesDocument,
  type TripTemplatesQuery,
} from '@motovault/graphql';
import {
  COUNTRY_NAMES,
  SUPPORTED_COUNTRY_CODES,
  type SupportedCountryCode,
} from '@motovault/types';
import MapboxGL from '@rnmapbox/maps';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Award,
  Compass,
  Plus,
  Star,
  TrendingUp,
  Wind,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  Text,
  useColorScheme,
  View,
} from 'react-native';
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
import { DiscoverTripCard } from '../../../components/discover/discover-trip-card';
import { FilterChipRow } from '../../../components/discover/filter-chip-row';
import { TripSection } from '../../../components/discover/trip-section';
import { TypeaheadSearch } from '../../../components/discover/typeahead-search';
import { useInspirationFilters } from '../../../hooks/use-inspiration-filters';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { getDefaultMapStyle, MAP_STYLES } from '../../../utils/map-styles';

// --- Types ---

type TripNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

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
  showBelowFold: boolean;
}

const DiscoverHeader = memo(function DiscoverHeader({
  filters,
  onToggleChip,
  onToggleCountry,
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
      <TypeaheadSearch />

      {/* Filter chips */}
      <FilterChipRow
        chips={FILTER_CHIPS}
        activeKeys={filters.chips}
        onToggle={onToggleChip}
        accessibilityGroupLabel="Trip filters"
      />

      {/* Below-fold content — deferred by one frame for faster first paint */}
      {showBelowFold && (
        <>
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
            ? `Trips in ${COUNTRY_NAMES[filters.countryCode]}`
            : filters.chips.size > 0
              ? 'Filtered trips'
              : 'Trip templates'}
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

  // Progressive unlock of below-fold queries. The main infinite list and
  // SavedRoutes (inspiration seed) fire immediately; each 150 ms tick unlocks
  // one carousel so cold-start doesn't burst 5–6 GraphQL RTTs in parallel.
  // Stage map: 1 = Editor's Picks, 2 = Weekend, 3 = Seasonal + Because-you-liked.
  const [fetchStage, setFetchStage] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setFetchStage((s) => {
        if (s >= 3) {
          clearInterval(id);
          return s;
        }
        return s + 1;
      });
    }, 150);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    trackEvent(AnalyticsEvent.DISCOVER_TAB_VIEWED);
  }, []);

  const inspiration = useInspirationFilters();
  const bg = isDark ? palette.neutral950 : palette.white;

  // --- Consolidated filter state ---
  const [filters, setFilters] = useState<DiscoverFilters>({
    chips: new Set(),
    countryCode: null,
  });

  // --- Data fetching (trips) ---

  const tripFilterInput = useMemo((): TripTemplateFilterInput | null => {
    const filter: TripTemplateFilterInput = {};
    let hasFilter = false;
    if (filters.countryCode) {
      filter.country = filters.countryCode.toLowerCase();
      hasFilter = true;
    }
    if (filters.chips.has('paved')) {
      filter.surfaceType = 'paved';
      hasFilter = true;
    }
    if (filters.chips.has('mixed')) {
      filter.surfaceType = 'mixed';
      hasFilter = true;
    }
    if (filters.chips.has('off-road')) {
      filter.surfaceType = 'off_road';
      hasFilter = true;
    }
    return hasFilter ? filter : null;
  }, [filters]);

  const tripFilterKey = useMemo(() => JSON.stringify(tripFilterInput ?? {}), [tripFilterInput]);

  const {
    data: tripData,
    isLoading: tripsLoading,
    fetchNextPage: fetchNextTrips,
    hasNextPage: hasNextTrips,
    isFetchingNextPage: isFetchingNextTrips,
  } = useInfiniteQuery({
    queryKey: queryKeys.tripTemplates.list(tripFilterKey),
    queryFn: ({ pageParam }) =>
      gqlFetcher(TripTemplatesDocument, {
        filter: tripFilterInput,
        first: 20,
        after: pageParam ?? null,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      const pi = lastPage?.tripTemplates?.pageInfo;
      return pi?.hasNextPage ? (pi.endCursor ?? undefined) : undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  const allTrips = useMemo(() => {
    if (!tripData?.pages) return [];
    return tripData.pages.flatMap((p) => p?.tripTemplates?.edges?.map((e) => e.node) ?? []);
  }, [tripData]);


  // --- GeoJSON for map pins (use trips data for pins) ---

  const routeGeoJSON = useMemo(() => {
    const features = allTrips
      .filter((r) => r.startLat != null && r.startLng != null)
      .map((r) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [r.startLng ?? 0, r.startLat ?? 0],
        },
        properties: { id: r.id, name: r.title, kind: 'trip' },
      }));
    return { type: 'FeatureCollection' as const, features };
  }, [allTrips]);

  // --- Callbacks ---

  const handleRoutePress = useCallback(
    (routeId: string) => {
      router.push({ pathname: '/(modals)/route-detail', params: { routeId } });
    },
    [router],
  );

  const handleTripPress = useCallback(
    (tripId: string) => {
      router.push({ pathname: '/(modals)/trip-detail', params: { tripId } });
    },
    [router],
  );

  const handleMarkerPress = useCallback(
    (routeId: string, routeName: string, lat: number, lng: number) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.selectionAsync();
      }
      const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const open = () => handleRoutePress(routeId);
      const copy = async () => {
        await Clipboard.setStringAsync(coords);
      };

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: routeName,
            message: coords,
            options: ['View details', 'Copy coordinates', 'Cancel'],
            cancelButtonIndex: 2,
          },
          (idx) => {
            if (idx === 0) open();
            else if (idx === 1) copy();
          },
        );
      } else {
        Alert.alert(routeName, coords, [
          { text: 'View details', onPress: open },
          { text: 'Copy coordinates', onPress: copy },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    },
    [handleRoutePress],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextTrips && !isFetchingNextTrips) fetchNextTrips();
  }, [hasNextTrips, isFetchingNextTrips, fetchNextTrips]);

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
      const wasActive = next.has(key);
      if (wasActive) {
        next.delete(key);
      } else {
        next.add(key);
      }
      trackEvent(AnalyticsEvent.DISCOVER_FILTER_APPLIED, {
        filter: key,
        action: wasActive ? 'removed' : 'applied',
        active_filters: [...next],
      });
      return { ...prev, chips: next };
    });
  }, []);

  const toggleCountry = useCallback((key: SupportedCountryCode) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilters((prev) => {
      const wasActive = prev.countryCode === key;
      trackEvent(AnalyticsEvent.DISCOVER_FILTER_APPLIED, {
        filter: 'country',
        country: key,
        action: wasActive ? 'removed' : 'applied',
      });
      return {
        ...prev,
        countryCode: wasActive ? null : key,
      };
    });
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

  const renderTripItem = useCallback(
    ({ item, index }: { item: TripNode; index: number }) => (
      <DiscoverTripCard trip={item} index={index} onPress={() => handleTripPress(item.id)} />
    ),
    [handleTripPress],
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
        fetchStage={fetchStage}
        inspiration={inspiration}
      />
    ),
    [
      filters,
      toggleChip,
      toggleCountry,
      featuredRoute,
      handleRoutePress,
      showBelowFold,
      fetchStage,
      inspiration,
    ],
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
                if (!feature || feature.properties?.cluster) return;
                const routeId = feature.properties?.id as string | undefined;
                const routeName = (feature.properties?.name as string | undefined) ?? 'Route';
                const coords = (feature.geometry as unknown as { coordinates?: [number, number] })
                  .coordinates;
                const [lng, lat] = coords ?? [null, null];
                if (routeId && lat != null && lng != null) {
                  handleMarkerPress(routeId, routeName, lat, lng);
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

      {/* Trip list */}
      <AnimatedFlatList
        data={allTrips}
        renderItem={renderTripItem}
        keyExtractor={(item) => item.id}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 160 }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={
          tripsLoading ? (
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
          isFetchingNextTrips ? (
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
