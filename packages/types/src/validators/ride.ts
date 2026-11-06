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

// --- Start Ride ---

export const StartRideInputSchema = z.object({
  rideId: z.string().uuid(),
  motorcycleId: z.string().uuid().nullable(),
  startedAt: z.string().datetime(),
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
  // 0 rather than null: the column and the odometer sync need a number, and a
  // distance past the cap is a glitch the odometer must not absorb.
  distanceM: z.number().nonnegative().max(2000000).catch(0),
  maxSpeedMps: sensorReading(z.number().nonnegative().max(200)),
  avgSpeedMps: sensorReading(z.number().nonnegative().max(200)),
  elevationGain: sensorReading(z.number().nonnegative().max(50000)),
  elevationLoss: sensorReading(z.number().nonnegative().max(50000)),
  routePolyline: z.string().max(500000).nullable().optional().catch(null),
  gpsQuality: sensorReading(z.number().min(0).max(1)),
  pausedDurationS: nonNegativeSeconds(),
  autoPausedDurationS: nonNegativeSeconds(),
  maxLeanAngle: sensorReading(z.number().nonnegative().max(90)),
});
export type EndRideInput = z.infer<typeof EndRideInputSchema>;

// --- Upload Waypoints ---

/** A well-formed waypoint. Strict: what a client should send. */
export const WaypointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().nullable().optional(),
  speedMps: z.number().nonnegative().max(200).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  accuracy: z.number().nonnegative().nullable().optional(),
  recordedAt: z.string().datetime(),
});
export type Waypoint = z.infer<typeof WaypointSchema>;

/** What the API stores: sensor fields out of range become null (see sensorReading). */
const IngestWaypointSchema = WaypointSchema.extend({
  altitude: sensorReading(z.number()),
  speedMps: sensorReading(z.number().nonnegative().max(200)),
  heading: sensorReading(z.number().min(0).max(360)),
  accuracy: sensorReading(z.number().nonnegative()),
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
