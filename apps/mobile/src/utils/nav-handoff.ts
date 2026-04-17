/**
 * Pure URL builders for handing a route/trip off to external navigation apps.
 *
 * No React Native imports on purpose — every function here is unit-tested in Jest
 * and must run in a plain Node context. Platform + canOpenURL checks live in the
 * consumer (useRideThis hook).
 *
 * Source contracts:
 *   Apple Maps:   https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
 *   Google Maps:  https://developers.google.com/maps/documentation/urls/get-started#directions-action
 *   Waze:         https://developers.google.com/waze/deeplinks
 */

export interface NavWaypoint {
  lat: number;
  lng: number;
  name?: string | null;
}

/** Apple Maps allows chaining destinations via `+to:` starting from iOS 16. */
const APPLE_MULTI_DEST_MIN_IOS = 16;

/**
 * Google Maps universal `/maps/dir/?api=1` supports origin + destination + up to
 * 9 intermediate waypoints = 10 real coordinates per URL. Chunks overlap on the
 * last point so the rider transitions from segment N to N+1 without teleport.
 */
export const GOOGLE_MAX_POINTS_PER_URL = 10;

/**
 * Rounds to 6dp (~11 cm at the equator — plenty for nav handoff) and rejects
 * NaN/Infinity/out-of-range. Callers upstream already filter invalid rows,
 * but a bogus deep link or cached trip from another region could still
 * sneak a `lat: NaN` into the URL and open Maps at `NaN,NaN` otherwise.
 */
const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 1e6) / 1e6;
  return rounded.toString();
};

function isValidCoord(w: NavWaypoint): boolean {
  return (
    Number.isFinite(w.lat) &&
    Number.isFinite(w.lng) &&
    Math.abs(w.lat) <= 90 &&
    Math.abs(w.lng) <= 180
  );
}

const coord = (w: NavWaypoint): string => `${fmt(w.lat)},${fmt(w.lng)}`;

/**
 * Returns a chain of `/maps?saddr=…&daddr=…+to:…` URLs for Apple Maps.
 *
 * - Fewer than 2 waypoints → returns null (caller should keep row disabled).
 * - iOS version < 16 → falls back to first → last only; the sheet surfaces that
 *   visually with a disclaimer subtitle.
 */
export function buildAppleMapsUrl(
  waypoints: NavWaypoint[],
  opts: { iosMajorVersion?: number } = {},
): string | null {
  const valid = waypoints.filter(isValidCoord);
  if (valid.length < 2) return null;

  const supportsMultiDest =
    (opts.iosMajorVersion ?? APPLE_MULTI_DEST_MIN_IOS) >= APPLE_MULTI_DEST_MIN_IOS;
  const start = valid[0];

  if (!supportsMultiDest || valid.length === 2) {
    const end = valid[valid.length - 1];
    return `maps://?saddr=${coord(start)}&daddr=${coord(end)}&dirflg=d`;
  }

  const destParts = valid
    .slice(1)
    .map((w, i) => (i === 0 ? coord(w) : `+to:${coord(w)}`))
    .join('');
  return `maps://?saddr=${coord(start)}&daddr=${destParts}&dirflg=d`;
}

/**
 * Splits waypoints into Google-Maps-sized chunks with a 1-point overlap so that
 * the last destination of chunk N is the start of chunk N+1.
 *
 * Example: 14 waypoints → 2 chunks of size 10 and 5, where wp[9] appears in both.
 */
export function chunkWaypointsForGoogle(waypoints: NavWaypoint[]): NavWaypoint[][] {
  if (waypoints.length <= GOOGLE_MAX_POINTS_PER_URL) return [waypoints.slice()];

  const chunks: NavWaypoint[][] = [];
  let cursor = 0;
  while (cursor < waypoints.length - 1) {
    const end = Math.min(cursor + GOOGLE_MAX_POINTS_PER_URL, waypoints.length);
    chunks.push(waypoints.slice(cursor, end));
    if (end >= waypoints.length) break;
    // Overlap: next chunk starts at the last stop of this one.
    cursor = end - 1;
  }
  return chunks;
}

/**
 * Returns one Google Maps directions URL per chunk. `chunked` is true whenever
 * more than one URL is needed.
 */
export function buildGoogleMapsUrls(waypoints: NavWaypoint[]): {
  urls: string[];
  chunked: boolean;
} {
  const valid = waypoints.filter(isValidCoord);
  if (valid.length < 2) return { urls: [], chunked: false };

  const chunks = chunkWaypointsForGoogle(valid);
  const urls = chunks.map((chunk) => {
    const origin = coord(chunk[0]);
    const destination = coord(chunk[chunk.length - 1]);
    const params = new URLSearchParams({
      api: '1',
      origin,
      destination,
      travelmode: 'driving',
    });
    const mid = chunk.slice(1, -1);
    if (mid.length > 0) {
      params.set('waypoints', mid.map(coord).join('|'));
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  });

  return { urls, chunked: urls.length > 1 };
}

/**
 * Waze has no multi-stop URL scheme. We return one URL per waypoint after the
 * starting point, and the sheet walks the rider through each one in turn.
 *
 * The first entry is the *first leg's destination* (waypoints[1]), matching
 * how Waze treats "navigate to here" — the user is assumed to already be at
 * waypoints[0] when they tap the handoff.
 */
export function buildWazeUrls(waypoints: NavWaypoint[]): string[] {
  const filtered = waypoints.filter(isValidCoord);
  if (filtered.length < 2) return [];
  return filtered.slice(1).map((w) => `waze://?ll=${coord(w)}&navigate=yes`);
}

/**
 * Convenience: total segment count we'll ask the rider to step through.
 * Used by the sheet to render "Segment 1 of N" copy.
 */
export function segmentCountForProvider(
  provider: 'apple' | 'google' | 'waze' | 'gpx',
  waypoints: NavWaypoint[],
): number {
  switch (provider) {
    case 'apple':
    case 'gpx':
      return waypoints.length >= 2 ? 1 : 0;
    case 'google':
      return buildGoogleMapsUrls(waypoints).urls.length;
    case 'waze':
      return buildWazeUrls(waypoints).length;
  }
}
