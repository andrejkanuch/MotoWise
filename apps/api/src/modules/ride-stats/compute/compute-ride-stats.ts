import {
  averageMovingSpeedMps,
  computeClimbM,
  computeTrackMovingTimeS,
  RIDE_WAYPOINT_LIMITS,
} from '@motovault/types';
import type { LatLng } from '../../../common/polyline';
import type { TrackPointsRow } from '../../../common/track-points';
import {
  INPUT_SOURCE,
  type InputSource,
  type RideForStats,
  type RideStatsWrite,
  type RideTrackWrite,
} from '../ride-stats.types';
import { computeBends } from './bends';
import { computeCells } from './cells';
import { computeGpsQuality } from './gps-quality';
import { computeLeanBands } from './lean';
import { type PlacesLookup, REFERENCE_MISSING, type RidePlaces } from './places';
import { computeStops } from './stops';
import { isValidIanaZone, localTimeFields, resolveTimeZone } from './time-zone';
import {
  fixesFromPolyline,
  fixesFromTrackPoints,
  resampleTrack,
  simplifyRoute,
  type TrackFix,
  toEwktLineString,
  trackDistanceM,
  type YieldFn,
} from './track';

/**
 * The algorithm version stamped on every row. Bump it for any change to what a
 * row holds: rows below it are stale and the sweep recomputes them, while they
 * keep serving their stored values until then.
 */
export const RIDE_STATS_VERSION = 1;

/** Reported speeds above this are sensor glitches, not riding (about 324 km/h). */
const MAX_PLAUSIBLE_SPEED_MPS = 90;

export interface ComputeInput {
  ride: RideForStats;
  /** The `ride_track_points` row, or null when the ride has no waypoints. */
  trackPoints: TrackPointsRow | null;
  /** `motorcycles.type` of the ride's bike, for the lean tyre correction. */
  bikeType: string | null;
}

export interface ComputeDeps {
  lookupPlaces: PlacesLookup;
  /** The rider's latest valid zone, read only when neither the ride nor a start point gives one. */
  riderZone: () => Promise<string | null>;
  yieldFn: YieldFn;
}

export type ComputeOutcome =
  | {
      kind: 'row';
      stats: RideStatsWrite;
      track: RideTrackWrite | null;
      /** First point of the ride's geometry, for the weather step. */
      start: LatLng | null;
    }
  | { kind: typeof REFERENCE_MISSING };

const round = (value: number | null, digits = 0) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

function pickSource(input: ComputeInput): { source: InputSource; fixes: TrackFix[] } {
  const waypointFixes = input.trackPoints ? fixesFromTrackPoints(input.trackPoints) : [];
  if (waypointFixes.length >= 2) return { source: INPUT_SOURCE.WAYPOINTS, fixes: waypointFixes };
  const polylineFixes = input.ride.route_polyline
    ? fixesFromPolyline(input.ride.route_polyline)
    : [];
  if (polylineFixes.length >= 2) return { source: INPUT_SOURCE.POLYLINE, fixes: polylineFixes };
  return { source: INPUT_SOURCE.NONE, fixes: [] };
}

function maxSpeed(fixes: readonly TrackFix[]): number | null {
  let max: number | null = null;
  for (const f of fixes) {
    if (f.speed !== null && f.speed <= MAX_PLAUSIBLE_SPEED_MPS && (max === null || f.speed > max)) {
      max = f.speed;
    }
  }
  return max;
}

function altitudeStats(fixes: readonly TrackFix[]) {
  const altitudes = fixes.map((f) => f.alt).filter((a): a is number => a !== null);
  if (altitudes.length === 0) return { climb: null, descent: null, max: null, min: null };
  return {
    climb: computeClimbM(altitudes),
    descent: computeClimbM(altitudes.map((a) => -a)),
    max: Math.max(...altitudes),
    min: Math.min(...altitudes),
  };
}

/**
 * Derived stats for one ride: a pure function of the ride row, its waypoints or
 * polyline, the place lookup and RIDE_STATS_VERSION (no clock, no randomness),
 * so recomputing gives the same row. The whole ride is resampled; stages yield
 * to the event loop between chunks. Returns `reference_missing` instead of a
 * row with empty places while the reference geodata is not loaded.
 */
export async function computeRideStats(
  input: ComputeInput,
  deps: ComputeDeps,
): Promise<ComputeOutcome> {
  const { ride, trackPoints } = input;
  const { source, fixes } = pickSource(input);
  const hasGeometry = source !== INPUT_SOURCE.NONE;
  const hasWaypoints = source === INPUT_SOURCE.WAYPOINTS;

  const route = hasGeometry ? simplifyRoute(fixes) : null;
  let places: RidePlaces | null = null;
  if (route) {
    const outcome = await deps.lookupPlaces(route);
    if (outcome === REFERENCE_MISSING) return { kind: REFERENCE_MISSING };
    places = outcome;
  }
  await deps.yieldFn();

  const start = hasGeometry ? { lat: fixes[0].lat, lng: fixes[0].lng } : null;
  const needsRiderZone = !isValidIanaZone(ride.time_zone) && !start;
  const timeZone = resolveTimeZone({
    rideZone: ride.time_zone,
    start,
    riderZone: needsRiderZone ? await deps.riderZone() : null,
  });
  const local = localTimeFields(ride.started_at, timeZone);

  const distanceM = Math.round(ride.distance_m ?? (hasGeometry ? trackDistanceM(fixes) : 0));
  const elapsedS = ride.ended_at
    ? Math.max(0, Math.floor((Date.parse(ride.ended_at) - Date.parse(ride.started_at)) / 1000))
    : 0;

  const resampled = hasGeometry
    ? await resampleTrack(fixes, { useSpeed: hasWaypoints }, deps.yieldFn)
    : null;
  await deps.yieldFn();
  const bends = resampled ? await computeBends(resampled, deps.yieldFn) : null;
  await deps.yieldFn();
  const cells = resampled ? await computeCells(resampled, fixes, deps.yieldFn) : null;
  await deps.yieldFn();
  const lean = hasWaypoints ? await computeLeanBands(fixes, input.bikeType, deps.yieldFn) : null;
  await deps.yieldFn();

  const movingTimeS = hasWaypoints
    ? computeTrackMovingTimeS(
        fixes.map((f) => ({
          recordedAt: new Date(f.t as number).toISOString(),
          speedMps: f.speed,
        })),
      )
    : null;
  const altitude = hasWaypoints ? altitudeStats(fixes) : null;
  const stops = hasWaypoints ? computeStops(fixes) : null;
  const gps = hasWaypoints ? computeGpsQuality(fixes) : null;
  const wpCount = trackPoints?.total_points ?? 0;

  const stats: RideStatsWrite = {
    ride_id: ride.id,
    user_id: ride.user_id,
    motorcycle_id: ride.motorcycle_id,
    stats_version: RIDE_STATS_VERSION,
    input_source: source,
    wp_count: wpCount,
    wp_truncated: wpCount >= RIDE_WAYPOINT_LIMITS.MAX_PER_RIDE,
    time_zone: timeZone,
    local_date: local.localDate,
    local_start_hour: local.localStartHour,
    local_dow: local.localDow,
    distance_m: distanceM,
    elapsed_s: elapsedS,
    moving_time_s: round(movingTimeS),
    avg_moving_speed_mps: round(averageMovingSpeedMps(distanceM, movingTimeS), 3),
    max_speed_mps: hasWaypoints ? round(maxSpeed(fixes), 3) : null,
    climb_m: round(altitude?.climb ?? null),
    descent_m: round(altitude?.descent ?? null),
    max_altitude_m: round(altitude?.max ?? null),
    min_altitude_m: round(altitude?.min ?? null),
    bends_count: bends ? bends.bendsCount : null,
    bends_per_km: bends ? round(bends.bendsPerKm, 4) : null,
    band_km: bends
      ? {
          straight: round(bends.bandKm.straight, 3) as number,
          sweeping: round(bends.bandKm.sweeping, 3) as number,
          twisty: round(bends.bandKm.twisty, 3) as number,
          tight: round(bends.bandKm.tight, 3) as number,
        }
      : null,
    lean_bands: lean,
    night_m: null,
    stop_count: stops ? stops.length : null,
    stops,
    countries: places ? places.countries : null,
    start_region: places?.startRegion ?? null,
    start_place: places?.startPlace ?? null,
    end_place: places?.endPlace ?? null,
    start_cell: cells?.startCell ?? null,
    cells: cells ? cells.cells : null,
    gps_quality: gps ? round(gps.quality, 4) : null,
    gps_metrics: gps ? gps.metrics : null,
  };

  const track: RideTrackWrite | null =
    route && route.length >= 2
      ? {
          ride_id: ride.id,
          user_id: ride.user_id,
          source: source as RideTrackWrite['source'],
          route: toEwktLineString(route),
          stats_version: RIDE_STATS_VERSION,
        }
      : null;

  return { kind: 'row', stats, track, start };
}
