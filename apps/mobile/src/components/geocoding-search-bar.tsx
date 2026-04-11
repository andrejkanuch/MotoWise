import { palette } from '@motovault/design-system';
import { Search, X } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { type GeocodingResult, searchPlaces } from '../utils/mapbox-geocoding';

type GeocodingSearchBarProps = {
  onSelect: (result: GeocodingResult) => void;
  placeholder?: string;
  isDark: boolean;
  proximity?: { lat: number; lng: number };
};

export function GeocodingSearchBar({
  onSelect,
  placeholder = 'Search for a place...',
  isDark,
  proximity,
}: GeocodingSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputBg = isDark ? palette.cardDark : palette.neutral100;
  const inputBorder = isDark ? 'rgba(255,255,255,0.08)' : palette.neutral200;
  const textColor = isDark ? palette.white : palette.neutral900;
  const placeholderColor = isDark ? palette.neutral600 : palette.neutral400;
  const resultsBg = isDark ? palette.cardDark : palette.white;
  const resultText = isDark ? palette.white : palette.neutral900;
  const resultSubtitle = isDark ? palette.neutral400 : palette.neutral500;

  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (text.trim().length < 3) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const places = await searchPlaces(text, { proximity });
        setResults(places);
      }, 300);
    },
    [proximity],
  );

  const handleSelect = useCallback(
    (result: GeocodingResult) => {
      onSelect(result);
      setQuery('');
      setResults([]);
    },
    [onSelect],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 44,
          backgroundColor: inputBg,
          borderWidth: 1,
          borderColor: inputBorder,
          borderRadius: 12,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          gap: 10,
        }}
      >
        <Search size={18} color={placeholderColor} />
        <TextInput
          value={query}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          style={{
            flex: 1,
            fontSize: 15,
            color: textColor,
            paddingVertical: 0,
          }}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <X size={18} color={placeholderColor} />
          </Pressable>
        )}
      </View>

      {results.length > 0 && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={{
            marginTop: 6,
            backgroundColor: resultsBg,
            borderRadius: 12,
            borderCurve: 'continuous',
            maxHeight: 240,
            overflow: 'hidden',
            shadowColor: palette.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: inputBorder,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Animated.Text
                  entering={FadeInUp.delay(index * 50).duration(200)}
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: resultText,
                    marginBottom: 2,
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </Animated.Text>
                <Animated.Text
                  entering={FadeInUp.delay(index * 50 + 30).duration(200)}
                  style={{
                    fontSize: 13,
                    color: resultSubtitle,
                  }}
                  numberOfLines={1}
                >
                  {item.fullAddress}
                </Animated.Text>
              </Pressable>
            )}
          />
        </Animated.View>
      )}
    </View>
  );
}
