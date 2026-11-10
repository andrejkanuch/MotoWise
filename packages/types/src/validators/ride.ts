import { z } from 'zod';
import { RIDE_WAYPOINT_LIMITS } from '../constants/limits';

// --- Ride Status ---

export const RIDE_STATUS = {
  RECORDING: 'recording',
  PAUSED: 'paused',
  COMPLETED: 'completed',
} as const;

export const RideStatusSchema = z.enum(['recording', 'paused', 'completed']);
export type RideStatus = z.infer<typeof RideStatusSchema>;

// --- Ride end provenance and purpose ---

/** How a ride ended. Server ends also keep writing `auto_ended_reason`; this does not replace it. */
export const RIDE_END_SOURCE = {
  RIDER_PHONE: 'rider_phone',
  RIDER_CARPLAY: 'rider_carplay',
  CLIENT_AUTO: 'client_auto',
  SERVER_IDLE: 'server_idle',
  STALE_ON_START: 'stale_on_start',
  NEW_RIDE_SAVE: 'new_ride_save',
} as const;
export type RideEndSource = (typeof RIDE_END_SOURCE)[keyof typeof RIDE_END_SOURCE];
export const RideEndSourceSchema = z.enum([
  RIDE_END_SOURCE.RIDER_PHONE,
  RIDE_END_SOURCE.RIDER_CARPLAY,
  RIDE_END_SOURCE.CLIENT_AUTO,
  RIDE_END_SOURCE.SERVER_IDLE,
  RIDE_END_SOURCE.STALE_ON_START,
  RIDE_END_SOURCE.NEW_RIDE_SAVE,
]);

/** Optional purpose a rider picks after a ride (the `ride_private_details.purpose` CHECK list). */
export const RIDE_PURPOSE = {
  LEISURE: 'leisure',
  COMMUTE: 'commute',
  TOUR: 'tour',
  ERRAND: 'errand',
  TRACK: 'track',
  OFFROAD: 'offroad',
  OTHER: 'other',
} as const;
export type RidePurpose = (typeof RIDE_PURPOSE)[keyof typeof RIDE_PURPOSE];
export const RidePurposeSchema = z.enum([
  RIDE_PURPOSE.LEISURE,
  RIDE_PURPOSE.COMMUTE,
  RIDE_PURPOSE.TOUR,
  RIDE_PURPOSE.ERRAND,
  RIDE_PURPOSE.TRACK,
  RIDE_PURPOSE.OFFROAD,
  RIDE_PURPOSE.OTHER,
]);

/** Longest IANA zone name is ~32 characters; anything far past that is not one. */
const MAX_TIME_ZONE_LENGTH = 64;
/** Area/Location names (and single names like "UTC"): rejects offsets such as "+01:00". */
const IANA_ZONE_SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

/** True when the runtime's time-zone database knows this IANA zone name. */
export function isIanaTimeZone(value: string): boolean {
  if (value.length > MAX_TIME_ZONE_LENGTH || !IANA_ZONE_SHAPE.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ride-ops fields the rider adds or the device reports beyond the ride's identity.
 * An unknown or malformed value becomes null rather than failing the op: the mobile
 * sync queue never retries BAD_REQUEST, so a rejection would cost the whole ride.
 */
const tolerated = <T extends z.ZodType>(schema: T) => schema.nullable().optional().catch(null);

/**
 * Like `tolerated`, for an edit of a stored answer: an unknown value (a newer app's
 * option) becomes undefined, so the stored answer is left as it is. Only an explicit
 * null clears it.
 */
const toleratedEdit = <T extends z.ZodType>(schema: T) =>
  schema.nullable().optional().catch(undefined);

// --- Start Ride ---

export const StartRideInputSchema = z.object({
  rideId: z.string().uuid(),
  motorcycleId: z.string().uuid().nullable(),
  startedAt: z.string().datetime(),
  /** The device's IANA zone at ride start; anything else is stored as null. */
  timeZone: tolerated(z.string().refine(isIanaTimeZone)),
});
export type StartRideInput = z.infer<typeof StartRideInputSchema>;

// --- End Ride ---

/**
 * A ride's identity (ids, timestamps, coordinates) is validated strictly, but a
 * derived or sensor reading out of range is replaced instead of rejected.
 *
 * The rides API validates through ZodValidationPipe, which answers any failure
 * with BAD_REQUEST — and BAD_REQUEST is NON-RETRYABLE in the mobile sync queue,
 * so the op dead-letters for good. One implausible max speed or lean angle from
 * a cheap GPS/IMU therefore cost the rider the whole ride end (or a 500-point
 * waypoint batch): the ride stayed `recording` until the next start closed it as
 * stale, trimmed to its last stored fix (MOTO-VAULT-REACT-NATIVE-3Z / -40).
 * Dropping a bad reading loses one number; rejecting loses the ride.
 */
const sensorReading = (schema: z.ZodNumber) => schema.nullable().optional().catch(null);
const nonNegativeSeconds = () => z.number().int().nonnegative().default(0).catch(0);

export const EndRideInputSchema = z.object({
  rideId: z.string().uuid(),
  endedAt: z.string().datetime(),
  // An implausible distance is UNKNOWN, not 0: the service then leaves
  // `distance_m` untouched, so a system-ended ride the rider reclaims keeps the
  // distance the sweep reconstructed, and the odometer never absorbs the glitch.
  distanceM: z.number().nonnegative().max(2000000).optional().catch(undefined),
  maxSpeedMps: sensorReading(z.number().nonnegative().max(200)),
  avgSpeedMps: sensorReading(z.number().nonnegative().max(200)),
  elevationGain: sensorReading(z.number().nonnegative().max(50000)),
  elevationLoss: sensorReading(z.number().nonnegative().max(50000)),
  routePolyline: z.string().max(500000).nullable().optional().catch(null),
  gpsQuality: sensorReading(z.number().min(0).max(1)),
  pausedDurationS: nonNegativeSeconds(),
  autoPausedDurationS: nonNegativeSeconds(),
  maxLeanAngle: sensorReading(z.number().nonnegative().max(90)),
  endSource: tolerated(RideEndSourceSchema),
  purpose: tolerated(RidePurposeSchema),
  passenger: tolerated(z.boolean()),
  /** Odometer the rider read at the end, in the bike's distance unit, whole units. */
  odometerAtEnd: tolerated(z.number().nonnegative().max(9_999_999).transform(Math.round)),
});
export type EndRideInput = z.infer<typeof EndRideInputSchema>;

// --- Pause / Resume ---

/**
 * A manual pause or resume, sent best-effort by the phone. It carries only the
 * ride id: the server keeps the phase, not the pause clock (pause durations
 * arrive with EndRide), and a ride that is no longer open is answered with
 * `false`, never an error — an error would dead-letter the ride's later ops.
 */
export const RidePauseInputSchema = z.object({
  rideId: z.string().uuid(),
});
export type RidePauseInput = z.infer<typeof RidePauseInputSchema>;

// --- Upload Waypoints ---

/**
 * Waypoint sensor ranges, defined once: the strict schema and the tolerant
 * ingest schema both build from these so their limits cannot drift apart.
 */
const WAYPOINT_SENSOR_RANGES = {
  altitude: z.number(),
  speedMps: z.number().nonnegative().max(200),
  heading: z.number().min(0).max(360),
  accuracy: z.number().nonnegative(),
} as const;

/** A well-formed waypoint. Strict: what a client should send. */
export const WaypointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: WAYPOINT_SENSOR_RANGES.altitude.nullable().optional(),
  speedMps: WAYPOINT_SENSOR_RANGES.speedMps.nullable().optional(),
  heading: WAYPOINT_SENSOR_RANGES.heading.nullable().optional(),
  accuracy: WAYPOINT_SENSOR_RANGES.accuracy.nullable().optional(),
  recordedAt: z.string().datetime(),
});
export type Waypoint = z.infer<typeof WaypointSchema>;

/** What the API stores: sensor fields out of range become null (see sensorReading). */
const IngestWaypointSchema = WaypointSchema.extend({
  altitude: sensorReading(WAYPOINT_SENSOR_RANGES.altitude),
  speedMps: sensorReading(WAYPOINT_SENSOR_RANGES.speedMps),
  heading: sensorReading(WAYPOINT_SENSOR_RANGES.heading),
  accuracy: sensorReading(WAYPOINT_SENSOR_RANGES.accuracy),
});

/**
 * A waypoint whose position or timestamp is unusable is DROPPED, not allowed to
 * fail the batch it rides in. The batch itself must still be 1..MAX_PER_UPLOAD
 * items; it may come out empty, which the service stores as zero rows.
 */
export const UploadWaypointsInputSchema = z.object({
  rideId: z.string().uuid(),
  waypoints: z
    .array(z.unknown())
    .min(1)
    .max(RIDE_WAYPOINT_LIMITS.MAX_PER_UPLOAD)
    .transform((raw) =>
      raw.flatMap((waypoint) => {
        const parsed = IngestWaypointSchema.safeParse(waypoint);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
});
export type UploadWaypointsInput = z.infer<typeof UploadWaypointsInputSchema>;

// --- Update Ride (name, mileage applied) ---

export const UpdateRideInputSchema = z.object({
  rideId: z.string().uuid(),
  name: z.string().max(200).nullable().optional(),
  mileageApplied: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  purpose: toleratedEdit(RidePurposeSchema),
  passenger: toleratedEdit(z.boolean()),
  /** Odometer read after the ride, in the bike's own unit. */
  odometerAtEnd: toleratedEdit(z.number().nonnegative().max(9_999_999).transform(Math.round)),
});
export type UpdateRideInput = z.infer<typeof UpdateRideInputSchema>;

// --- Ride Response (what clients receive) ---

export const RideSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  motorcycleId: z.string().uuid().nullable(),
  status: RideStatusSchema,
  name: z.string().max(200).nullable(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationS: z.number().int().nonnegative().nullable(),
  pausedDurationS: z.number().int().nonnegative(),
  autoPausedDurationS: z.number().int().nonnegative(),
  distanceM: z.number().nonnegative().nullable(),
  maxSpeedMps: z.number().nonnegative().nullable(),
  avgSpeedMps: z.number().nonnegative().nullable(),
  elevationGain: z.number().nullable(),
  elevationLoss: z.number().nullable(),
  routePolyline: z.string().nullable(),
  gpsQuality: z.number().nullable(),
  mileageApplied: z.boolean(),
  isPublic: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Ride = z.infer<typeof RideSchema>;
