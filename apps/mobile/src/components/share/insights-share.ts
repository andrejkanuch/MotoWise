/**
 * The season share images' data: the routes to draw (with the ride ends
 * trimmed off when the rider asks), the numbers and labels on each image, the
 * camera the Atlas poster shares with its Mapbox Static base, and the key a
 * captured image is cached under. Pure, so the images and the sheet stay thin.
 */
import type { MeasurementSystem } from '@motovault/types';
import { plateLettersFor } from '@/features/rider-insights/country-codes';
import { fitViewport, type Viewport } from '@/features/rider-insights/map-viewport';
import type {
  RiderInsightsData,
  RiderInsightsRegion,
} from '@/features/rider-insights/use-rider-insights';
import { haversineDistance } from '@/utils/geo-utils';
import { decodePolyline } from '@/utils/polyline';
import type { InsightsSharePayload, LngLat } from './share-card-types';

export const INSIGHTS_SHARE_IMAGE = {
  SEASON_LINES: 'seasonLines',
  ATLAS_POSTER: 'atlasPoster',
} as const;
export type InsightsShareImage = (typeof INSIGHTS_SHARE_IMAGE)[keyof typeof INSIGHTS_SHARE_IMAGE];

export const SHARE_SIZE = { FEED: 'feed', STORY: 'story' } as const;
export type ShareSize = (typeof SHARE_SIZE)[keyof typeof SHARE_SIZE];

export interface PixelSize {
  width: number;
  height: number;
}

/** The exported image in pixels: 4:5 for a feed post, 9:16 for a story. */
export const SHARE_EXPORT_PX: Record<ShareSize, PixelSize> = {
  [SHARE_SIZE.FEED]: { width: 1080, height: 1350 },
  [SHARE_SIZE.STORY]: { width: 1080, height: 1920 },
};

/**
 * The poster's Mapbox Static base in logical pixels, requested at @2x so it
 * lands at the export's 1080 px width. The Static API caps a side at 1,280 px.
 */
export const POSTER_BASE: Record<ShareSize, PixelSize> = {
  [SHARE_SIZE.FEED]: { width: 540, height: 675 },
  [SHARE_SIZE.STORY]: { width: 540, height: 960 },
};

/** Every card is laid out on a 360-unit-wide grid and scaled to the width it renders at. */
export const CARD_UNITS_WIDTH = 360;

/** Height of a card of `width` in `size`. */
export function cardHeight(width: number, size: ShareSize): number {
  const px = SHARE_EXPORT_PX[size];
  return (width * px.height) / px.width;
}

/** "Hide ride start and end" trims this much off each end of every ride. */
export const END_TRIM_M = 500;
/** Less route than this left after the trim is nothing to draw. */
const MIN_DRAWN_M = 1;
/** Points kept per route when it is drawn. */
const DRAWN_POINTS = 200;

const lengthOf = (a: LngLat, b: LngLat) => haversineDistance(a[1], a[0], b[1], b[0]);

/**
 * The route with `trimM` metres removed from each end, cut exactly at that
 * distance along the route. A route no longer than both cuts together (within
 * a metre) leaves nothing to draw, so it comes back empty.
 */
export function trimRouteEnds(points: readonly LngLat[], trimM: number): LngLat[] {
  if (points.length < 2) return [];
  const along = [0];
  for (let i = 1; i < points.length; i++) {
    along.push(along[i - 1] + lengthOf(points[i - 1], points[i]));
  }
  const total = along[along.length - 1];
  if (total - 2 * trimM < MIN_DRAWN_M) return [];

  const pointAt = (distance: number): LngLat => {
    const i = Math.max(
      0,
      along.findIndex((d) => d >= distance),
    );
    if (i === 0) return points[0];
    const span = along[i] - along[i - 1];
    const f = span > 0 ? (distance - along[i - 1]) / span : 0;
    const [aLng, aLat] = points[i - 1];
    const [bLng, bLat] = points[i];
    return [aLng + (bLng - aLng) * f, aLat + (bLat - aLat) * f];
  };

  const start = trimM;
  const end = total - trimM;
  const inner = points.filter((_, i) => along[i] > start && along[i] < end);
  return [pointAt(start), ...inner, pointAt(end)];
}

/** At most `max` points, evenly spaced along the list, keeping both ends. */
function samplePoints(points: LngLat[], max: number): LngLat[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

/** The routes to draw, decoded, with the ride ends trimmed when `hideEnds` is on. */
export function shareRoutes(encoded: readonly string[], hideEnds: boolean): LngLat[][] {
  return encoded
    .map((route) => {
      const points = decodePolyline(route);
      return samplePoints(hideEnds ? trimRouteEnds(points, END_TRIM_M) : points, DRAWN_POINTS);
    })
    .filter((points) => points.length >= 2);
}

/** Share of routed distance on twisty or tight roads; null for a rider without Pro. */
function twistyShare(insights: RiderInsightsData): number | null {
  const detail = insights.roadCharacter.detail;
  if (!insights.isPro || !detail) return null;
  const { straight, sweeping, twisty, tight } = detail.bandKm;
  const total = straight + sweeping + twisty + tight;
  return total > 0 ? (twisty + tight) / total : null;
}

/** Regions named on the poster's footer. */
const POSTER_REGIONS = 3;

interface PayloadInput {
  insights: RiderInsightsData;
  /** Regions in the order the screen shows them; the first is on the main map. */
  regions: readonly RiderInsightsRegion[];
  regionName: (region: RiderInsightsRegion) => string;
  hideEnds: boolean;
  handle: string | null;
  measurementSystem: MeasurementSystem;
}

/**
 * Everything the two season images draw. Lean never goes in: neither image
 * carries it. Road character is carried only for a Pro rider.
 */
export function buildInsightsSharePayload({
  insights,
  regions,
  regionName,
  hideEnds,
  handle,
  measurementSystem,
}: PayloadInput): InsightsSharePayload {
  const main = regions[0] ?? null;
  return {
    cacheId: `insights-${insights.season.from}-${main?.key ?? 'none'}`,
    seasonYear: Number(insights.season.from.slice(0, 4)),
    regionName: main ? regionName(main) : null,
    regionNames: regions.slice(0, POSTER_REGIONS).map(regionName),
    bounds: main?.bounds ?? null,
    routes: main ? shareRoutes(main.routes, hideEnds) : [],
    distanceM: insights.totals.distanceM,
    rides: insights.totals.rides,
    plates: insights.countries.map((country) => plateLettersFor(country.isoA2)),
    twistyShare: twistyShare(insights),
    handle,
    measurementSystem,
  };
}

/** [west, south, east, north] around every point of the routes, or null with none. */
export function routesBounds(routes: readonly LngLat[][]): number[] | null {
  const points = routes.flat();
  if (points.length === 0) return null;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

// ── Poster camera ────────────────────────────────────────────────────────────

const TILE_SIZE = 512;
const mercY = (lat: number) => {
  const phi = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2;
};
const latFromY = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

/** The poster's info panel, in card units, which the routes are kept clear of. */
export const POSTER_PANEL_UNITS = 136;
/** Space between the routes and the map area's edges, in card units. */
const POSTER_MAP_PADDING_UNITS = 28;

/**
 * The poster's camera over its Static base (`POSTER_BASE[size]`): the bounds
 * fit the map area above the info panel, and the center moves down so the
 * image's middle sits where the base's middle is. Routes projected with this
 * viewport over a base box land on the base's roads.
 */
export function posterViewport(bounds: readonly number[], size: ShareSize): Viewport {
  const base = POSTER_BASE[size];
  const perUnit = base.width / CARD_UNITS_WIDTH;
  const mapHeight = base.height - POSTER_PANEL_UNITS * perUnit;
  const fitted = fitViewport(bounds, base.width, mapHeight, POSTER_MAP_PADDING_UNITS * perUnit);
  const world = TILE_SIZE * 2 ** fitted.zoom;
  const shiftY = (base.height - mapHeight) / 2 / world;
  return {
    center: [fitted.center[0], latFromY(mercY(fitted.center[1]) + shiftY)],
    zoom: fitted.zoom,
  };
}

// ── Cache key ────────────────────────────────────────────────────────────────

/** FNV-1a over a string, as 8 hex digits: a short, stable data fingerprint. */
export function hashString(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

interface CacheKeyInput {
  image: InsightsShareImage;
  size: ShareSize;
  scheme: 'light' | 'dark';
  fontScale: number;
  payload: InsightsSharePayload;
}

/**
 * The file a captured image is cached under. Any change to the image choice,
 * the size, the theme, the font scale or the drawn data (which includes the
 * trimmed routes) gives a new key, so a stale capture is never shared.
 */
export function insightsShareCacheKey({
  image,
  size,
  scheme,
  fontScale,
  payload,
}: CacheKeyInput): string {
  const scale = Math.round(fontScale * 100);
  return `${payload.cacheId}-${image}-${size}-${scheme}-fs${scale}-${hashString(JSON.stringify(payload))}`;
}
