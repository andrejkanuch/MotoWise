import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { projectPoint, STATIC_STYLE, staticMapUrl } from '@/features/rider-insights/region-tiles';
import { formatInsightDistance } from '@/features/rider-insights/use-rider-insights';
import { EDITORIAL_SCHEME, type EditorialScheme, editorialThemes, tint } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { PLATE_FONT, SYSTEM_WEIGHT } from '@/theme/type';
import {
  CARD_UNITS_WIDTH,
  cardHeight,
  POSTER_BASE,
  POSTER_PANEL_UNITS,
  posterViewport,
  routesBounds,
  type ShareSize,
} from '../insights-share';
import {
  BASE_MAP_STATUS,
  type BaseMapStatus,
  type InsightsSharePayload,
} from '../share-card-types';

/** Layout in card units (the card is 360 units wide). */
const U = {
  routeWidth: 3.2,
  distance: 41,
  meta: 16.5,
  oval: 25,
  ovalBorder: 1.6,
  ovalText: 16.5,
  footer: 15,
  footerLine: 19,
  attribution: 10,
} as const;
const ATTRIBUTION_BACKDROP = 0.7;

/** The poster's Mapbox Static base for a payload, size and theme, or null with nothing to frame. */
export function posterBaseUrl(
  payload: InsightsSharePayload,
  size: ShareSize,
  scheme: EditorialScheme,
): string | null {
  const bounds = payload.bounds ?? routesBounds(payload.routes);
  if (!bounds) return null;
  const base = POSTER_BASE[size];
  const style = scheme === EDITORIAL_SCHEME.DARK ? STATIC_STYLE.DARK : STATIC_STYLE.LIGHT;
  return staticMapUrl(style, posterViewport(bounds, size), base.width, base.height);
}

interface AtlasPosterCardProps {
  payload: InsightsSharePayload;
  size: ShareSize;
  /** Rendered width; everything scales with it. */
  width: number;
  /** The app theme, which the base map and panel follow. */
  scheme: EditorialScheme;
  /** The base image loaded (the poster is ready to capture) or failed (it is not). */
  onBaseSettled?: (status: BaseMapStatus) => void;
}

/**
 * The Pro season poster: the main region on a Mapbox Static base with the
 * routes drawn over it from the same camera, then the season distance, the
 * country plates, the share of twisty roads and the regions ridden.
 */
export const AtlasPosterCard = memo(function AtlasPosterCard({
  payload,
  size,
  width,
  scheme,
  onBaseSettled,
}: AtlasPosterCardProps) {
  const { t, i18n } = useTranslation();
  const theme = editorialThemes[scheme];
  const s = width / CARD_UNITS_WIDTH;
  const height = cardHeight(width, size);
  const base = POSTER_BASE[size];

  const { url, paths } = useMemo(() => {
    const bounds = payload.bounds ?? routesBounds(payload.routes);
    if (!bounds) return { url: null, paths: [] };
    const viewport = posterViewport(bounds, size);
    return {
      url: posterBaseUrl(payload, size, scheme),
      paths: payload.routes.map((route) =>
        route
          .map((point, i) => {
            const [x, y] = projectPoint(point, viewport, base.width, base.height);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(' '),
      ),
    };
  }, [payload, size, scheme, base.width, base.height]);

  const percent = new Intl.NumberFormat(i18n.language, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
  const footer = [
    ...payload.regionNames,
    payload.handle ? `@${payload.handle}` : null,
    // Brand name, not localized
    'MotoVault',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      testID="atlas-poster-card"
      collapsable={false}
      style={{ width, height, backgroundColor: theme.surface2, overflow: 'hidden' }}
    >
      {url ? (
        <Image
          testID="atlas-poster-base"
          source={{ uri: url }}
          style={{ position: 'absolute', width, height }}
          contentFit="cover"
          onLoad={() => onBaseSettled?.(BASE_MAP_STATUS.LOADED)}
          onError={() => onBaseSettled?.(BASE_MAP_STATUS.FAILED)}
        />
      ) : null}
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${base.width} ${base.height}`}
        style={{ position: 'absolute' }}
      >
        {paths.map((d, i) => (
          <Path
            // biome-ignore lint/suspicious/noArrayIndexKey: routes are an ordered, unkeyed list
            key={i}
            d={d}
            stroke={theme.warm}
            strokeWidth={(U.routeWidth * base.width) / CARD_UNITS_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>

      {/* Mapbox terms: the base map keeps its attribution visible. */}
      <Text
        allowFontScaling={false}
        style={{
          position: 'absolute',
          right: space.xs * s,
          bottom: (POSTER_PANEL_UNITS + space.xxs) * s,
          paddingHorizontal: space.xxs * s,
          fontSize: U.attribution * s,
          color: theme.ink3,
          backgroundColor: tint(theme.surface, ATTRIBUTION_BACKDROP),
        }}
      >
        {/* Map data credit, not localized */}
        {'© Mapbox © OpenStreetMap'}
      </Text>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: POSTER_PANEL_UNITS * s,
          paddingHorizontal: space.md * s,
          paddingTop: space.sm * s,
          gap: space.xs * s,
          backgroundColor: theme.surface,
        }}
      >
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              fontFamily: PLATE_FONT.semibold,
              fontVariant: ['tabular-nums'],
              fontSize: U.distance * s,
              lineHeight: U.distance * s,
              color: theme.ink,
            }}
          >
            {formatInsightDistance(payload.distanceM, payload.measurementSystem, i18n.language)}
          </Text>
          <Text allowFontScaling={false} style={{ fontSize: U.meta * s, color: theme.ink3 }}>
            {t('riderInsights.share.ridesYear', {
              count: payload.rides,
              year: payload.seasonYear,
            })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs * s }}>
          {payload.plates.map((plate) => (
            <View
              key={plate}
              style={{
                height: U.oval * s,
                paddingHorizontal: space.xs * s,
                borderRadius: (U.oval * s) / 2,
                borderWidth: U.ovalBorder * s,
                borderColor: theme.ink,
                justifyContent: 'center',
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: PLATE_FONT.semibold,
                  fontSize: U.ovalText * s,
                  color: theme.ink,
                }}
              >
                {plate}
              </Text>
            </View>
          ))}
          <View style={{ flex: 1 }} />
          {payload.twistyShare !== null ? (
            <Text allowFontScaling={false} style={{ fontSize: U.meta * s, color: theme.ink2 }}>
              {t('riderInsights.share.twisty', { share: percent.format(payload.twistyShare) })}
            </Text>
          ) : null}
        </View>

        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            ...SYSTEM_WEIGHT.regular,
            fontSize: U.footer * s,
            lineHeight: U.footerLine * s,
            color: theme.ink3,
          }}
        >
          {footer}
        </Text>
      </View>
    </View>
  );
});
