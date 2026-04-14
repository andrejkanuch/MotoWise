/**
 * Static map image provider — builds URLs for Mapbox Static Images API.
 * Used by route detail pages to render a map with the route polyline.
 */

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN ?? '';
const BASE = 'https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static';

/** Mapbox Static API has a ~8192 char URL limit. Keep well under. */
const MAX_URL_LENGTH = 7500;

export interface StaticMapOptions {
  /** Encoded polyline (Google format) */
  polyline: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Stroke color as hex (without #) */
  strokeColor?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Stroke opacity 0-1 */
  strokeOpacity?: number;
  /** Retina (@2x) */
  retina?: boolean;
  /** Optional padding in percent */
  padding?: number;
}

/**
 * Simplify a Google-encoded polyline by sampling every Nth point.
 * This reduces URL length while preserving the route shape.
 */
function simplifyEncodedPolyline(encoded: string, maxPoints: number): string {
  // Decode
  const coords: [number, number][] = [];
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

    coords.push([lat / 1e5, lng / 1e5]);
  }

  if (coords.length <= maxPoints) {
    return encoded; // Already small enough
  }

  // Sample evenly, always keeping first and last
  const step = (coords.length - 1) / (maxPoints - 1);
  const sampled: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(coords[Math.round(i * step)]);
  }

  // Re-encode
  let prevLat = 0;
  let prevLng = 0;
  let out = '';

  for (const [cLat, cLng] of sampled) {
    out += encodeValue(Math.round(cLat * 1e5) - prevLat);
    out += encodeValue(Math.round(cLng * 1e5) - prevLng);
    prevLat = Math.round(cLat * 1e5);
    prevLng = Math.round(cLng * 1e5);
  }

  return out;
}

function encodeValue(value: number): string {
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
 * Build a Mapbox Static Images API URL with an encoded polyline overlay.
 * Automatically simplifies long polylines to stay within URL limits.
 */
export function buildStaticMapUrl(opts: StaticMapOptions): string {
  if (!MAPBOX_TOKEN) return '';

  const {
    width,
    height,
    strokeColor = '3366e6',
    strokeWidth = 4,
    strokeOpacity = 0.9,
    retina = true,
    padding = 60,
  } = opts;

  // Simplify polyline to ~200 points max to keep URL short
  const polyline = simplifyEncodedPolyline(opts.polyline, 200);
  const encodedPath = encodeURIComponent(polyline);
  const overlay = `path-${strokeWidth}+${strokeColor}-${strokeOpacity}(${encodedPath})`;
  const retinaFlag = retina ? '@2x' : '';
  const paddingParam = padding > 0 ? `&padding=${padding}` : '';

  const url = `${BASE}/${overlay}/auto/${width}x${height}${retinaFlag}?access_token=${MAPBOX_TOKEN}${paddingParam}`;

  // If still too long, simplify further
  if (url.length > MAX_URL_LENGTH) {
    const furtherSimplified = simplifyEncodedPolyline(opts.polyline, 80);
    const enc2 = encodeURIComponent(furtherSimplified);
    const overlay2 = `path-${strokeWidth}+${strokeColor}-${strokeOpacity}(${enc2})`;
    return `${BASE}/${overlay2}/auto/${width}x${height}${retinaFlag}?access_token=${MAPBOX_TOKEN}${paddingParam}`;
  }

  return url;
}
