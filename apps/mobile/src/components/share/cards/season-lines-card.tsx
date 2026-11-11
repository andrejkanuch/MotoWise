import { palette } from '@motovault/design-system';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fitViewport, projectPoint } from '@/features/rider-insights/map-viewport';
import { formatInsightDistance } from '@/features/rider-insights/use-rider-insights';
import { space } from '@/theme/spacing';
import { PLATE_FONT, SYSTEM_WEIGHT } from '@/theme/type';
import { CARD_UNITS_WIDTH, cardHeight, routesBounds, type ShareSize } from '../insights-share';
import type { InsightsSharePayload } from '../share-card-types';

/** Season lines is always graphite, whatever the app theme: it is an image. */
const INK = {
  ground: palette.plateG0,
  strong: palette.plateInk,
  muted: palette.plateInk3,
  route: palette.plateCopper,
} as const;

/** Layout in card units (the card is 360 units wide). */
const U = {
  routesTop: 52,
  /** Height kept for the text block under the routes. */
  textBlock: 132,
  routesPadding: 24,
  routeWidth: 3,
  region: 17,
  distance: 61,
  rides: 18,
  rideLine: 24,
  handle: 16.5,
  handleLine: 22,
} as const;

interface SeasonLinesCardProps {
  payload: InsightsSharePayload;
  size: ShareSize;
  /** Rendered width; everything scales with it. */
  width: number;
}

/**
 * The free season image: the main region's routes in copper on graphite, the
 * region's name, the season's distance and ride count, and the rider's handle.
 */
export const SeasonLinesCard = memo(function SeasonLinesCard({
  payload,
  size,
  width,
}: SeasonLinesCardProps) {
  const { t, i18n } = useTranslation();
  const s = width / CARD_UNITS_WIDTH;
  const height = cardHeight(width, size);
  const unitsHeight = cardHeight(CARD_UNITS_WIDTH, size);

  const paths = useMemo(() => {
    const bounds = routesBounds(payload.routes);
    if (!bounds) return [];
    const boxHeight = unitsHeight - U.routesTop - U.textBlock;
    const viewport = fitViewport(bounds, CARD_UNITS_WIDTH, boxHeight, U.routesPadding);
    return payload.routes.map((route) =>
      route
        .map((point, i) => {
          const [x, y] = projectPoint(point, viewport, CARD_UNITS_WIDTH, boxHeight);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${(y + U.routesTop).toFixed(1)}`;
        })
        .join(' '),
    );
  }, [payload.routes, unitsHeight]);

  const brandLine = payload.handle
    ? t('riderInsights.share.handleBrand', { handle: payload.handle })
    : // Brand name, not localized
      'MotoVault';

  return (
    <View
      testID="season-lines-card"
      collapsable={false}
      style={{ width, height, backgroundColor: INK.ground, overflow: 'hidden' }}
    >
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${CARD_UNITS_WIDTH} ${unitsHeight}`}
        style={{ position: 'absolute' }}
      >
        {paths.map((d, i) => (
          <Path
            // biome-ignore lint/suspicious/noArrayIndexKey: routes are an ordered, unkeyed list
            key={i}
            d={d}
            stroke={INK.route}
            strokeWidth={U.routeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>

      {payload.regionName ? (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            position: 'absolute',
            top: space.lg * s,
            left: space.lg * s,
            right: space.lg * s,
            ...SYSTEM_WEIGHT.semibold,
            fontSize: U.region * s,
            color: INK.muted,
          }}
        >
          {payload.regionName}
        </Text>
      ) : null}

      <View
        style={{
          position: 'absolute',
          left: space.lg * s,
          right: space.lg * s,
          bottom: space.lg * s,
          gap: space.xxs * s,
        }}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            fontFamily: PLATE_FONT.semibold,
            fontVariant: ['tabular-nums'],
            fontSize: U.distance * s,
            lineHeight: U.distance * s,
            color: INK.strong,
          }}
        >
          {formatInsightDistance(payload.distanceM, payload.measurementSystem, i18n.language)}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            ...SYSTEM_WEIGHT.semibold,
            fontSize: U.rides * s,
            lineHeight: U.rideLine * s,
            color: INK.strong,
          }}
        >
          {t('riderInsights.share.ridesSeason', {
            count: payload.rides,
            year: payload.seasonYear,
          })}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{ fontSize: U.handle * s, lineHeight: U.handleLine * s, color: INK.muted }}
        >
          {brandLine}
        </Text>
      </View>
    </View>
  );
});
