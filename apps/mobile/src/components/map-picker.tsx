import { palette } from '@motovault/design-system';
import MapboxGL from '@rnmapbox/maps';
import { MapPin, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { MAP_STYLES } from '../utils/map-styles';
import { type GeocodingResult, searchPlaces } from '../utils/mapbox-geocoding';

type SelectedLocation = {
  lat: number;
  lng: number;
  name: string;
};

type MapPickerProps = {
  onSelect: (location: SelectedLocation) => void;
  initialLat?: number;
  initialLng?: number;
  isDark: boolean;
};

const DEFAULT_LAT = 48.1486;
const DEFAULT_LNG = 17.1077;
const DEFAULT_ZOOM = 13;

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return '';

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=place,address,poi&limit=1&language=en`;
    const response = await fetch(url);
    if (!response.ok) return '';
    const data = await response.json();
    const feature = data.features?.[0];
    return feature?.place_name ?? '';
  } catch {
    if (__DEV__) {
      console.warn('[map-picker] Reverse geocode failed');
    }
    return '';
  }
}

export default function MapPicker({ onSelect, initialLat, initialLng, isDark }: MapPickerProps) {
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMovingFromSearch = useRef(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [centerAddress, setCenterAddress] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const startLat = initialLat ?? DEFAULT_LAT;
  const startLng = initialLng ?? DEFAULT_LNG;

  // Derived colors
  const bg = isDark ? palette.neutral950 : palette.white;
  const textColor = isDark ? palette.white : palette.neutral950;
  const subtextColor = isDark ? palette.neutral400 : palette.neutral500;
  const dropdownBg = isDark ? palette.cardDark : palette.white;
  const dropdownBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const mapStyle = isDark ? MAP_STYLES.dark : MAP_STYLES.light;

  const handleSearch = useCallback((text: string) => {
    setQuery(text);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const places = await searchPlaces(trimmed, { limit: 5 });
        setResults(places);
        setShowResults(places.length > 0);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectResult = useCallback(
    (result: GeocodingResult) => {
      Keyboard.dismiss();
      setQuery(result.fullAddress);
      setShowResults(false);
      setResults([]);
      setCenterAddress(result.fullAddress);

      isMovingFromSearch.current = true;

      cameraRef.current?.setCamera({
        centerCoordinate: [result.lng, result.lat],
        zoomLevel: 15,
        animationDuration: 600,
        animationMode: 'flyTo',
      });

      onSelect({
        lat: result.lat,
        lng: result.lng,
        name: result.fullAddress,
      });
    },
    [onSelect],
  );

  const handleRegionDidChange = useCallback(
    async (feature: GeoJSON.Feature) => {
      // Skip reverse geocode if the camera move came from a search selection
      if (isMovingFromSearch.current) {
        isMovingFromSearch.current = false;
        return;
      }

      const coords = (feature.geometry as GeoJSON.Point).coordinates;
      if (!coords || coords.length < 2) return;

      const [lng, lat] = coords;

      setIsReversing(true);
      const address = await reverseGeocode(lat, lng);
      setIsReversing(false);

      const name = address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setCenterAddress(name);

      onSelect({ lat, lng, name });
    },
    [onSelect],
  );

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const renderResultItem = useCallback(
    ({ item, index }: { item: GeocodingResult; index: number }) => (
      <Animated.View entering={FadeInUp.delay(index * 30).duration(200)}>
        <Pressable
          onPress={() => handleSelectResult(item)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: pressed
              ? isDark
                ? palette.surfacePressed
                : palette.neutral100
              : 'transparent',
            borderBottomWidth: 1,
            borderBottomColor: dropdownBorder,
          })}
        >
          <MapPin size={16} color={palette.signature500} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: textColor }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={{ fontSize: 12, color: subtextColor, marginTop: 2 }} numberOfLines={1}>
              {item.fullAddress}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    ),
    [handleSelectResult, isDark, textColor, subtextColor, dropdownBorder],
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Map */}
      <MapboxGL.MapView
        style={{ flex: 1 }}
        styleURL={mapStyle}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        onRegionDidChange={handleRegionDidChange}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [startLng, startLat],
            zoomLevel: DEFAULT_ZOOM,
          }}
        />
      </MapboxGL.MapView>

      {/* Fixed center pin (like Uber pickup) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Pin shadow */}
        <View
          style={{
            width: 8,
            height: 4,
            borderRadius: 4,
            backgroundColor: 'rgba(0,0,0,0.2)',
            position: 'absolute',
            top: '50%',
            marginTop: 18,
          }}
        />
        {/* Pin body */}
        <View style={{ alignItems: 'center', marginTop: -36 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: palette.signature500,
              justifyContent: 'center',
              alignItems: 'center',
              borderCurve: 'continuous',
              shadowColor: palette.black,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 6,
            }}
          >
            <MapPin size={20} color={palette.white} />
          </View>
          {/* Pin stem */}
          <View
            style={{
              width: 3,
              height: 10,
              backgroundColor: palette.signature500,
              marginTop: -2,
            }}
          />
          {/* Pin point */}
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: palette.signature500,
              marginTop: -1,
            }}
          />
        </View>
      </View>

      {/* Address badge at bottom */}
      {centerAddress ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{
            position: 'absolute',
            bottom: 20,
            left: 16,
            right: 16,
            backgroundColor: dropdownBg,
            borderRadius: 12,
            borderCurve: 'continuous',
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: dropdownBorder,
            shadowColor: palette.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {isReversing ? (
            <ActivityIndicator
              size="small"
              color={palette.signature500}
              style={{ marginRight: 10 }}
            />
          ) : (
            <MapPin size={16} color={palette.signature500} style={{ marginRight: 10 }} />
          )}
          <Text
            style={{ flex: 1, fontSize: 13, color: textColor, fontWeight: '500' }}
            numberOfLines={2}
          >
            {centerAddress}
          </Text>
        </Animated.View>
      ) : null}

      {/* Search bar overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingHorizontal: 16,
          paddingTop: 12,
        }}
      >
        {/* Search input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: dropdownBg,
            borderRadius: 12,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: dropdownBorder,
            paddingHorizontal: 12,
            height: 46,
            shadowColor: palette.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Search size={18} color={subtextColor} style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search for a location..."
            placeholderTextColor={subtextColor}
            returnKeyType="search"
            autoCorrect={false}
            style={{
              flex: 1,
              fontSize: 15,
              color: textColor,
              paddingVertical: 0,
            }}
          />
          {isSearching && (
            <ActivityIndicator
              size="small"
              color={palette.signature500}
              style={{ marginLeft: 6 }}
            />
          )}
          {query.length > 0 && !isSearching && (
            <Pressable
              onPress={handleClearSearch}
              hitSlop={8}
              style={{
                marginLeft: 6,
                width: 24,
                height: 24,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.surfaceElevated : palette.neutral200,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <X size={14} color={subtextColor} />
            </Pressable>
          )}
        </View>

        {/* Autocomplete dropdown */}
        {showResults && results.length > 0 && (
          <Animated.View
            entering={FadeIn.duration(150)}
            style={{
              marginTop: 4,
              backgroundColor: dropdownBg,
              borderRadius: 12,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: dropdownBorder,
              maxHeight: 240,
              overflow: 'hidden',
              shadowColor: palette.black,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderResultItem}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={results.length > 3}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}
