import * as Location from 'expo-location';

let inFlight: Promise<Location.LocationPermissionResponse> | null = null;

/**
 * Request foreground location permission, coalescing concurrent callers onto a
 * single native request.
 *
 * The Discover screen resolves location from two independent places at mount —
 * country detection ("near you" rides + map centering) and the weather strip.
 * expo-location rejects a `requestForegroundPermissionsAsync` call while another
 * is already in progress, so without this guard one of the two callers throws,
 * its query errors out, and the feature silently fails until an app reload.
 * Sharing one in-flight promise gives every caller the same resolved result.
 */
export function requestForegroundLocationPermission(): Promise<Location.LocationPermissionResponse> {
  if (!inFlight) {
    inFlight = Location.requestForegroundPermissionsAsync().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
