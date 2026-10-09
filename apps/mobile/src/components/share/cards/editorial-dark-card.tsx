import { palette } from '@motovault/design-system';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { RideSharePayload } from '../share-card-types';
import {
  buildDefaultStats,
  CARD_INK,
  CARD_TYPE,
  DateCompact,
  RouteSilhouette,
  StatFooter,
  Wordmark,
} from './card-elements';

export const EditorialDarkCard = memo(function EditorialDarkCard({
  data,
}: {
  data: RideSharePayload;
}) {
  const { t } = useTranslation();
  const rideNum = data.rideNumber != null ? String(data.rideNumber).padStart(3, '0') : '—';

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
          top: 18,
          left: 14,
          right: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Wordmark />
        <DateCompact date={data.date} />
      </View>

      {/* Center content */}
      <View style={{ position: 'absolute', top: 56, left: 18, right: 18, alignItems: 'center' }}>
        <Text
          numberOfLines={3}
          style={{
            ...CARD_TYPE.title,
            fontSize: 30,
            lineHeight: 31,
            color: CARD_INK.strong,
            textAlign: 'center',
          }}
        >
          {data.rideName}
        </Text>
        <Text style={{ ...CARD_TYPE.label, color: CARD_INK.faint, marginTop: 10 }}>
          {t('shareSheet.rideNumber', { number: rideNum })}
        </Text>
      </View>

      {/* Route silhouette */}
      {data.routeCoordinates.length >= 2 && (
        <View
          style={{ position: 'absolute', left: '50%', top: 218, marginLeft: -55, opacity: 0.65 }}
        >
          <RouteSilhouette coordinates={data.routeCoordinates} />
        </View>
      )}

      {/* Stats footer */}
      <StatFooter
        stats={buildDefaultStats(data)}
        borderColor={CARD_INK.rule}
        labelColor={CARD_INK.faint}
        valueColor={palette.shareTextLight}
        unitColor={palette.whiteAlpha55}
      />
    </View>
  );
});
