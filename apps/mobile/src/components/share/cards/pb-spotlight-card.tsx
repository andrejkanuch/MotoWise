import { palette } from '@motovault/design-system';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { tint } from '@/theme/editorial';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDistanceValue,
  formatDuration,
  formatElevationValue,
  formatSpeedValue,
  speedUnitLabel,
} from '@/utils/ride-formatters';
import type { RideSharePayload } from '../share-card-types';
import { CARD_INK, CARD_TYPE, RouteSilhouette } from './card-elements';

export const PbSpotlightCard = memo(function PbSpotlightCard({ data }: { data: RideSharePayload }) {
  const { t } = useTranslation();
  if (!data.isPB) return null;

  const sys = data.measurementSystem;
  const heroValue =
    data.pbType === 'topSpeed' && data.maxSpeedMps != null
      ? String(formatSpeedValue(data.maxSpeedMps, sys))
      : data.pbType === 'longestRide'
        ? formatDistanceValue(data.distanceM, sys)
        : data.elevationGainM != null
          ? String(formatElevationValue(data.elevationGainM, sys))
          : '—';

  const heroUnit =
    data.pbType === 'topSpeed'
      ? speedUnitLabel(sys)
      : data.pbType === 'longestRide'
        ? distanceUnitLabel(sys)
        : elevationUnitLabel(sys);

  const heroLabel =
    data.pbType === 'topSpeed'
      ? t('shareSheet.topSpeed')
      : data.pbType === 'longestRide'
        ? t('shareSheet.longestRide')
        : t('shareSheet.mostElevation');

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
      {/* PB tag — a bone plate chip */}
      <View style={{ position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 5,
            paddingHorizontal: 11,
            borderRadius: 99,
            backgroundColor: palette.plateBone,
          }}
        >
          <Text style={{ ...CARD_TYPE.label, fontSize: 10, color: palette.plateOnPlate }}>
            {t('shareSheet.personalRecord')}
          </Text>
        </View>
      </View>

      {/* Hero number */}
      <View style={{ position: 'absolute', top: 96, left: 0, right: 0, alignItems: 'center' }}>
        <Text
          style={{
            ...CARD_TYPE.figure,
            fontFamily: CARD_TYPE.title.fontFamily,
            fontSize: 104,
            lineHeight: 96,
            color: CARD_INK.strong,
          }}
        >
          {heroValue}
          <Text style={{ ...CARD_TYPE.figure, fontSize: 26, color: CARD_INK.muted }}>
            {' '}
            {heroUnit}
          </Text>
        </Text>
        <Text
          style={{
            ...CARD_TYPE.label,
            fontSize: 15,
            color: palette.whiteAlpha85,
            marginTop: 6,
          }}
        >
          {heroLabel}
        </Text>
        {diff != null && data.prevPbValue != null && (
          <Text
            style={{
              ...CARD_TYPE.label,
              fontVariant: ['tabular-nums'],
              color: CARD_INK.faint,
              marginTop: 14,
            }}
          >
            {t('shareSheet.prevRecord', {
              diff,
              unit: heroUnit,
              previous: formatSpeedValue(data.prevPbValue, sys),
            })}
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
          borderTopColor: CARD_INK.rule,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              ...CARD_TYPE.title,
              fontSize: 15,
              color: CARD_INK.body,
            }}
          >
            {data.rideName}
          </Text>
          <Text
            style={{
              ...CARD_TYPE.label,
              fontVariant: ['tabular-nums'],
              color: CARD_INK.faint,
              marginTop: 4,
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
              strokeColor={tint(palette.shareCopperSoft, 0.8)}
              strokeWidth={1}
            />
          </View>
        )}
      </View>
    </View>
  );
});
