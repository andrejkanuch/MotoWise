/**
 * Static map image provider — builds URLs for Mapbox Static Images API.
 * Used by the route-hero API to generate map images server-side.
 */

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN ?? '';
const BASE = 'https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static';

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
 * Build a Mapbox Static Images API URL with an encoded polyline overlay.
 */
export function buildStaticMapUrl(opts: StaticMapOptions): string {
  const {
    polyline,
    width,
    height,
    strokeColor = '3366e6',
    strokeWidth = 4,
    strokeOpacity = 0.9,
    retina = true,
    padding = 60,
  } = opts;

  // Mapbox uses `enc:` prefix for Google-encoded polylines
  const encodedPath = encodeURIComponent(polyline);
  const overlay = `path-${strokeWidth}+${strokeColor}-${strokeOpacity}(${encodedPath})`;
  const retinaFlag = retina ? '@2x' : '';
  const paddingParam = padding > 0 ? `&padding=${padding}` : '';

  return `${BASE}/${overlay}/auto/${width}x${height}${retinaFlag}?access_token=${MAPBOX_TOKEN}${paddingParam}`;
}
