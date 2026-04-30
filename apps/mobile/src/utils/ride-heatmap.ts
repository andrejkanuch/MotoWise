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

/**
 * Encode an array of [lat, lng] pairs into a Google-encoded polyline string.
 */
export function encodePolyline(points: [number, number][]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    encoded += encodeSignedValue(latE5 - prevLat);
    encoded += encodeSignedValue(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }
  return encoded;
}

function encodeSignedValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let encoded = '';
  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
}

/**
 * Decode a Google-encoded polyline into [lat, lng] pairs.
 *
 * (We duplicated this in two other screens; keep that form because the
 * decoder is ~30 lines and cheaper than another import.)
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

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
