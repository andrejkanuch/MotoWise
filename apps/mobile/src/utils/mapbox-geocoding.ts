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
  text: string;
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
    if (__DEV__) {
      console.warn('[mapbox-geocoding] EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set');
    }
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
      if (__DEV__) {
        console.warn(`[mapbox-geocoding] HTTP ${response.status}: ${response.statusText}`);
      }
      return [];
    }

    const data: MapboxGeocodingResponse = await response.json();

    return data.features.map((feature) => ({
      id: feature.id,
      name: feature.text,
      fullAddress: feature.place_name,
      lat: feature.center[1],
      lng: feature.center[0],
      category: feature.properties.category ?? '',
    }));
  } catch (error) {
    if (__DEV__) {
      console.warn('[mapbox-geocoding] Request failed:', error);
    }
    return [];
  }
}
