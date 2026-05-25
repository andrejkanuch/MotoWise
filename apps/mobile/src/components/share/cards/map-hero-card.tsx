import { palette } from '@motovault/design-system';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Image, Text, View } from 'react-native';
import type { RideSharePayload } from '../share-card-types';
import { buildDefaultStats, DateEyebrow, StatFooter, Wordmark } from './card-elements';

const MONO = process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace';

export const MapHeroCard = memo(function MapHeroCard({ data }: { data: RideSharePayload }) {
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
      {/* Map background */}
      {data.mapSnapshotUri && (
        <Image
          source={{ uri: data.mapSnapshotUri }}
          style={{ position: 'absolute', width: 222, height: 396 }}
          resizeMode="cover"
        />
      )}

      {/* Gradient overlay — bottom 64% */}
      <LinearGradient
        colors={['transparent', 'rgba(8,6,4,0.78)', 'rgba(8,6,4,0.92)']}
        locations={[0, 0.7, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '64%' }}
      />

      {/* Top bar: wordmark + PB pill */}
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
        {data.isPB && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingVertical: 3,
              paddingHorizontal: 7,
              borderRadius: 99,
              backgroundColor: 'rgba(200,119,44,0.78)',
            }}
          >
            <Text
              style={{
                fontFamily: MONO,
                fontSize: 8,
                fontWeight: '700',
                letterSpacing: 1.12,
                color: '#fff',
                textTransform: 'uppercase',
              }}
            >
              PB
            </Text>
          </View>
        )}
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
