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
 * (`hasValidCourse`) — a cold-start gate so we never request course rotation
 * before the device has produced any GPS course. Until then — and for the
 * `north` preference — the map stays north-up. (The caller latches
 * `hasValidCourse` on first observation; ongoing rotation is driven by the
 * native live GPS course, not this flag.)
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
