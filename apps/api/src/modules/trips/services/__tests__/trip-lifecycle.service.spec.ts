import {
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TripLifecycleService } from '../trip-lifecycle.service';

/**
 * Regression cover for MOTO-VAULT-NODE-NESTJS-K: a solo trip (`maxRiders: 1`)
 * passed Zod and was then refused by `trips_max_riders_check` (23514), which the
 * service turned into a bare 500 carrying nothing but "Failed to create trip".
 * Migration 00179 relaxes the constraint to 1..50; these tests pin the two halves
 * the code owns — that 1 reaches the insert unaltered, and that a check violation
 * surfaces as a 400 whose Sentry `cause` names the constraint.
 */

type Result = { data: unknown; error: unknown };

/** A chainable, thenable Supabase query stub (same shape as trip-templates.service.spec.ts). */
function makeQueryStub(result: Result) {
  const stub: Record<string, unknown> = {};
  const chain = () => stub;
  for (const method of ['select', 'eq', 'order', 'limit', 'delete', 'update']) {
    stub[method] = vi.fn(chain);
  }
  stub.insert = vi.fn(chain);
  stub.single = vi.fn(() => Promise.resolve(result));
  // biome-ignore lint/suspicious/noThenProperty: mocking PostgREST's thenable builder
  stub.then = (
    resolve: (value: Result) => unknown,
    reject?: (reason: unknown) => unknown,
  ): Promise<unknown> => Promise.resolve(result).then(resolve, reject);
  return stub;
}

const pgError = (code: string, message: string): PostgrestError =>
  ({ code, message, details: '', hint: '', name: 'PostgrestError' }) as PostgrestError;

const CHECK_VIOLATION_MAX_RIDERS = pgError(
  '23514',
  'new row for relation "trips" violates check constraint "trips_max_riders_check"',
);

const tripRow = (maxRiders: number) => ({
  id: 'trip-1',
  title: 'Solo Alps run',
  description: 'Just me and the bike',
  start_date: '2026-10-01',
  end_date: '2026-10-03',
  dates_pending: false,
  difficulty: 'moderate',
  max_riders: maxRiders,
  participant_count: 0,
  status: 'draft',
  visibility: 'private',
  cover_image_url: null,
  created_at: '2026-09-20T00:00:00.000Z',
  updated_at: null,
  organiser_user_id: 'user-1',
  users: null,
});

const createInput = (maxRiders: number) => ({
  title: 'Solo Alps run',
  description: 'Just me and the bike',
  startDate: '2026-10-01',
  endDate: '2026-10-03',
  difficulty: 'moderate',
  maxRiders,
  waypoints: [],
});

describe('TripLifecycleService', () => {
  let service: TripLifecycleService;
  /** Results keyed by table, in the order the service touches them. */
  let resultsByTable: Record<string, Result[]>;
  let stubsByTable: Record<string, Record<string, unknown>[]>;

  const buildService = (results: Record<string, Result[]>) => {
    resultsByTable = results;
    stubsByTable = {};
    const cursor: Record<string, number> = {};
    const from = vi.fn((table: string) => {
      const queued = resultsByTable[table] ?? [{ data: null, error: null }];
      const index = Math.min(cursor[table] ?? 0, queued.length - 1);
      cursor[table] = (cursor[table] ?? 0) + 1;
      const stub = makeQueryStub(queued[index] as Result);
      stubsByTable[table] = [...(stubsByTable[table] ?? []), stub];
      return stub;
    });
    const client = { from } as unknown as SupabaseClient;
    service = new TripLifecycleService(client, client);
    // Silence the expected error logs.
    // biome-ignore lint/suspicious/noExplicitAny: test access to the private logger
    vi.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  };

  /** The object handed to `.insert()` on the nth query against `table`. */
  const insertArg = (table: string, n = 0): Record<string, unknown> => {
    const stub = stubsByTable[table]?.[n];
    const insert = stub?.insert as ReturnType<typeof vi.fn>;
    return insert.mock.calls[0]?.[0] as Record<string, unknown>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTripWithWaypoints', () => {
    it('sends maxRiders: 1 through to the insert unaltered (solo trips, migration 00179)', async () => {
      buildService({
        trips: [{ data: tripRow(1), error: null }],
        trip_participants: [{ data: null, error: null }],
      });

      const trip = await service.createTripWithWaypoints('user-1', createInput(1));

      expect(insertArg('trips').max_riders).toBe(1);
      expect(trip.maxRiders).toBe(1);
    });

    it('maps a 23514 check violation to a 400 carrying the constraint name as cause', async () => {
      buildService({ trips: [{ data: null, error: CHECK_VIOLATION_MAX_RIDERS }] });

      const thrown = await service
        .createTripWithWaypoints('user-1', createInput(1))
        .then(() => null)
        .catch((e: unknown) => e);

      expect(thrown).toBeInstanceOf(BadRequestException);
      expect(thrown).not.toBeInstanceOf(InternalServerErrorException);
      const cause = (thrown as Error).cause as Error;
      expect(cause.message).toContain('23514');
      expect(cause.message).toContain('trips_max_riders_check');
    });

    it('keeps a transient code (57014) a 5xx so real outages still page', async () => {
      buildService({
        trips: [{ data: null, error: pgError('57014', 'canceling statement due to timeout') }],
      });

      await expect(
        service.createTripWithWaypoints('user-1', createInput(4)),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('keeps an unknown code a 500 so the alerting path is preserved', async () => {
      buildService({
        trips: [{ data: null, error: pgError('XX999', 'something nobody has seen') }],
      });

      await expect(
        service.createTripWithWaypoints('user-1', createInput(4)),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('createTrip', () => {
    it('sends maxRiders: 1 through to the insert unaltered', async () => {
      buildService({ trips: [{ data: tripRow(1), error: null }] });

      const trip = await service.createTrip('user-1', {
        title: 'Solo Alps run',
        description: 'Just me and the bike',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        difficulty: 'moderate',
        maxRiders: 1,
      });

      expect(insertArg('trips').max_riders).toBe(1);
      expect(trip.maxRiders).toBe(1);
    });
  });

  describe('updateTrip check-violation routing', () => {
    /** updateTrip reads the trip for the ownership check before it writes. */
    const ownedTrip = {
      data: { organiser_user_id: 'user-1', visibility: 'private', status: 'draft' },
      error: null,
    };

    const updateWith = async (error: PostgrestError) => {
      buildService({ trips: [ownedTrip, { data: null, error }] });
      return service
        .updateTrip('user-1', 'trip-1', { maxRiders: 1 })
        .then(() => null)
        .catch((e: unknown) => e);
    };

    it('still blames the dates when chk_trips_date_range is the constraint that fired', async () => {
      const thrown = await updateWith(
        pgError(
          '23514',
          'new row for relation "trips" violates check constraint "chk_trips_date_range"',
        ),
      );

      expect(thrown).toBeInstanceOf(BadRequestException);
      expect((thrown as Error).message).toContain('end date must be on or after the start date');
    });

    it('does NOT blame the dates when trips_max_riders_check is the constraint that fired', async () => {
      const thrown = await updateWith(CHECK_VIOLATION_MAX_RIDERS);

      expect(thrown).toBeInstanceOf(BadRequestException);
      expect((thrown as Error).message).not.toContain('date');
      expect((thrown as Error).message).toBe('Some trip details are invalid.');
      expect(((thrown as Error).cause as Error).message).toContain('trips_max_riders_check');
    });
  });
});
