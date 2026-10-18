/**
 * Ride heatmap helpers.
 *
 * Pulls rides client-side (paginated via useInfiniteQuery) and derives:
 *  - GeoJSON MultiLineString for Mapbox rendering
 *  - annual recap stats (distance / ride count / top ride / countries)
 *
 * We intentionally keep this pure + synchronous so it's trivial to unit test
 * and doesn't re-run on every re-render when memoised.
 */

// Polyline codec lives in ./polyline (single source of truth). These re-exports
// preserve this module's historical [lat, lng] surface: `encodePolyline` is
// identical, and heatmap's `decodePolyline` returns [lat, lng] pairs — exactly
// what `decodePolylineLatLng` produces.
import type { TFunction } from 'i18next';
import { decodePolylineLatLng, encodePolyline } from './polyline';

export { encodePolyline };

/** Decode a Google-encoded polyline into [lat, lng] pairs. */
export const decodePolyline = decodePolylineLatLng;

export interface HeatmapRide {
  id: string;
  startedAt: string;
  distanceM?: number | null;
  routePolyline?: string | null;
  region?: string | null;
  name?: string | null;
}

export interface HeatmapFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: { rideId: string };
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  }>;
}

/**
 * Decode every ride with a polyline into a GeoJSON FeatureCollection suitable
 * for a single MapboxGL.ShapeSource + LineLayer with low opacity to produce a
 * "Strava-style" heatmap as lines stack up on popular roads.
 */
export function buildHeatmapFeatureCollection(rides: HeatmapRide[]): HeatmapFeatureCollection {
  const features: HeatmapFeatureCollection['features'] = [];
  for (const ride of rides) {
    const encoded = ride.routePolyline;
    if (!encoded) continue;
    const decoded = decodePolyline(encoded);
    if (decoded.length < 2) continue;
    features.push({
      type: 'Feature',
      properties: { rideId: ride.id },
      geometry: {
        type: 'LineString',
        // Mapbox expects [lng, lat] while our decoder returns [lat, lng].
        coordinates: decoded.map(([lat, lng]) => [lng, lat]),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export interface AnnualRecap {
  year: number;
  rideCount: number;
  totalDistanceM: number;
  countries: string[];
  /** Rider's longest single ride that year. */
  longestRide?: { id: string; distanceM: number; name?: string | null };
}

/**
 * Derive a shareable "year in rides" summary from the rides list.
 */
export function buildAnnualRecap(rides: HeatmapRide[], year: number): AnnualRecap {
  let total = 0;
  let longest: AnnualRecap['longestRide'];
  const countries = new Set<string>();
  let count = 0;

  for (const ride of rides) {
    const started = new Date(ride.startedAt);
    if (started.getFullYear() !== year) continue;
    count += 1;
    const dist = ride.distanceM ?? 0;
    total += dist;
    if (ride.region) countries.add(ride.region);
    if (!longest || dist > (longest.distanceM ?? 0)) {
      longest = { id: ride.id, distanceM: dist, name: ride.name ?? null };
    }
  }

  return {
    year,
    rideCount: count,
    totalDistanceM: total,
    countries: Array.from(countries).sort(),
    longestRide: longest,
  };
}

/**
 * Lifetime totals across the rider's full history — the headline number on
 * the heatmap screen.
 */
export function buildLifetimeTotals(rides: HeatmapRide[]): {
  rideCount: number;
  totalDistanceM: number;
  countries: string[];
} {
  let total = 0;
  const countries = new Set<string>();
  let count = 0;
  for (const ride of rides) {
    count += 1;
    total += ride.distanceM ?? 0;
    if (ride.region) countries.add(ride.region);
  }
  return {
    rideCount: count,
    totalDistanceM: total,
    countries: Array.from(countries).sort(),
  };
}

/** Space between the ridden lines and the map's edge, in points. */
const HEATMAP_BOUNDS_PADDING = 40;

/** [lng, lat] corners of the box around every ridden line, padded, as Mapbox's Camera takes them. */
export interface HeatmapBounds {
  ne: [number, number];
  sw: [number, number];
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
}

/**
 * The box around all of the rider's lines, so the map opens on where they ride
 * instead of a whole-world view. Null when there is nothing to frame.
 */
export function heatmapBounds(collection: HeatmapFeatureCollection): HeatmapBounds | null {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const feature of collection.features) {
    for (const [lng, lat] of feature.geometry.coordinates) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  }
  if (!Number.isFinite(minLng)) return null;
  return {
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
    paddingTop: HEATMAP_BOUNDS_PADDING,
    paddingBottom: HEATMAP_BOUNDS_PADDING,
    paddingLeft: HEATMAP_BOUNDS_PADDING,
    paddingRight: HEATMAP_BOUNDS_PADDING,
  };
}

/** The text the rider shares for their year: localised, in their distance unit. */
export function buildRecapShareMessage(
  recap: AnnualRecap,
  t: TFunction,
  formatDistance: (meters: number) => string,
): string {
  const { countries, longestRide } = recap;
  const lines = [
    t('heatmap.shareIntro', {
      year: recap.year,
      distance: formatDistance(recap.totalDistanceM),
      count: recap.rideCount,
    }),
  ];
  if (countries.length > 0) {
    lines.push(
      t('heatmap.shareCountries', { count: countries.length, list: countries.join(', ') }),
    );
  }
  if (longestRide?.name) {
    const distance = formatDistance(longestRide.distanceM);
    lines.push(t('heatmap.shareTopRide', { name: longestRide.name, distance }));
  }
  lines.push(t('heatmap.shareVia'));
  return lines.join('\n');
}
