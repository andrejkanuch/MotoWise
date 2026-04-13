import { useRef } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { palette } from '@motovault/design-system';

interface RouteMapViewProps {
  polyline: string;
  startLat: number;
  startLng: number;
  distanceM: number;
  elevationGainM: number;
  surfaceType?: string;
  name?: string;
}

/**
 * Mobile route map view.
 *
 * NOTE: Full @rnmapbox/maps integration requires:
 * 1. `pnpm add @rnmapbox/maps --filter mobile`
 * 2. Config plugin in app.json: ["@rnmapbox/maps", { "RNMapboxMapsVersion": "11.16.0" }]
 * 3. RNMAPBOX_MAPS_DOWNLOAD_TOKEN env var for CocoaPods
 * 4. Expo dev client build (not Expo Go)
 *
 * This component renders a placeholder until native Mapbox is configured.
 * Replace the placeholder View with MapboxGL.MapView when ready.
 */
export default function RouteMapView({
  polyline,
  startLat,
  startLng,
  distanceM,
  elevationGainM,
  surfaceType,
  name,
}: RouteMapViewProps) {
  const openDirections = (provider: 'apple' | 'google') => {
    Haptics.selectionAsync();
    const url =
      provider === 'apple'
        ? `maps://?daddr=${startLat},${startLng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${startLat},${startLng}`;
    Linking.openURL(url);
  };

  return (
    <Animated.View entering={FadeInUp.duration(300)} style={{ flex: 1 }}>
      {/* Map placeholder — swap with MapboxGL.MapView when native module is configured */}
      <View
        style={{
          flex: 1,
          backgroundColor: palette.cardDark,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 16,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        <Text style={{ color: palette.textSecondary, fontSize: 14, marginBottom: 8 }}>
          Route Map
        </Text>
        {name && (
          <Text style={{ color: palette.text, fontSize: 18, fontWeight: '600', marginBottom: 4 }}>
            {name}
          </Text>
        )}
        <Text style={{ color: palette.textSecondary, fontSize: 12 }}>
          {(distanceM / 1000).toFixed(1)} km | {elevationGainM?.toFixed(0) ?? '?'} m gain |{' '}
          {surfaceType ?? 'unknown'}
        </Text>
        <Text
          style={{
            color: palette.textTertiary,
            fontSize: 11,
            marginTop: 16,
            textAlign: 'center',
            paddingHorizontal: 32,
          }}
        >
          Interactive map requires Mapbox native module.{'\n'}Run `npx expo prebuild` with
          @rnmapbox/maps configured.
        </Text>
      </View>

      {/* Directions buttons */}
      <View style={{ flexDirection: 'row', gap: 8, paddingTop: 12 }}>
        <Pressable
          onPress={() => openDirections('apple')}
          style={{
            flex: 1,
            paddingVertical: 12,
            backgroundColor: palette.primary500,
            borderRadius: 8,
            borderCurve: 'continuous',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Apple Maps</Text>
        </Pressable>
        <Pressable
          onPress={() => openDirections('google')}
          style={{
            flex: 1,
            paddingVertical: 12,
            backgroundColor: palette.primary500,
            borderRadius: 8,
            borderCurve: 'continuous',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Google Maps</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
