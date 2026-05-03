import { describe, expect, it } from 'vitest';
import {
  EndRideInputSchema,
  RIDE_STATUS,
  RideSchema,
  RideStatusSchema,
  StartRideInputSchema,
  UpdateRideInputSchema,
  UploadWaypointsInputSchema,
  WaypointSchema,
} from '../ride';

const validUuid = '550e8400-e29b-41d4-a716-446655440000';
const validDatetime = '2026-03-22T12:00:00Z';

describe('StartRideInputSchema', () => {
  it('accepts valid input', () => {
    const result = StartRideInputSchema.parse({
      rideId: validUuid,
      startedAt: validDatetime,
      motorcycleId: validUuid,
    });
    expect(result.rideId).toBe(validUuid);
  });

  it('accepts motorcycleId as null', () => {
    const result = StartRideInputSchema.parse({
      rideId: validUuid,
      startedAt: validDatetime,
      motorcycleId: null,
    });
    expect(result.motorcycleId).toBeNull();
  });

  it('rejects missing rideId', () => {
    expect(() =>
      StartRideInputSchema.parse({ startedAt: validDatetime, motorcycleId: null }),
    ).toThrow();
  });

  it('rejects invalid UUID', () => {
    expect(() =>
      StartRideInputSchema.parse({
        rideId: 'not-a-uuid',
        startedAt: validDatetime,
        motorcycleId: null,
      }),
    ).toThrow();
  });

  it('rejects invalid datetime', () => {
    expect(() =>
      StartRideInputSchema.parse({
        rideId: validUuid,
        startedAt: 'not-a-date',
        motorcycleId: null,
      }),
    ).toThrow();
  });
});

describe('EndRideInputSchema', () => {
  const validEndRide = {
    rideId: validUuid,
    endedAt: validDatetime,
    distanceM: 5000,
    maxSpeedMps: 30,
    avgSpeedMps: 15,
    elevationGain: 100,
    elevationLoss: 80,
    routePolyline: 'encoded_polyline',
    gpsQuality: 0.95,
    pausedDurationS: 60,
    autoPausedDurationS: 10,
  };

  it('accepts valid full input', () => {
    const result = EndRideInputSchema.parse(validEndRide);
    expect(result.rideId).toBe(validUuid);
    expect(result.distanceM).toBe(5000);
  });

  it('accepts input with optional fields omitted', () => {
    const result = EndRideInputSchema.parse({
      rideId: validUuid,
      endedAt: validDatetime,
      distanceM: 1000,
    });
    expect(result.pausedDurationS).toBe(0);
    expect(result.autoPausedDurationS).toBe(0);
  });

  it('rejects negative distanceM', () => {
    expect(() => EndRideInputSchema.parse({ ...validEndRide, distanceM: -1 })).toThrow();
  });

  it('rejects maxSpeedMps > 200', () => {
    expect(() => EndRideInputSchema.parse({ ...validEndRide, maxSpeedMps: 201 })).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => EndRideInputSchema.parse({ rideId: validUuid })).toThrow();
  });
});

describe('WaypointSchema', () => {
  const validWaypoint = {
    latitude: 45.5,
    longitude: -122.6,
    altitude: 100,
    speedMps: 25,
    heading: 180,
    accuracy: 5,
    recordedAt: validDatetime,
  };

  it('accepts complete waypoint', () => {
    const result = WaypointSchema.parse(validWaypoint);
    expect(result.latitude).toBe(45.5);
  });

  it('accepts waypoint with optional fields null', () => {
    const result = WaypointSchema.parse({
      latitude: 0,
      longitude: 0,
      altitude: null,
      speedMps: null,
      heading: null,
      accuracy: null,
      recordedAt: validDatetime,
    });
    expect(result.altitude).toBeNull();
  });

  it('rejects latitude > 90', () => {
    expect(() => WaypointSchema.parse({ ...validWaypoint, latitude: 91 })).toThrow();
  });

  it('rejects longitude > 180', () => {
    expect(() => WaypointSchema.parse({ ...validWaypoint, longitude: 181 })).toThrow();
  });

  it('rejects invalid recordedAt', () => {
    expect(() => WaypointSchema.parse({ ...validWaypoint, recordedAt: 'bad-date' })).toThrow();
  });

  it('rejects heading -1 (GPS unavailable sentinel)', () => {
    expect(() => WaypointSchema.parse({ ...validWaypoint, heading: -1 })).toThrow();
  });

  it('rejects heading below 0', () => {
    expect(() => WaypointSchema.parse({ ...validWaypoint, heading: -45 })).toThrow();
  });

  it('rejects heading above 360', () => {
    expect(() => WaypointSchema.parse({ ...validWaypoint, heading: 361 })).toThrow();
  });

  it('accepts heading as null', () => {
    const result = WaypointSchema.parse({ ...validWaypoint, heading: null });
    expect(result.heading).toBeNull();
  });

  it('accepts heading omitted (optional)', () => {
    const { heading: _, ...noHeading } = validWaypoint;
    const result = WaypointSchema.parse(noHeading);
    expect(result.heading).toBeUndefined();
  });

  it('rejects negative speedMps', () => {
    expect(() => WaypointSchema.parse({ ...validWaypoint, speedMps: -1 })).toThrow();
  });

  it('rejects negative accuracy', () => {
    expect(() => WaypointSchema.parse({ ...validWaypoint, accuracy: -1 })).toThrow();
  });
});

describe('UploadWaypointsInputSchema', () => {
  const makeWaypoint = (i: number) => ({
    latitude: i,
    longitude: i,
    recordedAt: validDatetime,
  });

  it('accepts array of 1 waypoint', () => {
    const result = UploadWaypointsInputSchema.parse({
      rideId: validUuid,
      waypoints: [makeWaypoint(0)],
    });
    expect(result.waypoints).toHaveLength(1);
  });

  it('accepts array of 500 waypoints', () => {
    const waypoints = Array.from({ length: 500 }, (_, i) => makeWaypoint(i % 90));
    const result = UploadWaypointsInputSchema.parse({
      rideId: validUuid,
      waypoints,
    });
    expect(result.waypoints).toHaveLength(500);
  });

  it('rejects empty array', () => {
    expect(() => UploadWaypointsInputSchema.parse({ rideId: validUuid, waypoints: [] })).toThrow();
  });

  it('rejects more than 500 waypoints', () => {
    const waypoints = Array.from({ length: 501 }, (_, i) => makeWaypoint(i % 90));
    expect(() => UploadWaypointsInputSchema.parse({ rideId: validUuid, waypoints })).toThrow();
  });
});

describe('UpdateRideInputSchema', () => {
  it('accepts partial update with name only', () => {
    const result = UpdateRideInputSchema.parse({
      rideId: validUuid,
      name: 'Morning ride',
    });
    expect(result.name).toBe('Morning ride');
  });

  it('accepts all fields', () => {
    const result = UpdateRideInputSchema.parse({
      rideId: validUuid,
      name: 'Evening cruise',
      mileageApplied: true,
      isPublic: false,
    });
    expect(result.mileageApplied).toBe(true);
  });

  it('rejects name longer than 200 chars', () => {
    expect(() =>
      UpdateRideInputSchema.parse({
        rideId: validUuid,
        name: 'a'.repeat(201),
      }),
    ).toThrow();
  });
});

describe('RideSchema', () => {
  const validRide = {
    id: validUuid,
    userId: validUuid,
    motorcycleId: validUuid,
    status: 'completed',
    name: 'Test ride',
    startedAt: validDatetime,
    endedAt: validDatetime,
    durationS: 3600,
    pausedDurationS: 60,
    autoPausedDurationS: 10,
    distanceM: 5000,
    maxSpeedMps: 30,
    avgSpeedMps: 15,
    elevationGain: 100,
    elevationLoss: 80,
    routePolyline: 'encoded',
    gpsQuality: 0.9,
    mileageApplied: true,
    isPublic: false,
    createdAt: validDatetime,
    updatedAt: validDatetime,
  };

  it('accepts complete ride object', () => {
    const result = RideSchema.parse(validRide);
    expect(result.id).toBe(validUuid);
    expect(result.status).toBe('completed');
  });

  it('accepts nullable fields as null', () => {
    const result = RideSchema.parse({
      ...validRide,
      motorcycleId: null,
      name: null,
      endedAt: null,
      durationS: null,
      distanceM: null,
      maxSpeedMps: null,
      avgSpeedMps: null,
      elevationGain: null,
      elevationLoss: null,
      routePolyline: null,
      gpsQuality: null,
    });
    expect(result.motorcycleId).toBeNull();
    expect(result.name).toBeNull();
    expect(result.endedAt).toBeNull();
  });
});

describe('RIDE_STATUS', () => {
  it('has RECORDING, PAUSED, COMPLETED keys', () => {
    expect(RIDE_STATUS.RECORDING).toBe('recording');
    expect(RIDE_STATUS.PAUSED).toBe('paused');
    expect(RIDE_STATUS.COMPLETED).toBe('completed');
  });
});

describe('RideStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(RideStatusSchema.parse('recording')).toBe('recording');
    expect(RideStatusSchema.parse('paused')).toBe('paused');
    expect(RideStatusSchema.parse('completed')).toBe('completed');
  });

  it('rejects invalid statuses', () => {
    expect(() => RideStatusSchema.parse('deleted')).toThrow();
    expect(() => RideStatusSchema.parse('active')).toThrow();
    expect(() => RideStatusSchema.parse('')).toThrow();
  });
});
