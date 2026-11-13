import { isSupportedCountry, type SupportedCountryCode } from '@motovault/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback } from 'react';
import { Linking } from 'react-native';
import { queryKeys } from '../lib/query-keys';
import { requestForegroundLocationPermission } from '../utils/location-permission';
import { reverseGeocodeCountryCode } from '../utils/mapbox-geocoding';

/** Where the rider stands on sharing location with Discover. */
export const LOCATION_ACCESS = {
  /** Never asked, or Android will still show the dialog: offer "Use my location". */
  NOT_ASKED: 'not_asked',
  GRANTED: 'granted',
  /** Denied and the OS will not show the dialog again: the tap opens Settings. */
  BLOCKED: 'blocked',
} as const;
export type LocationAccess = (typeof LOCATION_ACCESS)[keyof typeof LOCATION_ACCESS];

export interface DetectedUserLocation {
  access: LocationAccess;
  /** Supported country detected via reverse-geocode, or null. */
  countryCode: SupportedCountryCode | null;
  /** Device coordinates, when a fix was available. */
  coords: { latitude: number; longitude: number } | null;
}

function accessOf(permission: Location.LocationPermissionResponse): LocationAccess {
  if (permission.status === 'granted') return LOCATION_ACCESS.GRANTED;
  return permission.canAskAgain ? LOCATION_ACCESS.NOT_ASKED : LOCATION_ACCESS.BLOCKED;
}

/**
 * Resolve the device location and the supported country it falls in.
 *
 * Only READS the permission (issue 365, FS-PO8): requesting it on Discover open
 * raised the OS dialog before the rider did anything, and on Android the
 * permission activity pauses the app (42 of 43 first Discover visits
 * backgrounded within 2 s). The request happens in {@link useUserCountry}'s
 * `requestLocation`, after a "Use my location" tap, and then refetches this.
 *
 * `getCurrentPositionAsync` can reject ("Current location is unavailable") even
 * with permission granted (GPS cold start, indoors, low-end hardware), so the
 * fix attempt is guarded the same way the weather forecast resolver guards it
 * (Sentry MOTO-VAULT-REACT-NATIVE-19).
 */
async function detectUserLocation(): Promise<DetectedUserLocation> {
  let access: LocationAccess = LOCATION_ACCESS.NOT_ASKED;
  try {
    access = accessOf(await Location.getForegroundPermissionsAsync());
    if (access !== LOCATION_ACCESS.GRANTED) return { access, countryCode: null, coords: null };

    const point =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const coords = { latitude: point.coords.latitude, longitude: point.coords.longitude };
    const code = await reverseGeocodeCountryCode(coords.latitude, coords.longitude);
    const countryCode = code && isSupportedCountry(code) ? code : null;
    return { access, countryCode, coords };
  } catch {
    return { access, countryCode: null, coords: null };
  }
}

export function useUserCountry() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.userCountry.detected,
    queryFn: detectUserLocation,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  /** The rider's "Use my location" tap: the only place Discover asks the OS. */
  const requestLocation = useCallback(async () => {
    try {
      const permission = await requestForegroundLocationPermission();
      if (accessOf(permission) === LOCATION_ACCESS.BLOCKED) {
        await Linking.openSettings();
        return;
      }
    } catch {
      // A failed request leaves the prompt card in place; the rider can tap again.
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.userCountry.detected });
  }, [queryClient]);

  return { ...query, requestLocation };
}
