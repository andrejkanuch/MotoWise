import { palette } from '@motovault/design-system';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { CARD_VARIANTS, type CardVariant, type RideSharePayload } from '../share-card-types';

const VARIANT_LABELS: Record<CardVariant, string> = {
  [CARD_VARIANTS.mapHero]: 'Map Hero',
  [CARD_VARIANTS.editorialDark]: 'Editorial',
  [CARD_VARIANTS.pbSpotlight]: 'PB Spotlight',
  [CARD_VARIANTS.routePrint]: 'Route Print',
  [CARD_VARIANTS.elevationStory]: 'Elevation',
};

const VARIANT_BG: Record<CardVariant, string> = {
  [CARD_VARIANTS.mapHero]: palette.shareCardDarkBg,
  [CARD_VARIANTS.editorialDark]: palette.shareCardDarkBg,
  [CARD_VARIANTS.pbSpotlight]: palette.sharePrBg,
  [CARD_VARIANTS.routePrint]: palette.shareCream,
  [CARD_VARIANTS.elevationStory]: palette.shareCardDarkBg,
};

interface ShareCardPreviewProps {
  variant: CardVariant;
  payload: RideSharePayload;
}

/** Placeholder card preview — will be replaced with real card designs in PR2 */
export const ShareCardPreview = memo(function ShareCardPreview({
  variant,
  payload,
}: ShareCardPreviewProps) {
  const bg = VARIANT_BG[variant];
  const isLight = variant === CARD_VARIANTS.routePrint;
  const textColor = isLight ? palette.shareCreamText : palette.shareTextLight;
  const mutedColor = isLight ? 'rgba(26,22,18,0.5)' : 'rgba(255,255,255,0.5)';

  return (
    <View
      style={{
        width: 222,
        height: 396,
        borderRadius: 20,
        borderCurve: 'continuous',
        backgroundColor: bg,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.45,
        shadowRadius: 36,
        elevation: 12,
      }}
      accessibilityLabel={`${VARIANT_LABELS[variant]} card`}
    >
      {/* Wordmark placeholder */}
      <View
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            backgroundColor: palette.shareCopper,
          }}
        />
        <Text
          style={{
            fontFamily: process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace',
            fontSize: 8.5,
            fontWeight: '700',
            letterSpacing: 1.87,
            textTransform: 'uppercase',
            color: mutedColor,
          }}
        >
          MOTOVAULT
        </Text>
      </View>

      {/* Variant label */}
      <Text
        style={{
          fontFamily: process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 2.2,
          textTransform: 'uppercase',
          color: palette.shareCopperSoft,
        }}
      >
        {VARIANT_LABELS[variant]}
      </Text>

      {/* Ride name */}
      <Text
        numberOfLines={2}
        style={{
          fontSize: 20,
          fontWeight: '700',
          letterSpacing: -0.44,
          color: textColor,
          textAlign: 'center',
          marginTop: 8,
          paddingHorizontal: 14,
        }}
      >
        {payload.rideName || 'My Ride'}
      </Text>

      {/* Stats footer placeholder */}
      <View
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          right: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: isLight ? 'rgba(26,22,18,0.18)' : 'rgba(255,255,255,0.12)',
          flexDirection: 'row',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 7.5,
              fontWeight: '600',
              color: mutedColor,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            Distance
          </Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: textColor, marginTop: 2 }}>
            {Math.round(payload.distanceM / 1000)}
            <Text style={{ fontSize: 10, fontWeight: '500', color: mutedColor }}> km</Text>
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 7.5,
              fontWeight: '600',
              color: mutedColor,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            Time
          </Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: textColor, marginTop: 2 }}>
            {Math.round(payload.durationS / 60)}
            <Text style={{ fontSize: 10, fontWeight: '500', color: mutedColor }}> m</Text>
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 7.5,
              fontWeight: '600',
              color: mutedColor,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            Elev
          </Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: textColor, marginTop: 2 }}>
            {payload.elevationGainM != null ? Math.round(payload.elevationGainM) : '—'}
            <Text style={{ fontSize: 10, fontWeight: '500', color: mutedColor }}> m</Text>
          </Text>
        </View>
      </View>
    </View>
  );
});
