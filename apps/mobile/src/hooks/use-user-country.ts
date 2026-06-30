import { isSupportedCountry, type SupportedCountryCode } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { queryKeys } from '../lib/query-keys';
import { requestForegroundLocationPermission } from '../utils/location-permission';
import { reverseGeocodeCountryCode } from '../utils/mapbox-geocoding';

export interface DetectedUserLocation {
  /** Supported country detected via reverse-geocode, or null. */
  countryCode: SupportedCountryCode | null;
  /** Device coordinates, when a fix was available. */
  coords: { latitude: number; longitude: number } | null;
}

const EMPTY_LOCATION: DetectedUserLocation = { countryCode: null, coords: null };

/**
 * Resolve the device location and the supported country it falls in.
 *
 * Requests foreground permission (rather than only reading the current status)
 * so the query resolves *after* the user answers the system prompt. Reading the
 * status instead caches a null result before the prompt is answered, leaving
 * "near you" content hidden until an app reload re-runs the query.
 *
 * `getCurrentPositionAsync` can reject ("Current location is unavailable") even
 * with permission granted (GPS cold start, indoors, low-end hardware), so the
 * fix attempt is guarded the same way the weather forecast resolver guards it
 * (Sentry MOTO-VAULT-REACT-NATIVE-19).
 */
async function detectUserLocation(): Promise<DetectedUserLocation> {
  try {
    const { status } = await requestForegroundLocationPermission();
    if (status !== 'granted') return EMPTY_LOCATION;

    const point =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const coords = { latitude: point.coords.latitude, longitude: point.coords.longitude };
    const code = await reverseGeocodeCountryCode(coords.latitude, coords.longitude);
    const countryCode = code && isSupportedCountry(code) ? code : null;
    return { countryCode, coords };
  } catch {
    return EMPTY_LOCATION;
  }
}

export function useUserCountry() {
  return useQuery({
    queryKey: queryKeys.userCountry.detected,
    queryFn: detectUserLocation,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
