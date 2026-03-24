import { z } from 'zod';

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

export const EndRideInputSchema = z.object({
  rideId: z.string().uuid(),
  endedAt: z.string().datetime(),
  distanceM: z.number().nonnegative().max(100000),
  maxSpeedMps: z.number().nonnegative().max(200).nullable().optional(),
  avgSpeedMps: z.number().nonnegative().max(200).nullable().optional(),
  elevationGain: z.number().nonnegative().max(50000).nullable().optional(),
  elevationLoss: z.number().nonnegative().max(50000).nullable().optional(),
  routePolyline: z.string().max(500000).nullable().optional(),
  gpsQuality: z.number().min(0).max(1).nullable().optional(),
  pausedDurationS: z.number().int().nonnegative().default(0),
  autoPausedDurationS: z.number().int().nonnegative().default(0),
});
export type EndRideInput = z.infer<typeof EndRideInputSchema>;

// --- Upload Waypoints ---

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

export const UploadWaypointsInputSchema = z.object({
  rideId: z.string().uuid(),
  waypoints: z.array(WaypointSchema).min(1).max(500),
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
