import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useEditorialTheme } from '@/theme/editorial';
import { layout, space } from '@/theme/spacing';
import { PLATE_FONT, type } from '@/theme/type';
import { triggerSelection } from '@/utils/haptics';
import { decodePolyline, simplifyEncodedPolyline } from '@/utils/polyline';
import { fitViewport, projectPoint, type Viewport } from './map-viewport';
import type { RiderInsightsRegion } from './use-rider-insights';

/** Points kept per route when drawing it as SVG. */
const ROUTE_POINTS = 200;
const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1/mapbox';

/** One encoded route (precision 5) as an SVG path in the viewport's box. */
export function routeSvgPath(
  encoded: string,
  viewport: Viewport,
  width: number,
  height: number,
): string {
  const points = decodePolyline(simplifyEncodedPolyline(encoded, ROUTE_POINTS));
  return points
    .map((point, i) => {
      const [x, y] = projectPoint(point, viewport, width, height);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export const STATIC_STYLE = { LIGHT: 'light-v11', DARK: 'dark-v11' } as const;
type StaticStyle = (typeof STATIC_STYLE)[keyof typeof STATIC_STYLE];

/**
 * A Mapbox Static image of the bare map at an explicit center and zoom, with no
 * overlays: the routes are drawn on top as SVG from the same viewport. Null
 * without an access token.
 */
export function staticMapUrl(
  style: StaticStyle,
  viewport: Viewport,
  width: number,
  height: number,
): string | null {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;
  const [lng, lat] = viewport.center;
  const size = `${Math.round(width)}x${Math.round(height)}@2x`;
  return `${MAPBOX_STATIC_BASE}/${style}/static/${lng.toFixed(5)},${lat.toFixed(5)},${viewport.zoom}/${size}?access_token=${token}&attribution=false&logo=false`;
}

/**
 * The region order after a tile tap: the tapped tile and the main region trade
 * places, and every other tile stays where it was.
 */
export function swapMainRegion(
  regions: readonly RiderInsightsRegion[],
  key: string,
): RiderInsightsRegion[] {
  const index = regions.findIndex((region) => region.key === key);
  if (index <= 0) return [...regions];
  const next = [...regions];
  [next[0], next[index]] = [next[index], next[0]];
  return next;
}

// ── Tiles ────────────────────────────────────────────────────────────────────

/** In-app static images stay at or under 640 logical px per side. */
const MAX_TILE_SIDE = 640;
const TILE_RADIUS = 12;
const TILE_PADDING = 8;
const TILE_ROUTE_WIDTH = 1.5;
const TILE_COLUMNS = 3;

interface RegionTilesProps {
  /** The regions after the main one (at most three). */
  tiles: readonly RiderInsightsRegion[];
  /** Width of the row the tiles share. */
  width: number;
  formatMeta: (region: RiderInsightsRegion) => string;
  regionName: (region: RiderInsightsRegion) => string;
  onSelect: (key: string) => void;
}

/**
 * Other riding regions as small static map tiles under a short heading that
 * says what they are; a tap shows that region on the main map.
 */
export function RegionTiles({ tiles, width, formatMeta, regionName, onSelect }: RegionTilesProps) {
  const { t: i18n } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const side = Math.min(MAX_TILE_SIDE, (width - space.sm * (TILE_COLUMNS - 1)) / TILE_COLUMNS);

  return (
    <View testID="region-tiles" style={{ gap: space.xs, paddingTop: space.xs }}>
      <View style={{ gap: layout.titleGap, marginHorizontal: space.md }}>
        <Text accessibilityRole="header" style={[type.label, { color: t.ink3 }]}>
          {i18n('riderInsights.regions.heading')}
        </Text>
        <Text style={[type.caption, { color: t.ink3 }]}>
          {i18n('riderInsights.regions.caption')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {tiles.map((region) => {
          const name = regionName(region);
          const viewport = region.bounds
            ? fitViewport(region.bounds, side, side, TILE_PADDING)
            : null;
          const url = viewport
            ? staticMapUrl(isDark ? STATIC_STYLE.DARK : STATIC_STYLE.LIGHT, viewport, side, side)
            : null;
          return (
            <Pressable
              key={region.key}
              testID={`region-tile-${region.key}`}
              accessibilityRole="button"
              accessibilityLabel={i18n('riderInsights.regions.tileA11y', { region: name })}
              onPress={() => {
                triggerSelection();
                onSelect(region.key);
              }}
              style={({ pressed }) => ({ width: side, gap: space.xxs, opacity: pressed ? 0.7 : 1 })}
            >
              <View
                style={{
                  width: side,
                  height: side,
                  borderRadius: TILE_RADIUS,
                  borderCurve: 'continuous',
                  overflow: 'hidden',
                  backgroundColor: t.surface2,
                }}
              >
                {url ? <Image source={{ uri: url }} style={{ width: side, height: side }} /> : null}
                {viewport ? (
                  <Svg width={side} height={side} style={{ position: 'absolute' }}>
                    {region.routes.map((route, i) => (
                      <Path
                        // biome-ignore lint/suspicious/noArrayIndexKey: routes are an ordered, unkeyed list
                        key={i}
                        d={routeSvgPath(route, viewport, side, side)}
                        stroke={t.warm}
                        strokeWidth={TILE_ROUTE_WIDTH}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    ))}
                  </Svg>
                ) : null}
              </View>
              <Text style={[type.caption, { color: t.ink2 }]}>{name}</Text>
              <Text
                style={{
                  fontFamily: PLATE_FONT.medium,
                  fontSize: 15,
                  lineHeight: 16,
                  fontVariant: ['tabular-nums'],
                  color: t.ink3,
                }}
              >
                {formatMeta(region)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
