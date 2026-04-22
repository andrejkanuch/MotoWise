import { palette } from '@motovault/design-system';
import { SearchTypeaheadDocument, type SearchTypeaheadQuery } from '@motovault/graphql';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Globe, MapPin, Route, Search, X } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, TextInput, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';

interface TypeaheadSearchProps {
  onRouteSelect: (routeId: string) => void;
  onPlaceSelect?: (countryCode: string, regionCode?: string) => void;
}

type RouteResult = SearchTypeaheadQuery['searchTypeahead']['routes'][number];
type PlaceResult = SearchTypeaheadQuery['searchTypeahead']['places'][number];

export const TypeaheadSearch = memo(function TypeaheadSearch({
  onRouteSelect,
  onPlaceSelect,
}: TypeaheadSearchProps) {
  const isDark = useColorScheme() === 'dark';
  const inputRef = useRef<TextInput>(null);
  const [searchText, setSearchText] = useState('');
  const [debouncedText, setDebouncedText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const searchBg = isDark ? palette.neutral800 : palette.neutral100;
  const searchTextColor = isDark ? palette.white : palette.neutral950;
  const placeholderColor = isDark ? palette.neutral500 : palette.neutral400;
  const dropdownBg = isDark ? palette.neutral900 : palette.white;
  const dropdownBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const sectionColor = isDark ? palette.neutral400 : palette.neutral500;
  const itemColor = isDark ? palette.neutral200 : palette.neutral700;

  // Debounce search text
  useEffect(() => {
    if (searchText.length < 2) {
      setDebouncedText('');
      return;
    }
    const timer = setTimeout(() => setDebouncedText(searchText), 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.typeahead.search(debouncedText),
    queryFn: () => gqlFetcher(SearchTypeaheadDocument, { q: debouncedText, limit: 8 }),
    enabled: debouncedText.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const routes = data?.searchTypeahead?.routes ?? [];
  const places = data?.searchTypeahead?.places ?? [];
  const hasResults = routes.length > 0 || places.length > 0;
  const showDropdown = isFocused && debouncedText.length >= 2;

  // Announce results for accessibility
  useEffect(() => {
    if (!showDropdown || !debouncedText) return;
    const total = routes.length + places.length;
    const message =
      total === 0 ? 'No results found' : `${total} result${total !== 1 ? 's' : ''} found`;
    const timer = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(message);
    }, 500);
    return () => clearTimeout(timer);
  }, [routes.length, places.length, showDropdown, debouncedText]);

  const handleRoutePress = useCallback(
    (route: RouteResult) => {
      trackEvent(AnalyticsEvent.DISCOVER_SEARCH_USED, {
        query: debouncedText,
        result_type: 'route',
        result_count: routes.length + places.length,
      });
      setSearchText('');
      setDebouncedText('');
      inputRef.current?.blur();
      onRouteSelect(route.id);
    },
    [onRouteSelect, debouncedText, routes.length, places.length],
  );

  const handlePlacePress = useCallback(
    (place: PlaceResult) => {
      trackEvent(AnalyticsEvent.DISCOVER_SEARCH_USED, {
        query: debouncedText,
        result_type: 'place',
        result_count: routes.length + places.length,
      });
      setSearchText('');
      setDebouncedText('');
      inputRef.current?.blur();
      onPlaceSelect?.(place.countryCode ?? '', place.regionCode ?? undefined);
    },
    [onPlaceSelect, debouncedText, routes.length, places.length],
  );

  const handleClear = useCallback(() => {
    setSearchText('');
    setDebouncedText('');
  }, []);

  const placeIcon = (kind: string | null | undefined) => {
    if (kind === 'country') return Globe;
    if (kind === 'region') return MapPin;
    return MapPin;
  };

  return (
    <View style={{ zIndex: 10 }}>
      {/* Search bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: searchBg,
          borderRadius: 14,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          height: 44,
          gap: 10,
        }}
      >
        <Search size={18} color={placeholderColor} />
        <TextInput
          ref={inputRef}
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          placeholder="Search routes or places..."
          placeholderTextColor={placeholderColor}
          accessibilityLabel="Search routes and places"
          accessibilityHint="Type to search for motorcycle routes or locations"
          style={{
            flex: 1,
            fontSize: 15,
            color: searchTextColor,
            paddingVertical: 0,
          }}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <Pressable
            onPress={handleClear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <X size={18} color={placeholderColor} />
          </Pressable>
        )}
      </View>

      {/* Dropdown */}
      {showDropdown && (
        <Animated.View
          entering={FadeInUp.duration(150)}
          style={{
            position: 'absolute',
            top: 52,
            left: 0,
            right: 0,
            backgroundColor: dropdownBg,
            borderWidth: 1,
            borderColor: dropdownBorder,
            borderRadius: 14,
            borderCurve: 'continuous',
            maxHeight: 300,
            overflow: 'hidden',
            shadowColor: palette.neutral950,
            shadowOpacity: isDark ? 0.4 : 0.1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          {!hasResults && !isLoading && (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: sectionColor }}>No results found</Text>
            </View>
          )}

          {/* Routes section */}
          {routes.length > 0 && (
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: sectionColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 6,
                }}
              >
                Routes
              </Text>
              {routes.map((route) => (
                <Pressable
                  key={route.id}
                  onPress={() => handleRoutePress(route)}
                  accessibilityRole="button"
                  accessibilityLabel={`Route: ${route.name}`}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: pressed
                      ? isDark
                        ? palette.neutral800
                        : palette.neutral50
                      : 'transparent',
                  })}
                >
                  <Route size={16} color={palette.accent500} />
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: 14, color: itemColor, fontWeight: '500' }}
                  >
                    {route.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Places section */}
          {places.length > 0 && (
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: sectionColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 6,
                }}
              >
                Locations
              </Text>
              {places.map((place) => {
                const PlaceIcon = placeIcon(place.kind);
                return (
                  <Pressable
                    key={place.id}
                    onPress={() => handlePlacePress(place)}
                    accessibilityRole="button"
                    accessibilityLabel={`Location: ${place.name}`}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      backgroundColor: pressed
                        ? isDark
                          ? palette.neutral800
                          : palette.neutral50
                        : 'transparent',
                    })}
                  >
                    <PlaceIcon size={16} color={palette.indigo500} />
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, fontSize: 14, color: itemColor, fontWeight: '500' }}
                    >
                      {place.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
});
