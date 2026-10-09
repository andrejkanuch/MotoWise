import { palette } from '@motovault/design-system';
import { memo } from 'react';
import { Text, View } from 'react-native';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDistanceValue,
  formatDuration,
  formatElevationValue,
} from '../../../utils/ride-formatters';
import type { RideSharePayload } from '../share-card-types';
import { CARD_INK_CREAM, CARD_TYPE, DateCompact, RouteSilhouette, Wordmark } from './card-elements';

const STAT_UNIT = { ...CARD_TYPE.label, fontSize: 10, color: CARD_INK_CREAM.muted } as const;
const STAT_VALUE = { ...CARD_TYPE.figure, fontSize: 17, color: CARD_INK_CREAM.strong } as const;

export const RoutePrintCard = memo(function RoutePrintCard({ data }: { data: RideSharePayload }) {
  const sys = data.measurementSystem;
  const rideNum = data.rideNumber != null ? String(data.rideNumber).padStart(3, '0') : '—';

  return (
    <View
      style={{
        width: 222,
        height: 396,
        borderRadius: 20,
        borderCurve: 'continuous',
        backgroundColor: palette.shareCream,
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
        <Wordmark color={CARD_INK_CREAM.muted} />
        <DateCompact date={data.date} color={CARD_INK_CREAM.faint} />
      </View>

      {/* Route art — large centered */}
      {data.routeCoordinates.length >= 2 && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 60,
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 40,
          }}
        >
          <RouteSilhouette
            coordinates={data.routeCoordinates}
            width={180}
            height={200}
            strokeColor={palette.shareCopper}
            strokeWidth={2.2}
          />
        </View>
      )}

      {/* Bottom content */}
      <View
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: CARD_INK_CREAM.rule,
        }}
      >
        <Text
          numberOfLines={2}
          style={{
            ...CARD_TYPE.title,
            fontSize: 22,
            lineHeight: 23,
            color: CARD_INK_CREAM.strong,
          }}
        >
          {data.rideName}
        </Text>
        <Text style={{ ...CARD_TYPE.label, color: CARD_INK_CREAM.faint, marginTop: 2 }}>
          Ride no. {rideNum}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14, marginTop: 10 }}>
          <Text style={STAT_UNIT}>
            <Text style={STAT_VALUE}>{formatDistanceValue(data.distanceM, sys)}</Text>{' '}
            {distanceUnitLabel(sys)}
          </Text>
          <Text style={STAT_UNIT}>
            <Text style={STAT_VALUE}>{formatDuration(data.durationS)}</Text>
          </Text>
          {data.elevationGainM != null && (
            <Text style={STAT_UNIT}>
              <Text style={STAT_VALUE}>{formatElevationValue(data.elevationGainM, sys)}</Text>{' '}
              {elevationUnitLabel(sys)} ↑
            </Text>
          )}
        </View>
      </View>
    </View>
  );
});
