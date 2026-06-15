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

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Fetch a driving route from the Mapbox Directions API.
 *
 * @param coordinates - Ordered waypoints (min 2, max 25).
 * @returns The parsed route or `null` on failure.
 */
export async function getRouteSegments(
  coordinates: Array<{ lat: number; lng: number }>,
  signal?: AbortSignal,
): Promise<RouteResult | null> {
  if (coordinates.length < MIN_WAYPOINTS) {
    logger.warn(
      `[mapbox-directions] Need at least ${MIN_WAYPOINTS} coordinates, got ${coordinates.length}`,
    );
    return null;
  }

  if (coordinates.length > MAX_WAYPOINTS) {
    throw new Error(
      `Mapbox Directions supports at most ${MAX_WAYPOINTS} waypoints, received ${coordinates.length}`,
    );
  }

  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    logger.warn('[mapbox-directions] EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set');
    return null;
  }

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
