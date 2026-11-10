import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { PLATE_FONT, type } from '@/theme/type';
import { triggerSelection } from '@/utils/haptics';
import { decodePolyline, simplifyEncodedPolyline } from '@/utils/polyline';
import type { RiderInsightsRegion } from './use-rider-insights';

// ── Web Mercator, as Mapbox draws it (512 px tiles) ──────────────────────────

const TILE_SIZE = 512;
const MAX_ZOOM = 16;
/** Zoom for a region whose rides all start and end in one spot. */
const POINT_ZOOM = 13;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
/** Points kept per route when drawing it as SVG. */
const ROUTE_POINTS = 200;
const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1/mapbox';

export interface Viewport {
  /** [lng, lat] */
  center: [number, number];
  zoom: number;
}

const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => {
  const phi = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2;
};
const lngFromX = (x: number) => x * 360 - 180;
const latFromY = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

/**
 * The center and zoom that fit `bounds` ([west, south, east, north]) inside a
 * `width` x `height` box with `padding` on every side. Computed on the device
 * so the live map, a static image and its SVG routes all share one camera.
 */
export function fitViewport(
  bounds: readonly number[],
  width: number,
  height: number,
  padding: number,
): Viewport {
  const [west, south, east, north] = bounds;
  const x0 = mercX(west);
  const x1 = mercX(east);
  const y0 = mercY(north);
  const y1 = mercY(south);
  const center: [number, number] = [lngFromX((x0 + x1) / 2), latFromY((y0 + y1) / 2)];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  if (dx === 0 && dy === 0) return { center, zoom: POINT_ZOOM };
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : (width - 2 * padding) / (dx * TILE_SIZE);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : (height - 2 * padding) / (dy * TILE_SIZE);
  const zoom = Math.min(MAX_ZOOM, Math.max(0, Math.log2(Math.min(scaleX, scaleY))));
  return { center, zoom: Math.round(zoom * 100) / 100 };
}

/** A [lng, lat] point in a `width` x `height` box centred on the viewport. */
export function projectPoint(
  [lng, lat]: readonly [number, number],
  viewport: Viewport,
  width: number,
  height: number,
): [number, number] {
  const world = TILE_SIZE * 2 ** viewport.zoom;
  const x = (mercX(lng) - mercX(viewport.center[0])) * world + width / 2;
  const y = (mercY(lat) - mercY(viewport.center[1])) * world + height / 2;
  return [x, y];
}

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

/** Ground metres one logical pixel covers at the viewport's center. */
export function metersPerPixel(viewport: Viewport): number {
  const lat = (viewport.center[1] * Math.PI) / 180;
  return (EARTH_CIRCUMFERENCE_M * Math.cos(lat)) / (TILE_SIZE * 2 ** viewport.zoom);
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

/** Other riding regions as small static map tiles; a tap shows that region on the main map. */
export function RegionTiles({ tiles, width, formatMeta, regionName, onSelect }: RegionTilesProps) {
  const { t: i18n } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const side = Math.min(MAX_TILE_SIDE, (width - space.sm * (TILE_COLUMNS - 1)) / TILE_COLUMNS);

  return (
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
  );
}
