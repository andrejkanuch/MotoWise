import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OdometerService } from './odometer.service';

const USER_ID = 'user-1';
const BIKE_ID = 'bike-1';
const NOW = new Date('2026-10-02T10:00:00.000Z');
const LATEST_READING_AT = '2026-09-28T08:00:00Z';

/**
 * Chainable, awaitable Supabase mock. Each `from()` call takes the next queued
 * result, so a test lists results in the order the service queries.
 */
function createSupabaseMock() {
  const results: unknown[] = [];
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  const from = vi.fn((table: string) => {
    const result = results.shift() ?? { data: [], error: null };
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'gt', 'order', 'limit']) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return chain;
      };
    }
    // biome-ignore lint/suspicious/noThenProperty: a PostgREST builder is a thenable
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  });

  return { from, rpc: vi.fn(), queue: (result: unknown) => results.push(result), calls };
}

const readingRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'reading-1',
  value: 38167,
  recorded_at: LATEST_READING_AT,
  source: 'backfill',
  ride_id: null,
  ...overrides,
});

describe('OdometerService', () => {
  let service: OdometerService;
  let mock: ReturnType<typeof createSupabaseMock>;
  let motorcyclesService: { findById: ReturnType<typeof vi.fn> };

  const bike = (distanceUnit: string) => ({ id: BIKE_ID, distanceUnit, currentMileage: 38167 });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mock = createSupabaseMock();
    motorcyclesService = { findById: vi.fn().mockResolvedValue(bike('km')) };
    service = new OdometerService(mock as never, motorcyclesService as never);
    // biome-ignore lint/suspicious/noExplicitAny: accessing private logger for test suppression
    (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('findReadings', () => {
    it('maps rows to camelCase and asks for newest first', async () => {
      mock.queue({
        data: [readingRow({ source: 'gps_ride', ride_id: 'ride-1' }), readingRow({ id: 'r-2' })],
        error: null,
      });

      const readings = await service.findReadings(USER_ID, BIKE_ID, 20);

      expect(readings[0]).toEqual({
        id: 'reading-1',
        value: 38167,
        recordedAt: LATEST_READING_AT,
        source: 'gps_ride',
        rideId: 'ride-1',
      });
      expect(readings[1].rideId).toBeUndefined();
      expect(mock.calls).toContainEqual({
        table: 'odometer_readings',
        method: 'order',
        args: ['recorded_at', { ascending: false }],
      });
      expect(mock.calls).toContainEqual({
        table: 'odometer_readings',
        method: 'eq',
        args: ['motorcycle_id', BIKE_ID],
      });
    });

    it.each([
      [0, 1],
      [20, 20],
      [5000, 100],
    ])('clamps limit %i to %i', async (requested, applied) => {
      mock.queue({ data: [], error: null });
      await service.findReadings(USER_ID, BIKE_ID, requested);
      expect(mock.calls).toContainEqual({
        table: 'odometer_readings',
        method: 'limit',
        args: [applied],
      });
    });

    it('throws InternalServerErrorException on a query error', async () => {
      mock.queue({ data: null, error: { message: 'x', code: '1' } });
      await expect(service.findReadings(USER_ID, BIKE_ID)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('pendingRideDistance', () => {
    it('converts metres to miles for a mi bike (1,995,582 m -> 1,240 mi)', async () => {
      motorcyclesService.findById.mockResolvedValueOnce(bike('mi'));
      mock.queue({ data: [readingRow()], error: null });
      mock.queue({
        data: [{ distance_m: 1_000_000 }, { distance_m: 995_582 }],
        error: null,
      });

      await expect(service.pendingRideDistance(USER_ID, BIKE_ID)).resolves.toEqual({
        rideCount: 2,
        distance: 1240,
      });
    });

    it('converts metres to kilometres for a km bike (1,240,000 m -> 1,240 km)', async () => {
      mock.queue({ data: [readingRow()], error: null });
      mock.queue({
        data: [
          { distance_m: 400_000 },
          { distance_m: 300_000 },
          { distance_m: 290_000 },
          { distance_m: 250_000 },
        ],
        error: null,
      });

      await expect(service.pendingRideDistance(USER_ID, BIKE_ID)).resolves.toEqual({
        rideCount: 4,
        distance: 1240,
      });
    });

    it('only asks for unapplied completed rides that ended after the latest reading', async () => {
      mock.queue({ data: [readingRow()], error: null });
      mock.queue({ data: [], error: null });

      await service.pendingRideDistance(USER_ID, BIKE_ID);

      const rideCalls = mock.calls.filter((call) => call.table === 'rides');
      expect(rideCalls).toContainEqual({
        table: 'rides',
        method: 'gt',
        args: ['ended_at', LATEST_READING_AT],
      });
      expect(rideCalls).toContainEqual({
        table: 'rides',
        method: 'eq',
        args: ['mileage_applied', false],
      });
      expect(rideCalls).toContainEqual({
        table: 'rides',
        method: 'eq',
        args: ['status', 'completed'],
      });
      expect(rideCalls).toContainEqual({ table: 'rides', method: 'gt', args: ['distance_m', 0] });
      expect(rideCalls).toContainEqual({
        table: 'rides',
        method: 'is',
        args: ['deleted_at', null],
      });
    });

    it('applies no ended_at bound when the bike has no reading yet', async () => {
      mock.queue({ data: [], error: null });
      mock.queue({ data: [{ distance_m: 12_400 }], error: null });

      const result = await service.pendingRideDistance(USER_ID, BIKE_ID);

      expect(result).toEqual({ rideCount: 1, distance: 12 });
      expect(mock.calls.some((call) => call.method === 'gt' && call.args[0] === 'ended_at')).toBe(
        false,
      );
    });

    it('returns zero when there are no such rides', async () => {
      mock.queue({ data: [readingRow()], error: null });
      mock.queue({ data: [], error: null });

      await expect(service.pendingRideDistance(USER_ID, BIKE_ID)).resolves.toEqual({
        rideCount: 0,
        distance: 0,
      });
    });

    it("throws NotFoundException for a bike that is not the caller's", async () => {
      motorcyclesService.findById.mockResolvedValueOnce(null);
      await expect(service.pendingRideDistance(USER_ID, BIKE_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mock.from).not.toHaveBeenCalled();
    });
  });

  describe('logReading', () => {
    it('calls the RPC with the mapped arguments and returns the bike', async () => {
      mock.rpc.mockResolvedValueOnce({ data: 'reading-9', error: null });
      const updated = { ...bike('km'), currentMileage: 39407 };
      motorcyclesService.findById.mockResolvedValueOnce(updated);

      const result = await service.logReading(USER_ID, {
        motorcycleId: BIKE_ID,
        value: 39407,
        recordedAt: '2026-10-01T18:30:00.000Z',
      });

      expect(mock.rpc).toHaveBeenCalledWith('log_odometer_reading', {
        p_motorcycle_id: BIKE_ID,
        p_value: 39407,
        p_recorded_at: '2026-10-01T18:30:00.000Z',
      });
      expect(motorcyclesService.findById).toHaveBeenCalledWith(USER_ID, BIKE_ID);
      expect(result).toBe(updated);
    });

    it('defaults recordedAt to now', async () => {
      mock.rpc.mockResolvedValueOnce({ data: 'reading-9', error: null });

      await service.logReading(USER_ID, { motorcycleId: BIKE_ID, value: 39407 });

      expect(mock.rpc).toHaveBeenCalledWith(
        'log_odometer_reading',
        expect.objectContaining({ p_recorded_at: NOW.toISOString() }),
      );
    });

    it('accepts a value lower than the current odometer', async () => {
      mock.rpc.mockResolvedValueOnce({ data: 'reading-9', error: null });

      await expect(
        service.logReading(USER_ID, { motorcycleId: BIKE_ID, value: 38000 }),
      ).resolves.toBeDefined();
    });

    it('throws BadRequestException on an RPC error', async () => {
      mock.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'motorcycle_not_found', code: 'P0002' },
      });

      await expect(
        service.logReading(USER_ID, { motorcycleId: BIKE_ID, value: 39407 }),
      ).rejects.toThrow(BadRequestException);
      expect(motorcyclesService.findById).not.toHaveBeenCalled();
    });
  });
});
