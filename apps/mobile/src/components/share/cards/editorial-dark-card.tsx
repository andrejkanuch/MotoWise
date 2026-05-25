import { palette } from '@motovault/design-system';
import { memo } from 'react';
import { Text, View } from 'react-native';
import type { RideSharePayload } from '../share-card-types';
import {
  buildDefaultStats,
  DateCompact,
  RouteSilhouette,
  StatFooter,
  Wordmark,
} from './card-elements';

const MONO = process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace';

export const EditorialDarkCard = memo(function EditorialDarkCard({
  data,
}: {
  data: RideSharePayload;
}) {
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
          style={{
            fontFamily: MONO,
            fontSize: 8,
            fontWeight: '600',
            letterSpacing: 1.92,
            color: palette.shareCopperSoft,
            textTransform: 'uppercase',
          }}
        >
          Ride no. {rideNum}
        </Text>
        <Text
          numberOfLines={3}
          style={{
            fontSize: 22,
            fontWeight: '700',
            letterSpacing: -0.48,
            lineHeight: 22,
            color: 'rgba(255,255,255,0.94)',
            textAlign: 'center',
            marginTop: 14,
          }}
        >
          {data.rideName.split('—').map((part, i) =>
            i === 0 ? (
              <Text key={part.trim()}>{part.trim()}</Text>
            ) : (
              <Text
                key={part.trim()}
                style={{ fontStyle: 'italic', fontWeight: '400', fontSize: 36 }}
              >
                {'\n'}
                {part.trim()}
              </Text>
            ),
          )}
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
        borderColor="rgba(255,255,255,0.12)"
        labelColor="rgba(255,255,255,0.5)"
        valueColor={palette.shareTextLight}
        unitColor="rgba(255,255,255,0.55)"
      />
    </View>
  );
});
