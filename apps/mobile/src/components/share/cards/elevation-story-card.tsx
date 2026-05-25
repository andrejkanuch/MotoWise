import { palette } from '@motovault/design-system';
import { memo } from 'react';
import { Text, View } from 'react-native';
import type { RideSharePayload } from '../share-card-types';
import { buildElevStats, ElevationSparkline, StatFooter, Wordmark } from './card-elements';

const MONO = process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace';

export const ElevationStoryCard = memo(function ElevationStoryCard({
  data,
}: {
  data: RideSharePayload;
}) {
  return (
    <View
      style={{
        width: 222,
        height: 396,
        borderRadius: 20,
        borderCurve: 'continuous',
        backgroundColor: '#0c0a08',
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
        <Text
          style={{
            fontFamily: MONO,
            fontSize: 8.5,
            fontWeight: '600',
            letterSpacing: 1.7,
            color: palette.shareCopperSoft,
            textTransform: 'uppercase',
          }}
        >
          Elev profile
        </Text>
      </View>

      {/* Elevation chart */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 56, height: 180 }}>
        <ElevationSparkline
          profile={data.elevationProfile}
          peakM={data.elevationPeakM}
          width={222}
          height={180}
        />
        {/* Peak altitude label */}
        {data.elevationPeakM != null && (
          <View style={{ position: 'absolute', top: 8, right: 14 }}>
            <Text
              style={{
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: '700',
                letterSpacing: 0.54,
                color: palette.shareCopperSoft,
              }}
            >
              {Math.round(data.elevationPeakM)} m
            </Text>
          </View>
        )}
      </View>

      {/* Title block */}
      <View style={{ position: 'absolute', left: 14, right: 14, top: 248 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 19,
            fontWeight: '700',
            letterSpacing: -0.42,
            lineHeight: 20.5,
            color: palette.shareTextLight,
          }}
        >
          {data.rideName}
        </Text>
      </View>

      {/* Stats footer */}
      <StatFooter
        stats={buildElevStats(data)}
        borderColor="rgba(255,255,255,0.12)"
        labelColor="rgba(255,255,255,0.5)"
        valueColor={palette.shareTextLight}
        unitColor="rgba(255,255,255,0.55)"
      />
    </View>
  );
});
