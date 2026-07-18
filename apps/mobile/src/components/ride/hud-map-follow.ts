import { UserTrackingMode } from '@rnmapbox/maps';
import { MAP_ORIENTATIONS, type MapOrientation } from '../../utils/map-orientation';

/**
 * Resolve the Mapbox camera follow mode from the user's orientation preference.
 *
 * Heading-up uses `FollowWithCourse` (rotate the map by GPS movement course) —
 * NOT `FollowWithHeading`, which reads the device compass and crashed with
 * "Cannot round NaN value" on low-end sensors (Sentry MOTO-VAULT-REACT-NATIVE-16).
 *
 * Course-up is engaged only once a finite course has been observed
 * (`hasValidCourse`), so the native follow controller never receives a NaN
 * bearing. Until then — and for the `north` preference — the map stays north-up.
 */
export function resolveFollowUserMode(
  orientation: MapOrientation,
  hasValidCourse: boolean,
): UserTrackingMode {
  if (orientation === MAP_ORIENTATIONS.HEADING && hasValidCourse) {
    return UserTrackingMode.FollowWithCourse;
  }
  return UserTrackingMode.Follow;
}
