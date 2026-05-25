import { palette } from '@motovault/design-system';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Text, View } from 'react-native';
import {
  distanceUnitLabel,
  formatDistanceValue,
  formatDuration,
  formatSpeedValue,
  speedUnitLabel,
} from '../../../utils/ride-formatters';
import type { RideSharePayload } from '../share-card-types';
import { RouteSilhouette } from './card-elements';

const MONO = process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace';

export const PbSpotlightCard = memo(function PbSpotlightCard({ data }: { data: RideSharePayload }) {
  if (!data.isPB) return null;

  const sys = data.measurementSystem;
  const heroValue =
    data.pbType === 'topSpeed' && data.maxSpeedMps != null
      ? String(formatSpeedValue(data.maxSpeedMps, sys))
      : data.pbType === 'longestRide'
        ? formatDistanceValue(data.distanceM, sys)
        : data.elevationGainM != null
          ? String(Math.round(data.elevationGainM))
          : '—';

  const heroUnit =
    data.pbType === 'topSpeed'
      ? speedUnitLabel(sys)
      : data.pbType === 'longestRide'
        ? distanceUnitLabel(sys)
        : 'm';

  const heroLabel =
    data.pbType === 'topSpeed'
      ? 'Top speed'
      : data.pbType === 'longestRide'
        ? 'Longest ride'
        : 'Most elevation';

  const diff =
    data.prevPbValue != null && data.maxSpeedMps != null && data.pbType === 'topSpeed'
      ? formatSpeedValue(data.maxSpeedMps, sys) - formatSpeedValue(data.prevPbValue, sys)
      : null;

  return (
    <View
      style={{
        width: 222,
        height: 396,
        borderRadius: 20,
        borderCurve: 'continuous',
        backgroundColor: palette.sharePrBg,
        overflow: 'hidden',
      }}
    >
      {/* Copper radial glow */}
      <LinearGradient
        colors={['rgba(200,119,44,0.4)', 'transparent']}
        style={{
          position: 'absolute',
          top: -60,
          left: -60,
          right: -60,
          height: 280,
          borderRadius: 140,
        }}
      />

      {/* PB tag */}
      <View style={{ position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 5,
            paddingHorizontal: 11,
            borderRadius: 99,
            backgroundColor: palette.shareCopper,
          }}
        >
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 8.5,
              fontWeight: '700',
              letterSpacing: 1.87,
              color: '#fff',
              textTransform: 'uppercase',
            }}
          >
            Personal Record
          </Text>
        </View>
      </View>

      {/* Hero number */}
      <View style={{ position: 'absolute', top: 96, left: 0, right: 0, alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 96,
            fontWeight: '800',
            letterSpacing: -4.32,
            lineHeight: 86,
            color: '#fff',
            fontVariant: ['tabular-nums'],
          }}
        >
          {heroValue}
          <Text
            style={{
              fontSize: 24,
              fontWeight: '600',
              letterSpacing: -0.24,
              color: palette.shareCopperSoft,
            }}
          >
            {' '}
            {heroUnit}
          </Text>
        </Text>
        <Text
          style={{
            fontStyle: 'italic',
            fontSize: 18,
            fontWeight: '400',
            letterSpacing: -0.09,
            color: 'rgba(255,255,255,0.85)',
            marginTop: 6,
          }}
        >
          {heroLabel}
        </Text>
        {diff != null && data.prevPbValue != null && (
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: '600',
              letterSpacing: 1.26,
              color: 'rgba(255,255,255,0.5)',
              marginTop: 14,
              textTransform: 'uppercase',
            }}
          >
            +{diff} {heroUnit} · prev. {formatSpeedValue(data.prevPbValue, sys)} {heroUnit}
          </Text>
        )}
      </View>

      {/* Bottom: ride name + route */}
      <View
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.12)',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: -0.055,
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            {data.rideName}
          </Text>
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 8.5,
              fontWeight: '500',
              letterSpacing: 1.53,
              color: 'rgba(255,255,255,0.5)',
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            {formatDistanceValue(data.distanceM, sys)} {distanceUnitLabel(sys)} ·{' '}
            {formatDuration(data.durationS)}
          </Text>
        </View>
        {data.routeCoordinates.length >= 2 && (
          <View style={{ width: 48, height: 48, opacity: 0.75 }}>
            <RouteSilhouette
              coordinates={data.routeCoordinates}
              width={48}
              height={48}
              strokeColor="rgba(232,157,90,0.8)"
              strokeWidth={1}
            />
          </View>
        )}
      </View>
    </View>
  );
});
