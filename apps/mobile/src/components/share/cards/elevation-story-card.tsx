import { palette } from '@motovault/design-system';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { elevationUnitLabel, formatElevationValue } from '../../../utils/ride-formatters';
import type { RideSharePayload } from '../share-card-types';
import {
  buildElevStats,
  CARD_INK,
  CARD_TYPE,
  ElevationSparkline,
  StatFooter,
  Wordmark,
} from './card-elements';

export const ElevationStoryCard = memo(function ElevationStoryCard({
  data,
}: {
  data: RideSharePayload;
}) {
  const { t } = useTranslation();
  const sys = data.measurementSystem;
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
      {/* Top bar */}
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
        <Wordmark />
        <Text style={{ ...CARD_TYPE.label, color: CARD_INK.muted }}>
          {t('rideDetail.elevationProfile')}
        </Text>
      </View>

      {/* Elevation chart */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 56, height: 180 }}>
        <ElevationSparkline profile={data.elevationProfile} width={222} height={180} />
        {/* Peak altitude label */}
        {data.elevationPeakM != null && (
          <View style={{ position: 'absolute', top: 8, right: 14 }}>
            <Text style={{ ...CARD_TYPE.figure, fontSize: 13, color: CARD_INK.body }}>
              {`${formatElevationValue(data.elevationPeakM, sys)} ${elevationUnitLabel(sys)}`}
            </Text>
          </View>
        )}
      </View>

      {/* Title block */}
      <View style={{ position: 'absolute', left: 14, right: 14, top: 248 }}>
        <Text
          numberOfLines={2}
          style={{
            ...CARD_TYPE.title,
            fontSize: 24,
            lineHeight: 25,
            color: palette.shareTextLight,
          }}
        >
          {data.rideName}
        </Text>
      </View>

      {/* Stats footer */}
      <StatFooter
        stats={buildElevStats(data)}
        borderColor={CARD_INK.rule}
        labelColor={CARD_INK.faint}
        valueColor={palette.shareTextLight}
        unitColor={palette.whiteAlpha55}
      />
    </View>
  );
});
