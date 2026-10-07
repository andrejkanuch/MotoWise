import { LogOdometerReadingSchema, ODOMETER_FUTURE_TOLERANCE_MS } from '@motovault/types';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { Motorcycle } from '../motorcycles/models/motorcycle.model';
import { OdometerResolver } from './odometer.resolver';
import { ODOMETER_READINGS_DEFAULT_LIMIT, OdometerService } from './odometer.service';

const USER: AuthUser = { id: 'user-1', email: 'rider@example.com', role: 'user', tier: 'free' };
const LATEST_READING_AT = '2026-09-28T08:00:00Z';

const MOTORCYCLE_ID = '22222222-2222-4222-8222-222222222222';
const BODY_METADATA = { type: 'body' } as const;

describe('OdometerResolver auth guard audit', () => {
  const resolverPrototype = OdometerResolver.prototype as unknown as Record<string, unknown>;

  for (const method of ['odometerReadings', 'pendingRideDistance', 'logOdometerReading']) {
    it(`${method} should NOT be @Public()`, () => {
      expect(typeof resolverPrototype[method]).toBe('function');
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[method] as object)).not.toBe(
        true,
      );
    });
  }
});

describe('logOdometerReading input pipe', () => {
  const pipe = new ZodValidationPipe(LogOdometerReadingSchema);

  it('passes a valid reading through', () => {
    const input = { motorcycleId: MOTORCYCLE_ID, value: 39407 };
    expect(pipe.transform(input, BODY_METADATA)).toEqual(input);
  });

  it('rejects a negative value', () => {
    expect(() => pipe.transform({ motorcycleId: MOTORCYCLE_ID, value: -1 }, BODY_METADATA)).toThrow(
      BadRequestException,
    );
  });

  it('rejects a recordedAt beyond the future tolerance', () => {
    const recordedAt = new Date(Date.now() + ODOMETER_FUTURE_TOLERANCE_MS + 60_000).toISOString();
    expect(() =>
      pipe.transform({ motorcycleId: MOTORCYCLE_ID, value: 39407, recordedAt }, BODY_METADATA),
    ).toThrow(BadRequestException);
  });
});

describe('OdometerResolver — delegates to the service as the signed-in rider', () => {
  const bike = { id: MOTORCYCLE_ID, currentMileage: 39407, distanceUnit: 'km' } as Motorcycle;
  const service = {
    findReadings: vi.fn(),
    pendingRideDistance: vi.fn(),
    logReading: vi.fn(),
  };
  let resolver: OdometerResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new OdometerResolver(service as unknown as OdometerService);
  });

  it('odometerReadings: asks for the bike’s readings with the given limit', async () => {
    // Arrange
    const readings = [
      { id: 'r2', value: 39407, recordedAt: '2026-10-02T10:00:00Z', source: 'manual' },
      { id: 'r1', value: 38167, recordedAt: LATEST_READING_AT, source: 'ride', rideId: 'ride-1' },
    ];
    service.findReadings.mockResolvedValueOnce(readings);

    // Act
    const result = await resolver.odometerReadings(USER, MOTORCYCLE_ID, 1);

    // Assert
    expect(service.findReadings).toHaveBeenCalledWith(USER.id, MOTORCYCLE_ID, 1);
    expect(result).toEqual(readings);
  });

  it('the default limit is 20', () => {
    expect(ODOMETER_READINGS_DEFAULT_LIMIT).toBe(20);
  });

  it('pendingRideDistance: returns the count and distance as the service computed them', async () => {
    service.pendingRideDistance.mockResolvedValueOnce({ rideCount: 4, distance: 1240 });

    await expect(resolver.pendingRideDistance(USER, MOTORCYCLE_ID)).resolves.toEqual({
      rideCount: 4,
      distance: 1240,
    });
    expect(service.pendingRideDistance).toHaveBeenCalledWith(USER.id, MOTORCYCLE_ID);
  });

  it('logOdometerReading: returns the bike with its new odometer', async () => {
    const input = { motorcycleId: MOTORCYCLE_ID, value: 39407 };
    service.logReading.mockResolvedValueOnce(bike);

    const result = await resolver.logOdometerReading(USER, input);

    expect(service.logReading).toHaveBeenCalledWith(USER.id, input);
    expect(result).toBe(bike);
  });

  it('logOdometerReading: passes a back-dated timestamp through untouched', async () => {
    const input = {
      motorcycleId: MOTORCYCLE_ID,
      value: 37000,
      recordedAt: '2026-08-01T10:00:00.000Z',
    };
    service.logReading.mockResolvedValueOnce(bike);

    await resolver.logOdometerReading(USER, input);

    expect(service.logReading).toHaveBeenCalledWith(USER.id, input);
  });

  it.each([
    ['a rejected value', new BadRequestException('Failed to log odometer reading')],
    ['an unknown bike', new NotFoundException('Motorcycle not found')],
  ])('logOdometerReading: %s reaches the client unchanged', async (_label, failure) => {
    service.logReading.mockRejectedValueOnce(failure);

    await expect(
      resolver.logOdometerReading(USER, { motorcycleId: MOTORCYCLE_ID, value: 1 }),
    ).rejects.toBe(failure);
  });
});

/**
 * Chainable, awaitable Supabase mock. Each `from()` call takes the next queued
 * result, so a test lists results in the order the service queries.
 */
function createSupabaseMock() {
  const results: unknown[] = [];
  const from = vi.fn(() => {
    const result = results.shift() ?? { data: [], error: null };
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'gt', 'order', 'limit']) {
      chain[method] = () => chain;
    }
    // biome-ignore lint/suspicious/noThenProperty: a PostgREST builder is a thenable
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  });
  return { from, rpc: vi.fn(), queue: (result: unknown) => results.push(result) };
}

describe('OdometerResolver — through the real service', () => {
  let resolver: OdometerResolver;
  let db: ReturnType<typeof createSupabaseMock>;
  let motorcyclesService: { findById: ReturnType<typeof vi.fn> };

  const bike = (distanceUnit: string) => ({
    id: MOTORCYCLE_ID,
    distanceUnit,
    currentMileage: 38167,
  });
  const latestReading = {
    id: 'reading-1',
    value: 38167,
    recorded_at: LATEST_READING_AT,
    source: 'manual',
    ride_id: null,
  };
  const rides = (...metres: Array<number | null>) => ({
    data: metres.map((distance_m) => ({ distance_m })),
    error: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db = createSupabaseMock();
    motorcyclesService = { findById: vi.fn().mockResolvedValue(bike('km')) };
    const service = new OdometerService(db as never, motorcyclesService as never);
    const quiet = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    Object.assign(service, { logger: quiet });
    resolver = new OdometerResolver(service);
  });

  describe('pendingRideDistance — in the bike’s unit', () => {
    it.each([
      ['mi', [1_000_000, 995_582], 1240],
      ['km', [400_000, 300_000, 290_000, 250_000], 1240],
      // 1,995,582 m is 1,240 mi but 1,996 km: the unit decides, the metres do not.
      ['km', [1_995_582], 1996],
      ['mi', [1_240_000], 771],
    ])('a %s bike: %j metres → %i', async (unit, metres, distance) => {
      // Arrange
      motorcyclesService.findById.mockResolvedValueOnce(bike(unit));
      db.queue({ data: [latestReading], error: null });
      db.queue(rides(...metres));

      // Act
      const result = await resolver.pendingRideDistance(USER, MOTORCYCLE_ID);

      // Assert
      expect(result).toEqual({ rideCount: metres.length, distance });
    });

    it('rounds to a whole distance', async () => {
      db.queue({ data: [latestReading], error: null });
      db.queue(rides(1_499, 1_000));

      const result = await resolver.pendingRideDistance(USER, MOTORCYCLE_ID);

      // 2,499 m is 2.499 km.
      expect(result).toEqual({ rideCount: 2, distance: 2 });
    });

    it('an unknown unit on the bike is read as km', async () => {
      motorcyclesService.findById.mockResolvedValueOnce(bike('furlongs'));
      db.queue({ data: [], error: null });
      db.queue(rides(1_240_000));

      await expect(resolver.pendingRideDistance(USER, MOTORCYCLE_ID)).resolves.toEqual({
        rideCount: 1,
        distance: 1240,
      });
    });

    it('no pending rides is zero rides and zero distance', async () => {
      db.queue({ data: [latestReading], error: null });
      db.queue(rides());

      await expect(resolver.pendingRideDistance(USER, MOTORCYCLE_ID)).resolves.toEqual({
        rideCount: 0,
        distance: 0,
      });
    });

    it('a bike that is not the caller’s is NotFound before any ride is read', async () => {
      motorcyclesService.findById.mockResolvedValueOnce(null);

      await expect(resolver.pendingRideDistance(USER, MOTORCYCLE_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(db.from).not.toHaveBeenCalled();
    });

    it('a failed rides query is a server error, not an empty answer', async () => {
      db.queue({ data: [latestReading], error: null });
      db.queue({ data: null, error: { message: 'timeout', code: '57014' } });

      await expect(resolver.pendingRideDistance(USER, MOTORCYCLE_ID)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('logOdometerReading — RPC error mapping', () => {
    const input = { motorcycleId: MOTORCYCLE_ID, value: 39407 };

    it.each([
      ['not authenticated', 'not_authenticated', '42501'],
      ['a timestamp in the future', 'recorded_at_in_future', '22023'],
      ['a CHECK violation', 'violates check constraint "odometer_readings_value_check"', '23514'],
      ['an integer out of range', 'integer out of range', '22003'],
      ['an error without a code', 'fetch failed', undefined],
    ])('%s is a BadRequest that does not leak the database message', async (_label, message, code) => {
      // Arrange
      db.rpc.mockResolvedValueOnce({ data: null, error: { message, code } });

      // Act
      const failure = await resolver
        .logOdometerReading(USER, input)
        .catch((error: unknown) => error);

      // Assert
      expect(failure).toBeInstanceOf(BadRequestException);
      expect((failure as BadRequestException).message).toBe('Failed to log odometer reading');
      expect(motorcyclesService.findById).not.toHaveBeenCalled();
    });

    it('"no such bike" from the RPC (P0002) is NotFound', async () => {
      db.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'motorcycle_not_found', code: 'P0002' },
      });

      await expect(resolver.logOdometerReading(USER, input)).rejects.toThrow(NotFoundException);
      expect(motorcyclesService.findById).not.toHaveBeenCalled();
    });

    it('a reading that was logged but whose bike can no longer be read is NotFound', async () => {
      db.rpc.mockResolvedValueOnce({ data: 'reading-9', error: null });
      motorcyclesService.findById.mockResolvedValueOnce(null);

      await expect(resolver.logOdometerReading(USER, input)).rejects.toThrow(NotFoundException);
    });

    it('on success returns the bike as read back after the RPC', async () => {
      const updated = { ...bike('km'), currentMileage: 39407 };
      db.rpc.mockResolvedValueOnce({ data: 'reading-9', error: null });
      motorcyclesService.findById.mockResolvedValueOnce(updated);

      await expect(resolver.logOdometerReading(USER, input)).resolves.toBe(updated);
      expect(db.rpc).toHaveBeenCalledWith(
        'log_odometer_reading',
        expect.objectContaining({ p_motorcycle_id: MOTORCYCLE_ID, p_value: 39407 }),
      );
    });
  });
});
