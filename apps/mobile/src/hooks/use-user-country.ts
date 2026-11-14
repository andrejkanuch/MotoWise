import { isSupportedCountry, type SupportedCountryCode } from '@motovault/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Linking } from 'react-native';
import { queryKeys } from '../lib/query-keys';
import { requestForegroundLocationPermission } from '../utils/location-permission';
import { reverseGeocodeCountryCode } from '../utils/mapbox-geocoding';

const APP_STATE_ACTIVE: AppStateStatus = 'active';

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

  // A rider who turns location on in Settings comes back to the app: re-read
  // the permission then (a read only, never a request), so the opt-in card
  // does not outlive the 30-minute staleTime.
  const access = query.data?.access;
  const accessRef = useRef(access);
  accessRef.current = access;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== APP_STATE_ACTIVE) return;
      if (accessRef.current === undefined || accessRef.current === LOCATION_ACCESS.GRANTED) return;
      queryClient.invalidateQueries(
        { queryKey: queryKeys.userCountry.detected },
        { cancelRefetch: false },
      );
    });
    return () => subscription.remove();
  }, [queryClient]);

  /**
   * The rider's "Use my location" tap: the only place Discover asks the OS.
   * Settings opens only when the OS had already stopped showing the dialog
   * before this tap; a rider who just declined the dialog stays in the app and
   * the card switches to "Turn on in Settings".
   */
  const requestLocation = useCallback(async () => {
    try {
      const before = accessOf(await Location.getForegroundPermissionsAsync());
      if (before === LOCATION_ACCESS.BLOCKED) {
        await Linking.openSettings();
        return;
      }
      if (before === LOCATION_ACCESS.NOT_ASKED) await requestForegroundLocationPermission();
    } catch {
      // A failed request leaves the prompt card in place; the rider can tap again.
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.userCountry.detected });
  }, [queryClient]);

  return { ...query, requestLocation };
}
