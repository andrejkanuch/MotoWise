import { logger } from '../lib/logger';

const MAPBOX_GEOCODING_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export type GeocodingResult = {
  id: string;
  name: string;
  fullAddress: string;
  lat: number;
  lng: number;
  category: string;
};

type SearchPlacesOptions = {
  proximity?: { lng: number; lat: number };
  limit?: number;
  language?: string;
};

type MapboxFeature = {
  id: string;
  /** Short label (locality, POI name, etc.) */
  text?: string;
  place_name: string;
  center: [number, number];
  properties: { category?: string };
};

type MapboxGeocodingResponse = {
  type: string;
  features: MapboxFeature[];
};

export async function searchPlaces(
  query: string,
  options?: SearchPlacesOptions,
): Promise<GeocodingResult[]> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    logger.warn('[mapbox-geocoding] EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set');
    return [];
  }

  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = options?.limit ?? 5;
  const language = options?.language ?? 'en';

  const params = new URLSearchParams({
    access_token: token,
    types: 'place,address,poi',
    autocomplete: 'true',
    limit: String(limit),
    language,
  });

  if (options?.proximity) {
    params.set('proximity', `${options.proximity.lng},${options.proximity.lat}`);
  }

  const url = `${MAPBOX_GEOCODING_BASE}/${encodeURIComponent(trimmed)}.json?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      logger.warn(`[mapbox-geocoding] HTTP ${response.status}: ${response.statusText}`);
      return [];
    }

    const data: MapboxGeocodingResponse = await response.json();

    return data.features.map((feature) => ({
      id: feature.id,
      name: feature.text ?? '',
      fullAddress: feature.place_name,
      lat: feature.center[1],
      lng: feature.center[0],
      category: feature.properties.category ?? '',
    }));
  } catch (error) {
    logger.warn('[mapbox-geocoding] Request failed:', error);
    return [];
  }
}

const REVERSE_TYPES = 'place,address,poi';
const REVERSE_LIMIT = '1';

/**
 * Returns the uppercase ISO country code (e.g. "SK") for a coordinate via Mapbox reverse geocoding.
 * Returns null if unavailable.
 */
export async function reverseGeocodeCountryCode(lat: number, lng: number): Promise<string | null> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  const url = `${MAPBOX_GEOCODING_BASE}/${lng},${lat}.json?${new URLSearchParams({
    access_token: token,
    types: 'country',
    limit: '1',
    language: 'en',
  }).toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data: MapboxGeocodingResponse = await response.json();
    const feature = data.features[0];
    if (!feature) return null;
    // Mapbox returns short_code like "sk" on country features
    const shortCode =
      (feature as unknown as { properties: { short_code?: string } }).properties?.short_code ?? '';
    return shortCode ? shortCode.toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Short human label for a coordinate (Mapbox `feature.text`, e.g. locality or POI name).
 * Returns "" if no token, network failure, or no result.
 */
export async function reverseGeocodeShortLabel(lat: number, lng: number): Promise<string> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return '';

  const url = `${MAPBOX_GEOCODING_BASE}/${lng},${lat}.json?${new URLSearchParams({
    access_token: token,
    types: REVERSE_TYPES,
    limit: REVERSE_LIMIT,
    language: 'en',
  }).toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const data: MapboxGeocodingResponse = await response.json();
    const f = data.features[0];
    if (!f) return '';
    const t = f.text?.trim();
    if (t) return t;
    return f.place_name?.split(',')[0]?.trim() ?? '';
  } catch (error) {
    logger.warn('[mapbox-geocoding] reverseGeocodeShortLabel failed:', error);
    return '';
  }
}

/**
 * Full Mapbox `place_name` for map center / long-form display.
 */
export async function reverseGeocodeFullPlaceName(lat: number, lng: number): Promise<string> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return '';

  const url = `${MAPBOX_GEOCODING_BASE}/${lng},${lat}.json?${new URLSearchParams({
    access_token: token,
    types: REVERSE_TYPES,
    limit: REVERSE_LIMIT,
    language: 'en',
  }).toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const data: MapboxGeocodingResponse = await response.json();
    return data.features[0]?.place_name ?? '';
  } catch (error) {
    logger.warn('[mapbox-geocoding] reverseGeocodeFullPlaceName failed:', error);
    return '';
  }
}
