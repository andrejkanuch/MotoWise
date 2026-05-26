import { simplifyEncodedPolyline } from './polyline';

const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1/mapbox';

/** Max points to keep in the polyline for static map URLs (keeps URLs under ~4 KB) */
const MAX_POLYLINE_POINTS = 80;

export type StaticMapStyle =
  | 'satellite-v9'
  | 'satellite-streets-v12'
  | 'outdoors-v12'
  | 'dark-v11'
  | 'light-v11';

interface StaticMapOptions {
  style: StaticMapStyle;
  /** Google-encoded polyline (lat/lng order) */
  routePolyline: string;
  width?: number;
  height?: number;
  /** Hex color without # — default copper D4622E */
  strokeColor?: string;
  strokeWidth?: number;
  /** Camera pitch 0-60 for 3D perspective */
  pitch?: number;
  /** Camera bearing 0-360 */
  bearing?: number;
  padding?: number;
}

/**
 * Build a Mapbox Static Images API URL that renders the route on the given map style.
 * Returns null if the access token is missing.
 */
export function buildMapboxStaticUrl(options: StaticMapOptions): string | null {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  const {
    style,
    routePolyline,
    width = 540,
    height = 960,
    strokeColor = 'D4622E',
    strokeWidth = 4,
    pitch,
    bearing,
    padding = 50,
  } = options;

  const simplified = simplifyEncodedPolyline(routePolyline, MAX_POLYLINE_POINTS);
  const pathOverlay = `path-${strokeWidth}+${strokeColor}-1.0(${encodeURIComponent(simplified)})`;

  let url = `${MAPBOX_STATIC_BASE}/${style}/static/${pathOverlay}/auto/${width}x${height}@2x?access_token=${token}&padding=${padding}`;

  if (pitch != null) url += `&pitch=${pitch}`;
  if (bearing != null) url += `&bearing=${bearing}`;

  return url;
}
