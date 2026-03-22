import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RidesService } from './rides.service';

describe('RidesService', () => {
  let service: RidesService;
  let mockUserClient: ReturnType<typeof createMockClient>;

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

    service = new RidesService(mockUserClient as never);
  });

  describe('startRide', () => {
    it('should insert and return a mapped ride', async () => {
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

      expect(result.status).toBe('completed');
      expect(result.distanceM).toBe(45000);
      expect(result.maxSpeedMps).toBe(33.5);
      expect(result.durationS).toBeDefined();
      expect(mockUserClient._chain.in).toHaveBeenCalledWith('status', ['recording', 'paused']);
      expect(mockUserClient._chain.is).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should throw BadRequestException when ride not found', async () => {
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

    it('should throw BadRequestException when quota exceeded', async () => {
      // Result 0: ride ownership check
      mockUserClient._pushResult({ data: { id: 'ride-123' } });
      // Result 1: count query — already at 9999
      mockUserClient._pushResult({ count: 9999 });

      await expect(
        service.uploadWaypoints(userId, {
          rideId: 'ride-123',
          waypoints: [
            { recordedAt: '2026-03-22T14:00:00Z', latitude: 45.0, longitude: 14.0 },
            { recordedAt: '2026-03-22T14:00:01Z', latitude: 45.001, longitude: 14.001 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
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
    it('should soft-delete and return true', async () => {
      mockUserClient._pushResult({ data: { id: 'ride-123' } });

      const result = await service.deleteRide(userId, 'ride-123');

      expect(result).toBe(true);
      expect(mockUserClient._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) }),
      );
      expect(mockUserClient._chain.is).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should throw NotFoundException when not found', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(service.deleteRide(userId, 'ride-123')).rejects.toThrow(NotFoundException);
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

      await expect(service.myRides(userId, 20, invalidCursor)).rejects.toThrow(
        BadRequestException,
      );
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
});
