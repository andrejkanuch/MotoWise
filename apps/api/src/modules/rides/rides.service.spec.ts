import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RidesService } from './rides.service';

describe('RidesService', () => {
  let service: RidesService;
  let mockUserClient: ReturnType<typeof createMockClient>;
  let mockEventEmitter: { emit: ReturnType<typeof vi.fn> };

  const userId = 'user-123';

  const fakeRow = {
    id: 'ride-123',
    user_id: 'user-123',
    motorcycle_id: 'moto-456',
    status: 'recording',
    name: null,
    started_at: '2026-03-22T14:00:00Z',
    ended_at: null,
    paused_duration_s: 0,
    auto_paused_duration_s: 0,
    distance_m: null,
    max_speed_mps: null,
    avg_speed_mps: null,
    max_lean_angle: null,
    elevation_gain: null,
    elevation_loss: null,
    route_polyline: null,
    gps_quality: null,
    mileage_applied: false,
    is_public: false,
    region: null,
    weather_snapshot: null,
    route_thumbnail_uri: null,
    metadata: {},
    created_at: '2026-03-22T14:00:00Z',
    updated_at: '2026-03-22T14:00:00Z',
    deleted_at: null,
  };

  function createChain() {
    const results: Array<{ data?: unknown; error?: unknown; count?: unknown }> = [];
    let callIndex = 0;

    const getResult = () => {
      const r = results[callIndex] ?? { data: null, error: null };
      callIndex++;
      return { data: null, error: null, ...r };
    };

    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'insert',
      'update',
      'delete',
      'upsert',
      'eq',
      'in',
      'is',
      'lt',
      'not',
      'gte',
      'order',
      'limit',
    ]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockImplementation(() => Promise.resolve(getResult()));
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable
    chain.then = vi
      .fn()
      .mockImplementation((resolve: (v: unknown) => void) => resolve(getResult()));

    return {
      chain: chain as Record<string, ReturnType<typeof vi.fn>>,
      pushResult: (r: { data?: unknown; error?: unknown; count?: unknown }) => results.push(r),
      resetIndex: () => {
        callIndex = 0;
      },
    };
  }

  function createMockClient() {
    const { chain, pushResult, resetIndex } = createChain();

    return {
      from: vi.fn().mockReturnValue(chain),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      _chain: chain,
      _pushResult: pushResult,
      _resetIndex: resetIndex,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserClient = createMockClient();
    mockEventEmitter = { emit: vi.fn() };

    service = new RidesService(
      mockUserClient as never,
      mockUserClient as never,
      mockEventEmitter as never,
    );
  });

  describe('startRide', () => {
    it('should insert and return a mapped ride', async () => {
      // Result 0: auto-end stale active rides (thenable)
      mockUserClient._pushResult({ data: null, error: null });
      // Result 1: insert new ride (.single())
      mockUserClient._pushResult({ data: fakeRow });

      const result = await service.startRide(userId, {
        rideId: 'ride-123',
        motorcycleId: 'moto-456',
        startedAt: '2026-03-22T14:00:00Z',
      });

      expect(result.id).toBe('ride-123');
      expect(result.userId).toBe(userId);
      expect(result.motorcycleId).toBe('moto-456');
      expect(result.status).toBe('recording');
      expect(mockUserClient.from).toHaveBeenCalledWith('rides');
      expect(mockUserClient._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ride-123',
          user_id: userId,
          status: 'recording',
        }),
      );
    });

    it('should throw BadRequestException on error', async () => {
      // Result 0: auto-end stale active rides (thenable)
      mockUserClient._pushResult({ data: null, error: null });
      // Result 1: insert fails
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Duplicate key', code: '23505' },
      });

      await expect(
        service.startRide(userId, {
          rideId: 'ride-123',
          motorcycleId: 'moto-456',
          startedAt: '2026-03-22T14:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('endRide', () => {
    it('should update with all stats and return mapped ride', async () => {
      const completedRow = {
        ...fakeRow,
        status: 'completed',
        ended_at: '2026-03-22T15:30:00Z',
        distance_m: 45000,
        max_speed_mps: 33.5,
        avg_speed_mps: 22.1,
        elevation_gain: 350,
        elevation_loss: 340,
        paused_duration_s: 120,
        auto_paused_duration_s: 60,
      };
      mockUserClient._pushResult({ data: completedRow });

      const result = await service.endRide(userId, {
        rideId: 'ride-123',
        endedAt: '2026-03-22T15:30:00Z',
        distanceM: 45000,
        maxSpeedMps: 33.5,
        avgSpeedMps: 22.1,
        elevationGain: 350,
        elevationLoss: 340,
        pausedDurationS: 120,
        autoPausedDurationS: 60,
      });

      expect(result.ride.status).toBe('completed');
      expect(result.ride.distanceM).toBe(45000);
      expect(result.ride.maxSpeedMps).toBe(33.5);
      expect(result.ride.durationS).toBeDefined();
      expect(result.triggeredMaintenanceTasks).toEqual([]);
      expect(mockUserClient._chain.in).toHaveBeenCalledWith('status', ['recording', 'paused']);
      expect(mockUserClient._chain.is).toHaveBeenCalledWith('deleted_at', null);
    });

    it('applies mileage once (claim-first) and returns triggered maintenance (MOT-140)', async () => {
      const completedRow = {
        ...fakeRow,
        status: 'completed',
        ended_at: '2026-03-22T15:30:00Z',
        distance_m: 32186, // ~20 mi in meters
      };
      // 0: completion UPDATE .single()
      mockUserClient._pushResult({ data: completedRow });
      // 1: claim UPDATE (mileage_applied false→true) .select(...).single() — this caller wins
      mockUserClient._pushResult({ data: { distance_m: 32186, motorcycle_id: 'moto-456' } });
      // 2: bike read .single() — current_mileage is raw in the user's unit
      mockUserClient._pushResult({ data: { current_mileage: 1000 } });
      // 3: users read .single() — measurement_system drives meters→unit conversion
      mockUserClient._pushResult({ data: { measurement_system: 'imperial' } });
      // 4: motorcycle odometer UPDATE (thenable)
      mockUserClient._pushResult({ data: null, error: null });
      // 5: due maintenance_tasks query (thenable) — none due
      mockUserClient._pushResult({ data: [] });

      const result = await service.endRide(userId, {
        rideId: 'ride-123',
        endedAt: '2026-03-22T15:30:00Z',
        distanceM: 32186,
        pausedDurationS: 0,
        autoPausedDurationS: 0,
      });

      expect(result.ride.status).toBe('completed');
      // claim-first: exactly one mileage_applied=true UPDATE gated on mileage_applied=false
      expect(mockUserClient._chain.update).toHaveBeenCalledWith({ mileage_applied: true });
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('mileage_applied', false);
      // odometer advanced by the ride distance converted meters → the user's unit
      // (imperial): 32186 m ≈ 20 mi, added to the raw 1000 mi odometer.
      expect(mockUserClient._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          current_mileage: 1020, // 1000 + round(metersToUnit(32186, 'mi')) === 1000 + 20
          odometer_sync_source: 'gps_ride',
          odometer_last_ride_id: 'ride-123',
        }),
      );
      // ride.completed event emitted exactly once on a real completion
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when ride not found', async () => {
      // Completion UPDATE matches 0 rows (PGRST116)...
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });
      // ...and the idempotent-retry SELECT finds no completed ride either.
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(
        service.endRide(userId, {
          rideId: 'ride-123',
          endedAt: '2026-03-22T15:30:00Z',
          distanceM: 45000,
          pausedDurationS: 0,
          autoPausedDurationS: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return the completed ride idempotently on retry-after-success (MOT-140)', async () => {
      const completedRow = {
        ...fakeRow,
        status: 'completed',
        ended_at: '2026-03-22T15:30:00Z',
        distance_m: 45000,
        mileage_applied: true,
      };
      // Completion UPDATE matches 0 rows because status is already 'completed'...
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });
      // ...the idempotent-retry SELECT returns the already-completed ride.
      mockUserClient._pushResult({ data: completedRow });

      const result = await service.endRide(userId, {
        rideId: 'ride-123',
        endedAt: '2026-03-22T15:30:00Z',
        distanceM: 45000,
        pausedDurationS: 0,
        autoPausedDurationS: 0,
      });

      expect(result.ride.status).toBe('completed');
      expect(result.triggeredMaintenanceTasks).toEqual([]);
      // No ride.completed event re-emitted on an idempotent retry
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it("lets a returning rider's end reclaim a ride the system auto-ended", async () => {
      // The scenario: force-killed or offline mid-ride, so the 24h sweep completed it
      // from whatever partial track had reached the server. The rider reopens the app
      // (MMKV still says `recording` — it even offers "Resume unfinished ride"), rides
      // another 150 km and taps Stop. Waypoints DO upload to completed rides, so the
      // full track is stored — but treating this as an idempotent retry returned
      // success while keeping the sweep's reconstructed distance_m and ended_at, and
      // skipped the odometer entirely. The rider saw a local summary matching nothing.
      const autoEndedRow = {
        ...fakeRow,
        status: 'completed',
        ended_at: '2026-03-22T14:20:00Z', // sweep's last known fix
        distance_m: 3_000, // partial reconstruction
        auto_ended_reason: 'idle_timeout',
        mileage_applied: false, // the sweep never claims the odometer
      };
      const reclaimedRow = {
        ...autoEndedRow,
        ended_at: '2026-03-22T18:00:00Z',
        distance_m: 153_000,
        auto_ended_reason: null,
      };

      // The guarded completion UPDATE matches 0 rows — status is already 'completed'.
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });
      // The lookup finds it completed, but marked as SYSTEM-ended.
      mockUserClient._pushResult({ data: autoEndedRow });
      // So the reclaim UPDATE applies the rider's payload.
      mockUserClient._pushResult({ data: reclaimedRow });
      // Odometer claim — null keeps this test focused on the reclaim itself.
      mockUserClient._pushResult({ data: null });

      const result = await service.endRide(userId, {
        rideId: 'ride-123',
        endedAt: '2026-03-22T18:00:00Z',
        distanceM: 153_000,
        pausedDurationS: 0,
        autoPausedDurationS: 0,
      });

      // The rider's figures win, and the marker is cleared so the ride is no longer
      // excluded from personal records.
      expect(result.ride.distanceM).toBe(153_000);
      expect(result.ride.endedAt).toBe('2026-03-22T18:00:00Z');
      // Unlike a genuine idempotent retry, this DOES re-emit — without it the ride
      // never reaches record detection.
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
      // Re-emitted as a rider end, so records and the AI summary both run.
      expect(mockEventEmitter.emit.mock.calls[0][1]).not.toHaveProperty(
        'autoEndedReason',
        'idle_timeout',
      );
    });
  });

  describe('uploadWaypoints', () => {
    it('should upsert waypoints and return count', async () => {
      // Result 0: ride ownership check (.single())
      mockUserClient._pushResult({ data: { id: 'ride-123' } });
      // Result 1: count query (thenable)
      mockUserClient._pushResult({ count: 100 });
      // Result 2: upsert (thenable)
      mockUserClient._pushResult({ data: null, error: null });

      const result = await service.uploadWaypoints(userId, {
        rideId: 'ride-123',
        waypoints: [
          { recordedAt: '2026-03-22T14:00:00Z', latitude: 45.0, longitude: 14.0 },
          { recordedAt: '2026-03-22T14:00:01Z', latitude: 45.001, longitude: 14.001 },
        ],
      });

      expect(result).toBe(2);
      expect(mockUserClient._chain.upsert).toHaveBeenCalled();
    });

    it('truncates to the cap instead of rejecting the batch', async () => {
      // Result 0: ride ownership check
      mockUserClient._pushResult({ data: { id: 'ride-123' } });
      // Result 1: count query — 9999 stored, so exactly one of the two fits
      mockUserClient._pushResult({ count: 9999 });
      // Result 2: upsert
      mockUserClient._pushResult({ data: null, error: null });

      // Rejecting here (the old behaviour) made the cap a poison pill: the recorder
      // re-enqueues a chunk every 50 fixes and each one dead-lettered with a Sentry
      // event — 351 of MOTO-VAULT-REACT-NATIVE-1M's events, one rider. Storing what
      // fits holds the cap and lets the client's queue drain.
      const result = await service.uploadWaypoints(userId, {
        rideId: 'ride-123',
        waypoints: [
          { recordedAt: '2026-03-22T14:00:00Z', latitude: 45.0, longitude: 14.0 },
          { recordedAt: '2026-03-22T14:00:01Z', latitude: 45.001, longitude: 14.001 },
        ],
      });

      expect(result).toBe(1);
      const rows = mockUserClient._chain.upsert.mock.calls[0][0] as unknown[];
      expect(rows).toHaveLength(1);
    });

    it('returns 0 without an upsert when the ride is already at the cap', async () => {
      mockUserClient._pushResult({ data: { id: 'ride-123' } });
      mockUserClient._pushResult({ count: 10_000 });

      const result = await service.uploadWaypoints(userId, {
        rideId: 'ride-123',
        waypoints: [{ recordedAt: '2026-03-22T14:00:00Z', latitude: 45.0, longitude: 14.0 }],
      });

      // Success-with-zero, not an error: the op leaves the client's sync queue
      // instead of being retried forever against a cap that will never move.
      expect(result).toBe(0);
      expect(mockUserClient._chain.upsert).not.toHaveBeenCalled();
    });

    it('collapses a denormal float to 0 so the REAL columns do not underflow', async () => {
      mockUserClient._pushResult({ data: { id: 'ride-123' } });
      mockUserClient._pushResult({ count: 0 });
      mockUserClient._pushResult({ data: null, error: null });

      // The exact value from MOTO-VAULT-NODE-NESTJS-8. It passes every WaypointSchema
      // range check, but Postgres rejects it for a REAL column with 22003 "underflow"
      // and fails the WHOLE multi-row upsert — up to 500 waypoints lost per bad fix.
      const result = await service.uploadWaypoints(userId, {
        rideId: 'ride-123',
        waypoints: [
          {
            recordedAt: '2026-03-22T14:00:00Z',
            latitude: 45.0,
            longitude: 14.0,
            speedMps: 1.366286406007969e-77,
            altitude: 4.9e-324,
            heading: 12.5,
            accuracy: 8,
          },
        ],
      });

      expect(result).toBe(1);
      const rows = mockUserClient._chain.upsert.mock.calls[0][0] as Array<
        Record<string, number | null>
      >;
      expect(rows[0].speed_mps).toBe(0);
      expect(rows[0].altitude).toBe(0);
      // Representable values pass through untouched.
      expect(rows[0].heading).toBe(12.5);
      expect(rows[0].accuracy).toBe(8);
      // Latitude/longitude are DOUBLE PRECISION — never rewritten.
      expect(rows[0].latitude).toBe(45.0);
    });

    it('maps a 22003 out-of-range upsert error to 400, not 500', async () => {
      mockUserClient._pushResult({ data: { id: 'ride-123' } });
      mockUserClient._pushResult({ count: 0 });
      mockUserClient._pushResult({
        error: { message: '"1e-77" is out of range for type real', code: '22003' },
      });

      const err = await service
        .uploadWaypoints(userId, {
          rideId: 'ride-123',
          waypoints: [{ recordedAt: '2026-03-22T14:00:00Z', latitude: 45.0, longitude: 14.0 }],
        })
        .catch((e) => e);

      // 5xx is what made the sync queue burn five retries + five Sentry events on a
      // payload the database will refuse every time (48 events in 43 minutes).
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toContain('22003');
      expect((err.cause as Error)?.message).toContain('22003');
    });

    it('should throw NotFoundException when ride not found', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(
        service.uploadWaypoints(userId, {
          rideId: 'ride-123',
          waypoints: [{ recordedAt: '2026-03-22T14:00:00Z', latitude: 45.0, longitude: 14.0 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('proceeds with the upsert when the quota count read fails (soft guard)', async () => {
      // Result 0: ride ownership check
      mockUserClient._pushResult({ data: { id: 'ride-123' } });
      // Result 1: count query fails transiently — must NOT block the upload
      mockUserClient._pushResult({ error: { message: 'timeout', code: '57014' } });
      // Result 2: upsert succeeds
      mockUserClient._pushResult({ data: null, error: null });

      const result = await service.uploadWaypoints(userId, {
        rideId: 'ride-123',
        waypoints: [{ recordedAt: '2026-03-22T14:00:00Z', latitude: 45.0, longitude: 14.0 }],
      });

      expect(result).toBe(1);
      expect(mockUserClient._chain.upsert).toHaveBeenCalled();
    });

    it('maps a transient upsert error to 503 and attaches the pg code as cause', async () => {
      mockUserClient._pushResult({ data: { id: 'ride-123' } });
      mockUserClient._pushResult({ count: 0 });
      // statement_timeout (class 57) → retryable
      mockUserClient._pushResult({
        error: { message: 'canceling statement due to statement timeout', code: '57014' },
      });

      const err = await service
        .uploadWaypoints(userId, {
          rideId: 'ride-123',
          waypoints: [{ recordedAt: '2026-03-22T14:00:00Z', latitude: 45.0, longitude: 14.0 }],
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect((err.cause as Error)?.message).toContain('57014');
    });

    it('maps a permanent upsert error to 400 and attaches the pg code as cause', async () => {
      mockUserClient._pushResult({ data: { id: 'ride-123' } });
      mockUserClient._pushResult({ count: 0 });
      // not_null_violation (class 23) → permanent
      mockUserClient._pushResult({
        error: { message: 'null value in column violates not-null constraint', code: '23502' },
      });

      const err = await service
        .uploadWaypoints(userId, {
          rideId: 'ride-123',
          waypoints: [{ recordedAt: '2026-03-22T14:00:00Z', latitude: 45.0, longitude: 14.0 }],
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect((err.cause as Error)?.message).toContain('23502');
    });

    it('maps an unrecognised pg class to 500 so it stays retryable and alertable', async () => {
      mockUserClient._pushResult({ data: { id: 'ride-123' } });
      mockUserClient._pushResult({ count: 0 });
      mockUserClient._pushResult({ error: { message: 'something new', code: '99999' } });

      const err = await service
        .uploadWaypoints(userId, {
          rideId: 'ride-123',
          waypoints: [{ recordedAt: '2026-03-22T14:00:00Z', latitude: 45.0, longitude: 14.0 }],
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err.cause as Error)?.message).toContain('99999');
    });
  });

  describe('updateRide', () => {
    it('should partial-update and return mapped ride', async () => {
      const updatedRow = { ...fakeRow, name: 'Morning Cruise' };
      mockUserClient._pushResult({ data: updatedRow });

      const result = await service.updateRide(userId, {
        rideId: 'ride-123',
        name: 'Morning Cruise',
      });

      expect(result.name).toBe('Morning Cruise');
      expect(mockUserClient._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Morning Cruise' }),
      );
    });

    it('should throw BadRequestException on error', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(
        service.updateRide(userId, { rideId: 'ride-123', name: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteRide', () => {
    it('should soft-delete through the RPC and return true', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await service.deleteRide(userId, 'ride-123');

      expect(result).toBe(true);
      expect(mockUserClient.rpc).toHaveBeenCalledWith('soft_delete_ride', { ride_id: 'ride-123' });
    });

    it('should never issue a direct UPDATE against rides', async () => {
      // A direct UPDATE cannot work: the `deleted_at IS NULL` SELECT policy is
      // applied to the new row, so stamping deleted_at gets the statement
      // rejected with 42501. That is why this used to need supabaseAdmin, and
      // why 00176 moved it into a SECURITY DEFINER RPC instead — the ownership
      // check stays in the database rather than in an app-layer filter.
      mockUserClient.rpc.mockResolvedValueOnce({ data: true, error: null });

      await service.deleteRide(userId, 'ride-123');

      expect(mockUserClient._chain.update).not.toHaveBeenCalled();
    });

    it('should return true when the ride is already deleted (idempotent)', async () => {
      // The RPC answers "is it deleted and theirs", so a duplicate tap or a
      // sync-queue retry returns true in one round trip. This previously took a
      // second admin-client count query to establish.
      mockUserClient.rpc.mockResolvedValueOnce({ data: true, error: null });

      await expect(service.deleteRide(userId, 'ride-123')).resolves.toBe(true);
    });

    it('should throw NotFoundException when the user has no such ride', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: false, error: null });

      await expect(service.deleteRide(userId, 'ride-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException when the RPC itself fails', async () => {
      // A transport/DB fault is not "ride not found" — reporting it as a 404
      // would tell the client to stop retrying something that might succeed.
      mockUserClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection reset', code: '08006' },
      });

      await expect(service.deleteRide(userId, 'ride-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('myRides', () => {
    it('should return paginated connection', async () => {
      mockUserClient._pushResult({
        data: [fakeRow, { ...fakeRow, id: 'ride-456' }],
        count: 2,
      });

      const result = await service.myRides(userId, 20);

      expect(result.edges).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it('should return empty result', async () => {
      mockUserClient._pushResult({ data: [], count: 0 });

      const result = await service.myRides(userId, 20);

      expect(result.edges).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should throw BadRequestException for invalid cursor', async () => {
      const invalidCursor = Buffer.from('not-a-date').toString('base64');

      await expect(service.myRides(userId, 20, invalidCursor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return mapped ride', async () => {
      mockUserClient._pushResult({ data: fakeRow });

      const result = await service.findById(userId, 'ride-123');

      expect(result.id).toBe('ride-123');
      expect(result.userId).toBe(userId);
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('id', 'ride-123');
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should throw NotFoundException when not found', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(service.findById(userId, 'ride-123')).rejects.toThrow(NotFoundException);
    });
  });

  // Visibility canonicalization (audit C6): `visibility` is the canonical access column
  // (RLS gates on it); `is_public` is dual-written until every SQL consumer migrates off
  // it. mapRow DERIVES isPublic from visibility so old + new clients never disagree.
  describe('visibility dual-write', () => {
    it('updateRide({ isPublic: true }) writes BOTH is_public=true AND visibility=public', async () => {
      mockUserClient._pushResult({ data: { ...fakeRow, is_public: true, visibility: 'public' } });

      const result = await service.updateRide(userId, { rideId: 'ride-123', isPublic: true });

      expect(mockUserClient._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_public: true, visibility: 'public' }),
      );
      expect(result.isPublic).toBe(true);
      expect(result.visibility).toBe('public');
    });

    it('updateRide({ isPublic: false }) writes is_public=false AND visibility=private', async () => {
      mockUserClient._pushResult({ data: { ...fakeRow, is_public: false, visibility: 'private' } });

      await service.updateRide(userId, { rideId: 'ride-123', isPublic: false });

      expect(mockUserClient._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_public: false, visibility: 'private' }),
      );
    });

    it('updateRideVisibility("public") writes visibility=public AND is_public=true', async () => {
      mockUserClient._pushResult({ data: { ...fakeRow, is_public: true, visibility: 'public' } });

      const result = await service.updateRideVisibility(userId, 'ride-123', 'public');

      expect(mockUserClient._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'public', is_public: true }),
      );
      expect(result.visibility).toBe('public');
      expect(result.isPublic).toBe(true);
    });

    it('updateRideVisibility("unlisted") sets is_public=false (only "public" is public)', async () => {
      mockUserClient._pushResult({
        data: { ...fakeRow, is_public: false, visibility: 'unlisted' },
      });

      await service.updateRideVisibility(userId, 'ride-123', 'unlisted');

      expect(mockUserClient._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'unlisted', is_public: false }),
      );
    });

    it('mapRow derives isPublic from canonical visibility, ignoring a stale is_public column', async () => {
      // Drifted row: is_public=false but visibility=public → canonical wins.
      mockUserClient._pushResult({ data: { ...fakeRow, is_public: false, visibility: 'public' } });

      const result = await service.findById(userId, 'ride-123');

      expect(result.visibility).toBe('public');
      expect(result.isPublic).toBe(true);
    });
  });
});
