import { logger } from '../lib/logger';

const MAPBOX_BASE_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';
const MAX_WAYPOINTS = 25;
const MIN_WAYPOINTS = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteLeg {
  distanceM: number;
  durationS: number;
}

export interface RouteResult {
  totalDistanceM: number;
  totalDurationS: number;
  legs: RouteLeg[];
  geometry: GeoJSON.LineString;
}

interface MapboxLeg {
  distance: number;
  duration: number;
}

interface MapboxRoute {
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString;
  legs: MapboxLeg[];
}

interface MapboxDirectionsResponse {
  code: string;
  routes: MapboxRoute[];
}

type Coordinate = { lat: number; lng: number };

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * Mapbox Directions caps each request at {@link MAX_WAYPOINTS} coordinates.
 * Longer trips are split into windows that overlap by one point, so the last
 * waypoint of window N is the first of window N+1. Stitched back together
 * (see {@link stitchRoutes}) this yields a single continuous route that visits
 * every waypoint — with no double-counted legs, since each overlap point
 * contributes its leg to exactly one window.
 *
 * Example: 49 waypoints (MAX 25) → windows of [0..24] and [24..48], sharing
 * waypoint 24.
 */
export function chunkCoordinates(coordinates: Coordinate[]): Coordinate[][] {
  if (coordinates.length <= MAX_WAYPOINTS) return [coordinates.slice()];

  const chunks: Coordinate[][] = [];
  let cursor = 0;
  while (cursor < coordinates.length - 1) {
    const end = Math.min(cursor + MAX_WAYPOINTS, coordinates.length);
    chunks.push(coordinates.slice(cursor, end));
    if (end >= coordinates.length) break;
    // Overlap: next window starts at this window's last waypoint.
    cursor = end - 1;
  }
  return chunks;
}

/**
 * Concatenates the per-window {@link RouteResult}s into one route. Geometry is
 * joined by dropping each subsequent window's first coordinate (the seam point
 * it shares with the previous window's last coordinate).
 */
function stitchRoutes(routes: RouteResult[]): RouteResult {
  if (routes.length === 1) return routes[0];

  const legs: RouteLeg[] = [];
  const coordinates: GeoJSON.Position[] = [];
  let totalDistanceM = 0;
  let totalDurationS = 0;

  for (const route of routes) {
    totalDistanceM += route.totalDistanceM;
    totalDurationS += route.totalDurationS;
    legs.push(...route.legs);
    const coords = route.geometry.coordinates;
    // First window contributes its full geometry; later windows drop the seam
    // point already emitted by the previous window.
    coordinates.push(...(coordinates.length === 0 ? coords : coords.slice(1)));
  }

  return {
    totalDistanceM,
    totalDurationS,
    legs,
    geometry: { type: 'LineString', coordinates },
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Fetch a single Mapbox Directions leg-set. Assumes `coordinates.length` is
 * within [{@link MIN_WAYPOINTS}, {@link MAX_WAYPOINTS}].
 *
 * @returns The parsed route or `null` on any failure (network, HTTP, API code).
 */
async function fetchDirections(
  coordinates: Coordinate[],
  token: string,
  signal?: AbortSignal,
): Promise<RouteResult | null> {
  // Mapbox expects lng,lat order, semicolon-separated
  const coords = coordinates.map((c) => `${c.lng},${c.lat}`).join(';');
  const url = `${MAPBOX_BASE_URL}/${coords}?access_token=${token}&geometries=geojson&overview=full`;

  try {
    const response = await fetch(url, signal ? { signal } : undefined);

    if (!response.ok) {
      logger.warn(`[mapbox-directions] HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data: MapboxDirectionsResponse = await response.json();

    if (data.code !== 'Ok' || data.routes.length === 0) {
      logger.warn(`[mapbox-directions] API returned code "${data.code}" with no routes`);
      return null;
    }

    const route = data.routes[0];

    return {
      totalDistanceM: route.distance,
      totalDurationS: route.duration,
      legs: route.legs.map((leg) => ({
        distanceM: leg.distance,
        durationS: leg.duration,
      })),
      geometry: route.geometry,
    };
  } catch (error) {
    logger.warn('[mapbox-directions] Request failed:', error);
    return null;
  }
}

/**
 * Fetch a driving route from the Mapbox Directions API.
 *
 * Trips longer than {@link MAX_WAYPOINTS} are transparently split into
 * overlapping windows and stitched back together, so callers can pass an
 * arbitrary number of waypoints without hitting the API's per-request cap.
 *
 * @param coordinates - Ordered waypoints (min 2, no upper bound).
 * @returns The parsed route or `null` on failure. Never throws — callers rely
 *   on `null` to fall back to straight-line geometry.
 */
export async function getRouteSegments(
  coordinates: Coordinate[],
  signal?: AbortSignal,
): Promise<RouteResult | null> {
  if (coordinates.length < MIN_WAYPOINTS) {
    logger.warn(
      `[mapbox-directions] Need at least ${MIN_WAYPOINTS} coordinates, got ${coordinates.length}`,
    );
    return null;
  }

  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    logger.warn('[mapbox-directions] EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set');
    return null;
  }

  const windows = chunkCoordinates(coordinates);
  const segments: RouteResult[] = [];
  for (const window of windows) {
    const segment = await fetchDirections(window, token, signal);
    // Any failed window invalidates the whole route — bail to the caller's
    // straight-line fallback rather than drawing a partial, misleading path.
    if (!segment) return null;
    segments.push(segment);
  }

  return stitchRoutes(segments);
}
