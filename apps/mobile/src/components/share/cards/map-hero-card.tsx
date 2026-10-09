import { palette } from '@motovault/design-system';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Image, Text, View } from 'react-native';
import { tint } from '../../../theme/editorial';
import type { RideSharePayload } from '../share-card-types';
import {
  buildDefaultStats,
  CARD_INK,
  CARD_TYPE,
  DateLine,
  StatFooter,
  Wordmark,
} from './card-elements';

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
        colors={[
          'transparent',
          tint(palette.shareCardDarkBg, 0.78),
          tint(palette.shareCardDarkBg, 0.92),
        ]}
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
        <Wordmark color={CARD_INK.strong} />
        {data.isPB && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingVertical: 3,
              paddingHorizontal: 7,
              borderRadius: 99,
              backgroundColor: palette.plateBone,
            }}
          >
            <Text style={{ ...CARD_TYPE.label, color: palette.plateOnPlate }}>PB</Text>
          </View>
        )}
      </View>

      {/* Content block */}
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 80 }}>
        <Text
          numberOfLines={2}
          style={{
            ...CARD_TYPE.title,
            fontSize: 26,
            lineHeight: 27,
            color: CARD_INK.strong,
          }}
        >
          {data.rideName}
        </Text>
        <View style={{ marginTop: 4 }}>
          <DateLine date={data.date} />
        </View>
      </View>

      {/* Stats footer */}
      <StatFooter stats={buildDefaultStats(data)} />
    </View>
  );
});
