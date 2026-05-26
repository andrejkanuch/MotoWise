import { palette } from '@motovault/design-system';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { Image, Text, View } from 'react-native';
import { buildMapboxStaticUrl, type StaticMapStyle } from '../../../utils/mapbox-static';
import type { RideSharePayload } from '../share-card-types';
import { buildDefaultStats, DateEyebrow, StatFooter, Wordmark } from './card-elements';

const MONO = process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace';

interface MapStyleConfig {
  mapboxStyle: StaticMapStyle;
  label: string;
  /** Route stroke hex without # */
  strokeColor: string;
  /** Gradient overlay colors */
  gradientColors: [string, string, string];
  /** Camera pitch for 3D perspective */
  pitch?: number;
  /** Camera bearing */
  bearing?: number;
}

const STYLE_CONFIGS: Record<string, MapStyleConfig> = {
  satellite: {
    mapboxStyle: 'satellite-v9',
    label: 'SATELLITE',
    strokeColor: 'FFFFFF',
    gradientColors: ['transparent', 'rgba(8,6,4,0.82)', 'rgba(8,6,4,0.95)'],
  },
  hybrid: {
    mapboxStyle: 'satellite-streets-v12',
    label: 'HYBRID',
    strokeColor: 'D4622E',
    gradientColors: ['transparent', 'rgba(8,6,4,0.78)', 'rgba(8,6,4,0.92)'],
  },
  terrain3D: {
    mapboxStyle: 'outdoors-v12',
    label: '3D',
    strokeColor: 'D4622E',
    gradientColors: ['transparent', 'rgba(8,6,4,0.72)', 'rgba(8,6,4,0.90)'],
    pitch: 50,
    bearing: 30,
  },
};

export type MapStyleVariant = 'satellite' | 'hybrid' | 'terrain3D';

export const MapStyleCard = memo(function MapStyleCard({
  data,
  variant,
}: {
  data: RideSharePayload;
  variant: MapStyleVariant;
}) {
  const config = STYLE_CONFIGS[variant];

  const staticUrl = useMemo(() => {
    if (!data.routePolyline) return null;
    return buildMapboxStaticUrl({
      style: config.mapboxStyle,
      routePolyline: data.routePolyline,
      strokeColor: config.strokeColor,
      strokeWidth: 4,
      pitch: config.pitch,
      bearing: config.bearing,
    });
  }, [data.routePolyline, config]);

  return (
    <View
      style={{
        width: 222,
        height: 396,
        borderRadius: 20,
        borderCurve: 'continuous',
        backgroundColor: palette.shareCardDarkBg,
        overflow: 'hidden',
      }}
    >
      {/* Map background from Mapbox Static Images API */}
      {staticUrl && (
        <Image
          source={{ uri: staticUrl }}
          style={{ position: 'absolute', width: 222, height: 396 }}
          resizeMode="cover"
        />
      )}

      {/* Gradient overlay — bottom 64% */}
      <LinearGradient
        colors={config.gradientColors}
        locations={[0, 0.7, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '64%' }}
      />

      {/* Top bar: wordmark + style badge */}
      <View
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          right: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Wordmark color="#fff" />
        <View
          style={{
            paddingVertical: 3,
            paddingHorizontal: 7,
            borderRadius: 99,
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        >
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 8,
              fontWeight: '700',
              letterSpacing: 1.12,
              color: 'rgba(255,255,255,0.85)',
              textTransform: 'uppercase',
            }}
          >
            {config.label}
          </Text>
        </View>
      </View>

      {/* Content block */}
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 80 }}>
        <DateEyebrow date={data.date} />
        <Text
          numberOfLines={2}
          style={{
            fontSize: 20,
            fontWeight: '700',
            letterSpacing: -0.44,
            lineHeight: 21.6,
            color: '#fff',
            marginTop: 4,
          }}
        >
          {data.rideName}
        </Text>
      </View>

      {/* Stats footer */}
      <StatFooter stats={buildDefaultStats(data)} />
    </View>
  );
});
