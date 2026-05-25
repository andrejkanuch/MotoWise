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
import { DateCompact, RouteSilhouette, Wordmark } from './card-elements';

const MONO = process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace';

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
        <Wordmark color="rgba(26,22,18,0.7)" />
        <DateCompact date={data.date} color="rgba(26,22,18,0.5)" />
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
          borderTopColor: 'rgba(26,22,18,0.18)',
        }}
      >
        <Text
          style={{
            fontFamily: MONO,
            fontSize: 8.5,
            fontWeight: '600',
            letterSpacing: 1.53,
            color: 'rgba(26,22,18,0.5)',
            textTransform: 'uppercase',
          }}
        >
          Ride no. {rideNum}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 18,
            fontWeight: '700',
            letterSpacing: -0.4,
            lineHeight: 19.4,
            color: palette.shareCreamText,
            marginTop: 4,
          }}
        >
          {data.rideName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14, marginTop: 10 }}>
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: '600',
              letterSpacing: 1.2,
              color: 'rgba(26,22,18,0.7)',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                letterSpacing: -0.25,
                color: palette.shareCreamText,
              }}
            >
              {formatDistanceValue(data.distanceM, sys)}
            </Text>{' '}
            {distanceUnitLabel(sys)}
          </Text>
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: '600',
              letterSpacing: 1.2,
              color: 'rgba(26,22,18,0.7)',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                letterSpacing: -0.25,
                color: palette.shareCreamText,
              }}
            >
              {formatDuration(data.durationS)}
            </Text>
          </Text>
          {data.elevationGainM != null && (
            <Text
              style={{
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 1.2,
                color: 'rgba(26,22,18,0.7)',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  letterSpacing: -0.25,
                  color: palette.shareCreamText,
                }}
              >
                {formatElevationValue(data.elevationGainM, sys)}
              </Text>{' '}
              {elevationUnitLabel(sys)} ↑
            </Text>
          )}
        </View>
      </View>
    </View>
  );
});
