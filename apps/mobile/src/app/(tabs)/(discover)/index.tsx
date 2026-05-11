import { palette } from '@motovault/design-system';
import {
  TemplateTripIdForRouteDocument,
  type TripTemplateFilterInput,
  TripTemplatesDocument,
  type TripTemplatesQuery,
} from '@motovault/graphql';
import {
  COUNTRY_NAMES,
  isSupportedCountry,
  SUPPORTED_COUNTRY_CODES,
  type SupportedCountryCode,
} from '@motovault/types';
import MapboxGL, { type Camera, type ShapeSource } from '@rnmapbox/maps';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Mountain,
  Plus,
  SlidersHorizontal,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BikeBanner } from '../../../components/discover/bike-banner';
import { DiscoverTripCard } from '../../../components/discover/discover-trip-card';
import { NearYouSection } from '../../../components/discover/near-you-section';
import { DraftTripStrip } from '../../../components/discover/planner/draft-trip-strip';
import { TypeaheadSearch } from '../../../components/discover/typeahead-search';
import { WeatherStrip } from '../../../components/discover/weather-strip';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useEditorialTheme } from '../../../theme/editorial';
import { getDefaultMapStyle, MAP_STYLES } from '../../../utils/map-styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as typeof FlatList;

// --- Types ---

type TripNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

// No flag constants needed — chips display the country code directly.

// --- Filter chip definitions ---

const SURFACE_CHIPS = [
  { key: 'paved', i18nKey: 'discoverFilters.surfacePaved', Icon: null },
  { key: 'mixed', i18nKey: 'discoverFilters.surfaceMixed', Icon: SlidersHorizontal },
  { key: 'off-road', i18nKey: 'discoverFilters.surfaceOffRoad', Icon: Mountain },
] as const;

const DIFFICULTY_CHIPS = [
  { key: 'easy', i18nKey: 'discoverFilters.difficultyEasy' },
  { key: 'moderate', i18nKey: 'discoverFilters.difficultyModerate' },
  { key: 'challenging', i18nKey: 'discoverFilters.difficultyChallenging' },
  { key: 'expert', i18nKey: 'discoverFilters.difficultyExpert' },
] as const;

type SurfaceKey = (typeof SURFACE_CHIPS)[number]['key'];
type DifficultyKey = (typeof DIFFICULTY_CHIPS)[number]['key'];

// --- Country chip strip ---

const CountryChipStrip = memo(function CountryChipStrip({
  activeCode,
  onToggle,
}: {
  activeCode: SupportedCountryCode | null;
  onToggle: (code: SupportedCountryCode) => void;
}) {
  const { t } = useEditorialTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6 }}
    >
      {SUPPORTED_COUNTRY_CODES.map((code) => {
        const active = activeCode === code;
        return (
          <Pressable
            key={code}
            onPress={() => onToggle(code)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: active ? t.ink : t.surface,
              borderWidth: 1,
              borderColor: active ? t.ink : t.line,
            }}
          >
            <View
              style={{
                width: 22,
                height: 16,
                borderRadius: 3,
                backgroundColor: active ? t.bg : t.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: '800',
                  color: active ? t.ink : t.ink3,
                  letterSpacing: 0.5,
                }}
              >
                {code}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: active ? '600' : '500',
                color: active ? t.bg : t.ink2,
              }}
            >
              {COUNTRY_NAMES[code]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

// --- Filter chip strip ---

const FilterChipStrip = memo(function FilterChipStrip({
  activeSurface,
  activeDifficulty,
  onToggleSurface,
  onToggleDifficulty,
}: {
  activeSurface: SurfaceKey | null;
  activeDifficulty: DifficultyKey | null;
  onToggleSurface: (key: SurfaceKey) => void;
  onToggleDifficulty: (key: DifficultyKey) => void;
}) {
  const { t } = useEditorialTheme();
  const { t: i18n } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingRight: 16 }}
    >
      {/* Surface chips */}
      {SURFACE_CHIPS.map((chip) => {
        const active = activeSurface === chip.key;
        const ChipIcon = chip.Icon;
        return (
          <Pressable
            key={chip.key}
            onPress={() => onToggleSurface(chip.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 13,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? t.warm : t.surface,
              borderWidth: 1,
              borderColor: active ? t.warm : t.line,
            }}
          >
            {ChipIcon && <ChipIcon size={13} color={active ? t.bg : t.ink2} />}
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: active ? t.bg : t.ink2,
              }}
            >
              {i18n(chip.i18nKey)}
            </Text>
          </Pressable>
        );
      })}
      {/* Divider */}
      <View style={{ width: 1, height: 24, backgroundColor: t.line, alignSelf: 'center' }} />
      {/* Difficulty chips */}
      {DIFFICULTY_CHIPS.map((chip) => {
        const active = activeDifficulty === chip.key;
        return (
          <Pressable
            key={chip.key}
            onPress={() => onToggleDifficulty(chip.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 13,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? t.warm : t.surface,
              borderWidth: 1,
              borderColor: active ? t.warm : t.line,
            }}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: active ? t.bg : t.ink2,
              }}
            >
              {i18n(chip.i18nKey)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

// --- Section heading ---

type SortOption = 'popular' | 'rating' | 'newest' | 'distance';

const SORT_OPTIONS = [
  { key: 'popular', i18nKey: 'discoverFilters.sortMostPopular' },
  { key: 'rating', i18nKey: 'discoverFilters.sortHighestRated' },
  { key: 'newest', i18nKey: 'discoverFilters.sortNewest' },
  { key: 'distance', i18nKey: 'discoverFilters.sortShortest' },
] as const;

const SectionHeading = memo(function SectionHeading({
  activeSurface,
  activeDifficulty,
  countryCode,
  totalCount,
  hasMore,
  sortBy,
  onSortChange,
}: {
  activeSurface: SurfaceKey | null;
  activeDifficulty: DifficultyKey | null;
  countryCode: SupportedCountryCode | null;
  totalCount: number;
  hasMore: boolean;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}) {
  const { t } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const parts: string[] = [];
  if (activeSurface) {
    const chip = SURFACE_CHIPS.find((c) => c.key === activeSurface);
    if (chip) parts.push(i18n(chip.i18nKey));
  }
  if (activeDifficulty) {
    const chip = DIFFICULTY_CHIPS.find((c) => c.key === activeDifficulty);
    if (chip) parts.push(i18n(chip.i18nKey));
  }
  const filterLabel = parts.length > 0 ? parts.join(' · ') : i18n('discoverFilters.allRoutes');
  const countryLabel = countryCode ? COUNTRY_NAMES[countryCode] : null;
  const sortOption = SORT_OPTIONS.find((o) => o.key === sortBy);
  const currentSortLabel = sortOption ? i18n(sortOption.i18nKey) : '';

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingTop: 8,
        paddingBottom: 4,
      }}
    >
      <View>
        <Text
          style={{
            fontFamily: 'GeistMono',
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: t.ink3,
            fontWeight: '600',
            marginBottom: 4,
          }}
        >
          {filterLabel}
          {countryLabel ? ` · ${countryLabel}` : ''}
        </Text>
        <Text
          style={{
            fontFamily: 'InstrumentSerif',
            fontSize: 22,
            color: t.ink,
            letterSpacing: -0.5,
            lineHeight: 26,
          }}
        >
          {i18n(hasMore ? 'discoverFilters.routesFound_other' : 'discoverFilters.routesFound_one', {
            count: totalCount,
          })}{' '}
          <Text style={{ fontStyle: 'italic', color: t.ink3, fontSize: 17 }}>
            {i18n('discoverFilters.found')}
          </Text>
        </Text>
      </View>
      <View style={{ position: 'relative' }}>
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios')
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowSortMenu((prev) => !prev);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingBottom: 2,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: showSortMenu ? t.surface2 : 'transparent',
          }}
        >
          <SlidersHorizontal size={12} color={showSortMenu ? t.ink : t.ink3} />
          <Text
            style={{
              fontFamily: 'GeistMono',
              fontSize: 11,
              color: showSortMenu ? t.ink : t.ink3,
              fontWeight: '500',
              letterSpacing: 0.4,
            }}
          >
            {currentSortLabel}
          </Text>
        </Pressable>
        {showSortMenu && (
          <View
            style={{
              position: 'absolute',
              top: 30,
              right: 0,
              backgroundColor: t.surface,
              borderRadius: 12,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: t.line,
              padding: 4,
              zIndex: 100,
              minWidth: 160,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => {
                  onSortChange(option.key);
                  setShowSortMenu(false);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: sortBy === option.key ? t.surface2 : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: sortBy === option.key ? '600' : '500',
                    color: sortBy === option.key ? t.ink : t.ink2,
                  }}
                >
                  {i18n(option.i18nKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

// --- Header component ---

interface DiscoverHeaderProps {
  activeSurface: SurfaceKey | null;
  activeDifficulty: DifficultyKey | null;
  countryCode: SupportedCountryCode | null;
  totalCount: number;
  hasMore: boolean;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  onToggleSurface: (key: SurfaceKey) => void;
  onToggleDifficulty: (key: DifficultyKey) => void;
  onToggleCountry: (code: SupportedCountryCode) => void;
  onRouteSearchSelect: (routeId: string) => void | Promise<void>;
  onPlaceSearchSelect: (countryCode: string, regionCode?: string) => void;
  onTripPress: (tripId: string) => void;
  showBelowFold: boolean;
}

const DiscoverHeader = memo(function DiscoverHeader({
  activeSurface,
  activeDifficulty,
  countryCode,
  totalCount,
  hasMore,
  sortBy,
  onSortChange,
  onToggleSurface,
  onToggleDifficulty,
  onToggleCountry,
  onRouteSearchSelect,
  onPlaceSearchSelect,
  onTripPress,
  showBelowFold,
}: DiscoverHeaderProps) {
  const handleViewAllNearYou = useCallback(
    (cc: SupportedCountryCode) => onToggleCountry(cc),
    [onToggleCountry],
  );

  const hasActiveFilter = !!(activeSurface || activeDifficulty);

  return (
    <View style={{ gap: 12, paddingTop: 14 }}>
      {/* Search */}
      <TypeaheadSearch onRouteSelect={onRouteSearchSelect} onPlaceSelect={onPlaceSearchSelect} />

      {/* Routes near you — auto-detected country */}
      {!countryCode && !hasActiveFilter && (
        <NearYouSection onTripPress={onTripPress} onViewAll={handleViewAllNearYou} />
      )}

      {/* Country chips */}
      <CountryChipStrip activeCode={countryCode} onToggle={onToggleCountry} />

      {/* Filter chips */}
      <FilterChipStrip
        activeSurface={activeSurface}
        activeDifficulty={activeDifficulty}
        onToggleSurface={onToggleSurface}
        onToggleDifficulty={onToggleDifficulty}
      />

      {showBelowFold && (
        <>
          {/* Bike banner + weather */}
          <View style={{ gap: 10 }}>
            <BikeBanner />
            <WeatherStrip />
          </View>

          {/* Drafts */}
          <DraftTripStrip />
        </>
      )}

      {/* Section heading */}
      <SectionHeading
        activeSurface={activeSurface}
        activeDifficulty={activeDifficulty}
        countryCode={countryCode}
        totalCount={totalCount}
        hasMore={hasMore}
        sortBy={sortBy}
        onSortChange={onSortChange}
      />
    </View>
  );
});

// --- Main screen ---

export default function DiscoverScreen() {
  const { t: i18n } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<Camera>(null);
  const shapeSourceRef = useRef<ShapeSource>(null);
  const reducedMotion = useReducedMotion();
  const [mapStyle] = useState(() => getDefaultMapStyle(isDark));

  // Map collapse state
  const [mapExpanded, setMapExpanded] = useState(true);

  // Deferred rendering for below-fold sections
  const [showBelowFold, setShowBelowFold] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShowBelowFold(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    trackEvent(AnalyticsEvent.DISCOVER_TAB_VIEWED);
  }, []);

  // --- Filter state ---
  const [surfaceFilter, setSurfaceFilter] = useState<SurfaceKey | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyKey | null>(null);
  const [countryCode, setCountryCode] = useState<SupportedCountryCode | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('popular');

  // --- Data fetching ---

  const tripFilterInput = useMemo((): TripTemplateFilterInput | null => {
    const filter: TripTemplateFilterInput = {};
    let hasFilter = false;
    if (countryCode) {
      filter.country = countryCode.toLowerCase();
      hasFilter = true;
    }
    if (surfaceFilter === 'paved') {
      filter.surfaceType = 'paved';
      hasFilter = true;
    }
    if (surfaceFilter === 'mixed') {
      filter.surfaceType = 'mixed';
      hasFilter = true;
    }
    if (surfaceFilter === 'off-road') {
      filter.surfaceType = 'off_road';
      hasFilter = true;
    }
    if (difficultyFilter) {
      filter.difficulty = difficultyFilter;
      hasFilter = true;
    }
    return hasFilter ? filter : null;
  }, [countryCode, surfaceFilter, difficultyFilter]);

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

  const hasMoreTrips = tripData?.pages?.at(-1)?.tripTemplates?.pageInfo?.hasNextPage ?? false;

  const allTrips = useMemo(() => {
    if (!tripData?.pages) return [];
    const trips = tripData.pages.flatMap((p) => p?.tripTemplates?.edges?.map((e) => e.node) ?? []);
    if (sortBy === 'rating') {
      return [...trips].sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
    }
    if (sortBy === 'newest') {
      return [...trips].sort(
        (a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
      );
    }
    if (sortBy === 'distance') {
      return [...trips].sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
    }
    return trips; // 'popular' — default API order
  }, [tripData, sortBy]);

  // --- GeoJSON for map pins ---

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

  const handleTripPress = useCallback(
    (tripId: string) => {
      router.push({ pathname: '/(modals)/trip-detail', params: { tripId } });
    },
    [router],
  );

  const handleMapPinPress = useCallback(
    async (e: { features?: GeoJSON.Feature[] }) => {
      const feature = e.features?.[0];
      if (!feature?.properties) return;
      const cluster = feature.properties.cluster;
      const isCluster = cluster === true || cluster === 1 || cluster === 'true' || cluster === '1';
      if (isCluster && shapeSourceRef.current) {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        try {
          const zoom = await shapeSourceRef.current.getClusterExpansionZoom(feature);
          const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
          cameraRef.current?.setCamera({
            centerCoordinate: [lng, lat],
            zoomLevel: Math.min(zoom, 20),
            animationDuration: 250,
            animationMode: 'flyTo',
          });
        } catch {
          // cluster expansion not available
        }
        return;
      }
      if (process.env.EXPO_OS === 'ios') {
        Haptics.selectionAsync();
      }
      const tripId = String(feature.properties.id ?? '');
      if (tripId) {
        handleTripPress(tripId);
      }
    },
    [handleTripPress],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextTrips && !isFetchingNextTrips) fetchNextTrips();
  }, [hasNextTrips, isFetchingNextTrips, fetchNextTrips]);

  const toggleSurface = useCallback((key: SurfaceKey) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSurfaceFilter((prev) => {
      const next = prev === key ? null : key;
      trackEvent(AnalyticsEvent.DISCOVER_FILTER_APPLIED, {
        filter: `surface:${key}`,
        action: next ? 'applied' : 'removed',
      });
      return next;
    });
  }, []);

  const toggleDifficulty = useCallback((key: DifficultyKey) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDifficultyFilter((prev) => {
      const next = prev === key ? null : key;
      trackEvent(AnalyticsEvent.DISCOVER_FILTER_APPLIED, {
        filter: `difficulty:${key}`,
        action: next ? 'applied' : 'removed',
      });
      return next;
    });
  }, []);

  const toggleCountry = useCallback((key: SupportedCountryCode) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCountryCode((prev) => {
      const next = prev === key ? null : key;
      trackEvent(AnalyticsEvent.DISCOVER_FILTER_APPLIED, {
        filter: 'country',
        country: key,
        action: next ? 'applied' : 'removed',
      });
      return next;
    });
  }, []);

  // --- Scroll animation ---

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const expandedMapH = 240;
  const collapsedMapH = insets.top + 52;

  const mapHeightStyle = useAnimatedStyle(() => ({
    height: mapExpanded
      ? interpolate(scrollY.value, [0, 120], [expandedMapH, expandedMapH - 60], Extrapolation.CLAMP)
      : collapsedMapH,
  }));

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const handleCreatePress = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(modals)/create-trip');
  }, [router]);

  const hasActiveFilter = !!(surfaceFilter || difficultyFilter);
  const renderTripItem = useCallback(
    ({ item, index }: { item: TripNode; index: number }) => (
      <DiscoverTripCard
        trip={item}
        index={index}
        large={index === 0 && !hasActiveFilter}
        onPress={() => handleTripPress(item.id)}
      />
    ),
    [handleTripPress, hasActiveFilter],
  );

  const handleRouteSearchSelect = useCallback(
    async (routeId: string) => {
      try {
        const { templateTripIdForRoute: tripId } = await gqlFetcher(
          TemplateTripIdForRouteDocument,
          { routeId },
        );
        if (!tripId) {
          Alert.alert(
            i18n('discoverSearch.notAvailableTitle'),
            i18n('discoverSearch.notAvailableMessage'),
          );
          return;
        }
        router.push({ pathname: '/(modals)/trip-detail', params: { tripId } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : i18n('discoverSearch.connectionError');
        Alert.alert(i18n('discoverSearch.couldNotOpenTitle'), msg);
      }
    },
    [router, i18n],
  );

  const handlePlaceSearchSelect = useCallback((cc: string, _regionCode?: string) => {
    const upper = cc?.trim().toUpperCase() ?? '';
    if (!isSupportedCountry(upper)) return;
    setCountryCode(upper);
  }, []);

  const handleToggleMap = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMapExpanded((prev) => !prev);
  }, []);

  const handleSortChange = useCallback((sort: SortOption) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortBy(sort);
  }, []);

  const headerComponent = useMemo(
    () => (
      <DiscoverHeader
        activeSurface={surfaceFilter}
        activeDifficulty={difficultyFilter}
        countryCode={countryCode}
        totalCount={allTrips.length}
        hasMore={hasMoreTrips}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        onToggleSurface={toggleSurface}
        onToggleDifficulty={toggleDifficulty}
        onToggleCountry={toggleCountry}
        onRouteSearchSelect={handleRouteSearchSelect}
        onPlaceSearchSelect={handlePlaceSearchSelect}
        onTripPress={handleTripPress}
        showBelowFold={showBelowFold}
      />
    ),
    [
      surfaceFilter,
      difficultyFilter,
      countryCode,
      allTrips.length,
      hasMoreTrips,
      sortBy,
      handleSortChange,
      toggleSurface,
      toggleDifficulty,
      toggleCountry,
      handleRouteSearchSelect,
      handlePlaceSearchSelect,
      handleTripPress,
      showBelowFold,
    ],
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Collapsible map area */}
      <View style={{ position: 'relative' }}>
        <Animated.View style={[{ overflow: 'hidden' }, mapHeightStyle]}>
          {mapExpanded && (
            <MapboxGL.MapView
              style={{ flex: 1 }}
              styleURL={MAP_STYLES[mapStyle]}
              compassEnabled={false}
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
            >
              <MapboxGL.Camera
                ref={cameraRef}
                defaultSettings={{
                  centerCoordinate: [12.4964, 41.9028],
                  zoomLevel: 4,
                }}
              />

              {routeGeoJSON.features.length > 0 && (
                <MapboxGL.ShapeSource
                  ref={shapeSourceRef}
                  id="route-pins"
                  shape={routeGeoJSON}
                  cluster
                  clusterRadius={50}
                  clusterMaxZoomLevel={14}
                  onPress={handleMapPinPress}
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
          )}

          {/* Collapsed background when map is hidden */}
          {!mapExpanded && <View style={{ flex: 1, backgroundColor: t.bg2 }} />}

          {/* Top gradient */}
          <LinearGradient
            colors={[t.bg, 'transparent']}
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90 }}
          />

          {/* Bottom gradient */}
          {mapExpanded && (
            <LinearGradient
              colors={['transparent', t.bg]}
              pointerEvents="none"
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }}
            />
          )}
        </Animated.View>

        {/* Header overlay: outside animated view so it's never clipped */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            right: 16,
            zIndex: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'InstrumentSerif',
              fontSize: mapExpanded ? 26 : 22,
              color: t.ink,
              letterSpacing: -0.5,
              lineHeight: 30,
            }}
          >
            Discover
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {mapExpanded && (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 11,
                    color: t.ink3,
                    fontWeight: '500',
                  }}
                >
                  {i18n('discoverFilters.routesNearby', {
                    count: allTrips.filter((r) => r.startLat != null).length,
                  })}
                </Text>
              </View>
            )}
            <Pressable
              onPress={handleToggleMap}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {mapExpanded ? (
                <ChevronUp size={16} color={t.ink} />
              ) : (
                <ChevronDown size={16} color={t.ink} />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Trip list */}
      <AnimatedFlatList
        data={allTrips}
        renderItem={renderTripItem}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
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
                  backgroundColor: t.surface,
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
                  color: t.ink,
                  textAlign: 'center',
                  letterSpacing: -0.3,
                }}
              >
                {i18n('discoverFilters.noRoutesMatch')}
              </Text>
              <Pressable
                onPress={() => {
                  setSurfaceFilter(null);
                  setDifficultyFilter(null);
                  setCountryCode(null);
                }}
                style={{
                  marginTop: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: t.surface2,
                  borderWidth: 1,
                  borderColor: t.line,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: t.ink }}>
                  {i18n('discoverFilters.clearFilters')}
                </Text>
              </Pressable>
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

      {/* Plan Trip FAB */}
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
            gap: 9,
            height: 52,
            paddingRight: 18,
            paddingLeft: 14,
            borderRadius: 26,
            borderCurve: 'continuous',
            backgroundColor: palette.accent500,
            shadowColor: palette.accent500,
            shadowOpacity: 0.4,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          },
          fabStyle,
        ]}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={16} color={palette.white} strokeWidth={2.4} />
        </View>
        <Text
          style={{ fontSize: 14, fontWeight: '600', color: palette.white, letterSpacing: -0.1 }}
        >
          {i18n('discoverFilters.planTrip')}
        </Text>
      </AnimatedPressable>
    </View>
  );
}
