import { RIDE_MILESTONE_PAYWALL, RIDE_WAYPOINT_LIMITS } from '@motovault/types';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/nestjs', () => sentry);

import { PG_ERROR } from '../../common/supabase/unwrap';
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

  /**
   * One entry per builder method call, in call order, with `from` acting as the
   * boundary between queries. `createMockClient()` deliberately hands every
   * `.from()` the SAME chain object, so `chain.eq.mock.calls` alone cannot tell you
   * WHICH query issued a filter — an assertion written against it is satisfied by
   * any other query in the test that happens to use the same filter. `queriesFrom`
   * below segments this log so an assertion can name one query and mean it.
   */
  type LoggedCall = { method: string; args: unknown[] };

  function createChain() {
    const results: Array<{ data?: unknown; error?: unknown; count?: unknown }> = [];
    const calls: LoggedCall[] = [];
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
      'neq',
      'in',
      'is',
      'lt',
      'not',
      'gte',
      'lte',
      'order',
      'limit',
      'range',
    ]) {
      chain[m] = vi.fn().mockImplementation((...args: unknown[]) => {
        calls.push({ method: m, args });
        return chain;
      });
    }
    chain.single = vi.fn().mockImplementation(() => Promise.resolve(getResult()));
    // closeStaleRides' last-waypoint lookup terminates on maybeSingle.
    chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(getResult()));
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable
    chain.then = vi
      .fn()
      .mockImplementation((resolve: (v: unknown) => void) => resolve(getResult()));

    return {
      chain: chain as Record<string, ReturnType<typeof vi.fn>>,
      calls,
      pushResult: (r: { data?: unknown; error?: unknown; count?: unknown }) => results.push(r),
      resetIndex: () => {
        callIndex = 0;
      },
    };
  }

  /** Split the flat call log into one entry per `.from()`, i.e. per query. */
  function queriesFrom(calls: LoggedCall[]): Array<{ table: unknown; ops: LoggedCall[] }> {
    const queries: Array<{ table: unknown; ops: LoggedCall[] }> = [];
    for (const call of calls) {
      if (call.method === 'from') {
        queries.push({ table: call.args[0], ops: [] });
      } else {
        queries.at(-1)?.ops.push(call);
      }
    }
    return queries;
  }

  function createMockClient() {
    const { chain, calls, pushResult, resetIndex } = createChain();

    return {
      from: vi.fn().mockImplementation((table: string) => {
        calls.push({ method: 'from', args: [table] });
        return chain;
      }),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      _chain: chain,
      _calls: calls,
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
    const startInput = {
      rideId: 'ride-123',
      motorcycleId: 'moto-456',
      startedAt: '2026-03-22T14:00:00Z',
    };

    // The idempotency pre-check runs first and terminates on `.single()`, so every
    // test below opens with its result. NOT_FOUND = "no such ride for this user",
    // i.e. a genuinely new start.
    const noExistingRide = { data: null, error: { code: PG_ERROR.NOT_FOUND } };

    it('should insert and return a mapped ride', async () => {
      mockUserClient._pushResult(noExistingRide); // 0: idempotency pre-check — new ride
      mockUserClient._pushResult({ data: null, error: null }); // 1: auto-end stale active rides
      mockUserClient._pushResult({ data: fakeRow }); // 2: insert new ride

      const result = await service.startRide(userId, startInput);

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

    // MOTO-VAULT-REACT-NATIVE-3C. iOS suspends a backgrounded app mid-request, so
    // the response is lost AFTER the INSERT committed. The sync queue re-sends, the
    // insert hits 23505 on the primary key, and the old blanket BadRequestException
    // made the client (which lists BAD_REQUEST in NON_RETRYABLE_CODES) discard the
    // op — taking every dependent waypoint chunk and the endRide down with it.
    it('is idempotent: a replayed startRide for a committed ride succeeds instead of 400ing', async () => {
      mockUserClient._pushResult({ data: fakeRow }); // 0: the row is already ours

      const result = await service.startRide(userId, startInput);

      expect(result.id).toBe('ride-123');
      expect(result.userId).toBe(userId);
    });

    // A replay is not a new start, so it must reach NO write at all — not the insert,
    // and above all not closeStaleRides.
    it('answers a replay without writing anything', async () => {
      mockUserClient._pushResult({ data: fakeRow }); // 0: already ours

      await service.startRide(userId, startInput);

      expect(mockUserClient._chain.insert).not.toHaveBeenCalled();
      expect(mockUserClient._chain.update).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    // N5: on a replay, the row the FIRST attempt created is still `recording`, so it
    // looks stale. Closing it would end the rider's live ride at zero duration and
    // emit a bogus ride.completed into the rollups.
    it('never auto-ends the ride it is being asked to start', async () => {
      mockUserClient._pushResult({ data: fakeRow }); // 0: the "stale" ride IS this one

      const result = await service.startRide(userId, startInput);

      expect(result.id).toBe('ride-123');
      expect(mockUserClient._chain.update).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    // The exact shape the mobile dead-letter redrive creates: it replays parked ops
    // at their ORIGINAL, older `seq`, so a startRide stranded weeks ago can arrive
    // while a DIFFERENT ride is recording right now. `excludeRideId` protects only
    // the ride being started, so if closeStaleRides ran first the live ride would be
    // force-completed mid-ride with ended_at trimmed back to its last waypoint.
    it('does not force-end a different ride that is recording right now', async () => {
      mockUserClient._pushResult({ data: fakeRow }); // 0: the replayed ride is ours

      const result = await service.startRide(userId, startInput);

      expect(result.id).toBe('ride-123');
      // closeStaleRides is the only path that selects the user's active rides; it
      // must not have run, so the live ride was never even looked at.
      expect(mockUserClient._chain.in).not.toHaveBeenCalledWith('status', ['recording', 'paused']);
      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith('ride.completed', expect.anything());
    });

    // The damning row of the disposition table: a database blip must never be
    // reported as permanent, because the client is told never to retry and the
    // fully-recorded ride is discarded.
    it.each([
      ['57014', 'statement timeout'],
      ['08006', 'connection failure'],
      ['40001', 'serialization failure'],
      ['40P01', 'deadlock detected'],
      ['53300', 'too many connections'],
    ])('returns 503 (retryable), not 400, for transient SQLSTATE %s', async (code, message) => {
      mockUserClient._pushResult(noExistingRide);
      mockUserClient._pushResult({ data: [], error: null });
      mockUserClient._pushResult({ data: null, error: { message, code } });

      const promise = service.startRide(userId, startInput);

      await expect(promise).rejects.toThrow(ServiceUnavailableException);
      await expect(promise).rejects.not.toThrow(BadRequestException);
    });

    it('embeds the SQLSTATE in the message so it reaches the client and Sentry', async () => {
      mockUserClient._pushResult(noExistingRide);
      mockUserClient._pushResult({ data: [], error: null });
      mockUserClient._pushResult({
        data: null,
        error: { message: 'canceling statement due to statement timeout', code: '57014' },
      });

      await expect(service.startRide(userId, startInput)).rejects.toThrow(/57014/);
    });

    it('keeps a foreign-key violation permanent (400) and names the motorcycle', async () => {
      mockUserClient._pushResult(noExistingRide);
      mockUserClient._pushResult({ data: [], error: null });
      mockUserClient._pushResult({
        data: null,
        error: { message: 'insert violates foreign key constraint', code: '23503' },
      });

      const promise = service.startRide(userId, startInput);

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(/moto-456/);
    });

    it('routes an unrecognised SQLSTATE to 500 so it keeps alerting', async () => {
      mockUserClient._pushResult(noExistingRide);
      mockUserClient._pushResult({ data: [], error: null });
      mockUserClient._pushResult({ data: null, error: { message: 'who knows', code: 'XX000' } });

      await expect(service.startRide(userId, startInput)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    // The same rule as closeStaleRides, and it matters more here: returning null on
    // a blip tells startRide "not a replay", and its next act is closeStaleRides,
    // which force-ends whichever ride is recording right now. So a statement timeout
    // on the pre-check would reopen the very defect the ordering closes.
    it('surfaces a failed idempotency pre-check as 503 and writes nothing', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'canceling statement due to statement timeout', code: '57014' },
      });

      await expect(service.startRide(userId, startInput)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(mockUserClient._chain.insert).not.toHaveBeenCalled();
      expect(mockUserClient._chain.update).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    // M3: a failed stale-ride lookup means UNKNOWN, not NONE. Swallowing it walked
    // into a guaranteed rides_one_active_per_user violation that surfaced as a
    // permanent 400 — a transient read failure laundered into ride loss.
    it('surfaces a closeStaleRides lookup failure as 503 and never reaches the insert', async () => {
      mockUserClient._pushResult(noExistingRide);
      mockUserClient._pushResult({
        data: null,
        error: { message: 'canceling statement due to statement timeout', code: '57014' },
      });

      await expect(service.startRide(userId, startInput)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(mockUserClient._chain.insert).not.toHaveBeenCalled();
    });

    it('closes the blocking active ride and retries the insert once', async () => {
      mockUserClient._pushResult(noExistingRide); // 0: not a replay
      mockUserClient._pushResult({ data: [], error: null }); // 1: stale lookup races, sees none
      mockUserClient._pushResult({
        data: null,
        error: { message: 'duplicate key', code: PG_ERROR.UNIQUE_VIOLATION },
      }); // 2: insert blocked by rides_one_active_per_user
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } }); // 3: not ours
      mockUserClient._pushResult({
        data: [{ id: 'stale-1', started_at: '2026-03-20T09:00:00Z' }],
        error: null,
      }); // 4: second stale lookup finds the blocker
      mockUserClient._pushResult({ data: { recorded_at: '2026-03-20T10:00:00Z' } }); // 5: last fix
      mockUserClient._pushResult({ data: [{ id: 'stale-1' }], error: null }); // 6: closed
      mockUserClient._pushResult({ data: fakeRow }); // 7: retried insert succeeds

      const result = await service.startRide(userId, startInput);

      expect(result.id).toBe('ride-123');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'ride.completed',
        expect.objectContaining({ rideId: 'stale-1', autoEndedReason: 'stale_on_start' }),
      );
    });

    // 409, not 400: CONFLICT is absent from the client's NON_RETRYABLE_CODES, so a
    // ride racing in from a second device is retried rather than discarded.
    it('throws ConflictException when the insert still conflicts after closing stale rides', async () => {
      mockUserClient._pushResult(noExistingRide);
      mockUserClient._pushResult({ data: [], error: null });
      mockUserClient._pushResult({
        data: null,
        error: { message: 'duplicate key', code: PG_ERROR.UNIQUE_VIOLATION },
      });
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } });
      mockUserClient._pushResult({ data: [], error: null });
      mockUserClient._pushResult({
        data: null,
        error: { message: 'duplicate key', code: PG_ERROR.UNIQUE_VIOLATION },
      });

      await expect(service.startRide(userId, startInput)).rejects.toThrow(ConflictException);
    });

    // A UUID collision across riders must never be answered with someone else's
    // ride: findOwnRide is scoped by user_id, so it falls through to the conflict
    // branch rather than returning a foreign row as an idempotent success.
    //
    // The assertion is POSITIONAL on purpose. A bare
    // `toHaveBeenCalledWith('user_id', userId)` is worthless here: closeStaleRides
    // issues that identical filter, createMockClient() hands every `.from()` the
    // same chain object, and so the assertion passes with findOwnRide's ownership
    // filter deleted. Only findOwnRide filters by `'id'`, so the call immediately
    // after an `.eq('id', rideId)` uniquely identifies the guard.
    it("never returns another rider's ride as an idempotent success", async () => {
      // A row with this id exists but belongs to someone else, so the RLS-scoped,
      // user_id-filtered lookup sees nothing — both times.
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } }); // 0: pre-check
      mockUserClient._pushResult({ data: [], error: null }); // 1: no stale rides
      mockUserClient._pushResult({
        data: null,
        error: { message: 'duplicate key', code: PG_ERROR.UNIQUE_VIOLATION },
      }); // 2: insert collides with the OTHER rider's row
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } }); // 3: not ours
      mockUserClient._pushResult({ data: [], error: null }); // 4: still no stale rides
      mockUserClient._pushResult({
        data: null,
        error: { message: 'duplicate key', code: PG_ERROR.UNIQUE_VIOLATION },
      }); // 5: still collides

      await expect(service.startRide(userId, startInput)).rejects.toThrow(ConflictException);

      // findOwnRide is the only query in startRide that filters on `id`, so that
      // identifies it. Asserting per-query is what makes this test able to fail:
      // closeStaleRides issues an identical `.eq('user_id', userId)` of its own,
      // so a flat `toHaveBeenCalledWith` assertion passes with the guard deleted.
      const lookups = queriesFrom(mockUserClient._calls).filter((query) =>
        query.ops.some((op) => op.method === 'eq' && op.args[0] === 'id'),
      );

      expect(lookups).toHaveLength(2); // the pre-check and the post-23505 lookup
      for (const lookup of lookups) {
        expect(lookup.table).toBe('rides');
        expect(lookup.ops).toContainEqual({ method: 'eq', args: ['id', startInput.rideId] });
        expect(lookup.ops).toContainEqual({ method: 'eq', args: ['user_id', userId] });
      }
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

    it('leaves distance_m untouched when the schema discarded an implausible distance', async () => {
      mockUserClient._pushResult({ data: { ...fakeRow, status: 'completed', distance_m: 12000 } });

      await service.endRide(userId, {
        rideId: 'ride-123',
        endedAt: '2026-03-22T15:30:00Z',
        distanceM: undefined,
        pausedDurationS: 0,
        autoPausedDurationS: 0,
      });

      const patch = (mockUserClient._chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(patch).not.toHaveProperty('distance_m');
      expect(patch.status).toBe('completed');
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
      // 2: bike read .single() — current_mileage is raw in the bike's distance_unit,
      // which drives the meters→unit conversion
      mockUserClient._pushResult({ data: { current_mileage: 1000, distance_unit: 'mi' } });
      // 3: motorcycle odometer UPDATE (thenable)
      mockUserClient._pushResult({ data: null, error: null });
      // 4: due maintenance_tasks query (thenable) — none due
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
      // odometer advanced by the ride distance converted meters → the bike's unit
      // (mi): 32186 m ≈ 20 mi, added to the raw 1000 mi odometer.
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

  describe('recording additions and end paths', () => {
    const endBase = {
      rideId: 'ride-123',
      endedAt: '2026-03-22T15:30:00Z',
      pausedDurationS: 0,
      autoPausedDurationS: 0,
    };
    const completedRow = {
      ...fakeRow,
      status: 'completed',
      ended_at: '2026-03-22T15:30:00Z',
      distance_m: 30_000,
      max_speed_mps: 31,
      elevation_gain: 400,
    };
    const updateCall = (n: number) =>
      (mockUserClient._chain.update as ReturnType<typeof vi.fn>).mock.calls[n][0];
    const rpcCalls = (name: string) =>
      mockUserClient.rpc.mock.calls.filter((call: unknown[]) => call[0] === name);

    const privateDetailsQueries = () =>
      queriesFrom(mockUserClient._calls).filter((q) => q.table === 'ride_private_details');
    const upsertOf = (query: { ops: LoggedCall[] } | undefined) =>
      query?.ops.find((op) => op.method === 'upsert')?.args;

    // The rider's zone and answers live in the owner-only ride_private_details
    // table: rides is readable by any signed-in rider for a public or unlisted ride.
    it('stores the time zone the device reported at start in ride_private_details, not rides', async () => {
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } });
      mockUserClient._pushResult({ data: [], error: null });
      mockUserClient._pushResult({ data: fakeRow }); // ride insert
      mockUserClient._pushResult({ data: null, error: null }); // details upsert

      const ride = await service.startRide(userId, {
        rideId: 'ride-123',
        startedAt: '2026-03-22T14:00:00Z',
        timeZone: 'Europe/Madrid',
      });

      expect(mockUserClient._chain.insert.mock.calls[0][0]).not.toHaveProperty('time_zone');
      const details = privateDetailsQueries();
      expect(details).toHaveLength(1);
      expect(upsertOf(details[0])).toEqual([
        { ride_id: 'ride-123', user_id: userId, time_zone: 'Europe/Madrid' },
        { onConflict: 'ride_id' },
      ]);
      expect(ride.timeZone).toBe('Europe/Madrid');
    });

    it('starts the ride without a details write when the schema dropped a non-IANA zone', async () => {
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } });
      mockUserClient._pushResult({ data: [], error: null });
      mockUserClient._pushResult({ data: fakeRow });

      // "GMT+1" reaches the service as null (StartRideInputSchema).
      const ride = await service.startRide(userId, {
        rideId: 'ride-123',
        startedAt: '2026-03-22T14:00:00Z',
        timeZone: null,
      });

      expect(ride.id).toBe('ride-123');
      expect(privateDetailsQueries()).toEqual([]);
    });

    it('a failed time-zone write never fails the start', async () => {
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } });
      mockUserClient._pushResult({ data: [], error: null });
      mockUserClient._pushResult({ data: fakeRow });
      mockUserClient._pushResult({ data: null, error: { code: '57014', message: 'timeout' } });

      const ride = await service.startRide(userId, {
        rideId: 'ride-123',
        startedAt: '2026-03-22T14:00:00Z',
        timeZone: 'Europe/Madrid',
      });

      expect(ride.id).toBe('ride-123');
      expect(ride.timeZone).toBeUndefined();
    });

    it('a replayed start returns the stored time zone and writes no details again', async () => {
      mockUserClient._pushResult({
        data: {
          ...fakeRow,
          ride_private_details: { time_zone: 'Europe/Madrid', purpose: null, passenger: null },
        },
      });

      const ride = await service.startRide(userId, {
        rideId: 'ride-123',
        startedAt: '2026-03-22T14:00:00Z',
        timeZone: 'Europe/Madrid',
      });

      expect(ride.timeZone).toBe('Europe/Madrid');
      expect(privateDetailsQueries()).toEqual([]);
    });

    it('an app auto-end with no speed fields keeps the stored stats and still counts', async () => {
      mockUserClient._pushResult({ data: completedRow });

      await service.endRide(userId, { ...endBase, endSource: 'client_auto' });

      const patch = updateCall(0);
      for (const column of [
        'distance_m',
        'max_speed_mps',
        'avg_speed_mps',
        'elevation_gain',
        'elevation_loss',
        'route_polyline',
        'gps_quality',
        'max_lean_angle',
      ]) {
        expect(patch).not.toHaveProperty(column);
      }
      expect(patch).toMatchObject({
        status: 'completed',
        end_source: 'client_auto',
        auto_ended_reason: null,
      });
      expect(typeof patch.track_updated_at).toBe('string');
      // Emitted as a rider end: records and the AI summary run for it.
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit.mock.calls[0][1]).not.toHaveProperty('autoEndedReason');
    });

    it('stores null for an end source the schema did not recognise, and the end succeeds', async () => {
      mockUserClient._pushResult({ data: completedRow });

      const result = await service.endRide(userId, { ...endBase, endSource: null });

      expect(result.ride.status).toBe('completed');
      expect(updateCall(0)).toMatchObject({ end_source: null });
    });

    it('a client sending no new fields writes the same stats as before', async () => {
      mockUserClient._pushResult({ data: completedRow });

      await service.endRide(userId, {
        ...endBase,
        distanceM: 30_000,
        maxSpeedMps: 31,
        avgSpeedMps: 18,
        elevationGain: 400,
        elevationLoss: 390,
        routePolyline: 'abc',
        gpsQuality: 0.9,
      });

      const patch = updateCall(0);
      expect(patch).toMatchObject({
        distance_m: 30_000,
        max_speed_mps: 31,
        avg_speed_mps: 18,
        elevation_gain: 400,
        elevation_loss: 390,
        route_polyline: 'abc',
        gps_quality: 0.9,
        paused_duration_s: 0,
        auto_paused_duration_s: 0,
        auto_ended_reason: null,
        end_source: null,
      });
      expect(patch).not.toHaveProperty('purpose');
      expect(patch).not.toHaveProperty('passenger');
    });

    it('writes purpose and passenger to ride_private_details when the end carries them', async () => {
      mockUserClient._pushResult({
        data: {
          ...completedRow,
          ride_private_details: { time_zone: 'Europe/Madrid', purpose: null, passenger: null },
        },
      }); // completion UPDATE
      mockUserClient._pushResult({
        data: { time_zone: 'Europe/Madrid', purpose: 'commute', passenger: false },
      }); // details upsert

      const result = await service.endRide(userId, {
        ...endBase,
        purpose: 'commute',
        passenger: false,
      });

      expect(updateCall(0)).not.toHaveProperty('purpose');
      expect(updateCall(0)).not.toHaveProperty('passenger');
      const details = privateDetailsQueries();
      expect(details).toHaveLength(1);
      expect(upsertOf(details[0])).toEqual([
        { ride_id: 'ride-123', user_id: userId, purpose: 'commute', passenger: false },
        { onConflict: 'ride_id' },
      ]);
      expect(result.ride).toMatchObject({
        timeZone: 'Europe/Madrid',
        purpose: 'commute',
        passenger: false,
      });
    });

    it('an end without answers writes no details and keeps the stored zone on the ride', async () => {
      mockUserClient._pushResult({
        data: {
          ...completedRow,
          ride_private_details: { time_zone: 'Europe/Madrid', purpose: null, passenger: null },
        },
      });

      const result = await service.endRide(userId, { ...endBase, purpose: null });

      expect(privateDetailsQueries()).toEqual([]);
      expect(result.ride.timeZone).toBe('Europe/Madrid');
    });

    it('a failed answer write does not fail the end', async () => {
      mockUserClient._pushResult({ data: completedRow });
      mockUserClient._pushResult({ data: null, error: { code: '57014', message: 'timeout' } });

      const result = await service.endRide(userId, { ...endBase, purpose: 'tour' });

      expect(result.ride.status).toBe('completed');
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
    });

    it('applies odometer at end in the bike unit through the RPC, with no GPS-delta update', async () => {
      mockUserClient._pushResult({ data: completedRow }); // 0: completion UPDATE
      mockUserClient._pushResult({ data: { distance_m: 30_000, motorcycle_id: 'moto-456' } }); // 1: claim
      mockUserClient._pushResult({ data: { current_mileage: 1000, distance_unit: 'mi' } }); // 2: bike
      mockUserClient._pushResult({ data: [] }); // 3: due maintenance tasks
      mockUserClient.rpc.mockResolvedValueOnce({
        data: { reading_id: 'reading-1', bike_moved: true },
        error: null,
      });

      await service.endRide(userId, { ...endBase, distanceM: 30_000, odometerAtEnd: 1234 });

      expect(rpcCalls('log_ride_end_odometer')).toEqual([
        ['log_ride_end_odometer', { p_ride_id: 'ride-123', p_value: 1234, p_unit: 'mi' }],
      ]);
      // The claim is still the gate, and the GPS distance is not added on top.
      expect(mockUserClient._chain.update).toHaveBeenCalledWith({ mileage_applied: true });
      const mileageWrites = (mockUserClient._chain.update as ReturnType<typeof vi.fn>).mock.calls
        .map((call) => call[0] as Record<string, unknown>)
        .filter((patch) => 'current_mileage' in patch);
      expect(mileageWrites).toEqual([]);
      expect(mockUserClient._chain.lte).toHaveBeenCalledWith('target_mileage', 1234);
    });

    const gpsMileageWrites = () =>
      (mockUserClient._chain.update as ReturnType<typeof vi.fn>).mock.calls
        .map((call) => call[0] as Record<string, unknown>)
        .filter((patch) => 'current_mileage' in patch);

    it('adds the GPS distance when the typed end odometer is history (a newer reading exists)', async () => {
      mockUserClient._pushResult({ data: completedRow }); // 0: completion UPDATE
      mockUserClient._pushResult({ data: { distance_m: 32_186, motorcycle_id: 'moto-456' } }); // 1: claim
      mockUserClient._pushResult({ data: { current_mileage: 1000, distance_unit: 'mi' } }); // 2: bike (RPC unit)
      mockUserClient._pushResult({ data: { current_mileage: 1000, distance_unit: 'mi' } }); // 3: bike (GPS)
      mockUserClient._pushResult({ data: null, error: null }); // 4: odometer UPDATE
      mockUserClient._pushResult({ data: [] }); // 5: due maintenance tasks
      mockUserClient.rpc.mockResolvedValueOnce({
        data: { reading_id: 'reading-1', bike_moved: false },
        error: null,
      });

      await service.endRide(userId, { ...endBase, distanceM: 32_186, odometerAtEnd: 990 });

      expect(rpcCalls('log_ride_end_odometer')).toHaveLength(1);
      expect(gpsMileageWrites()).toEqual([
        expect.objectContaining({ current_mileage: 1020, odometer_last_ride_id: 'ride-123' }),
      ]);
      expect(mockUserClient._chain.lte).toHaveBeenCalledWith('target_mileage', 1020);
      expect(sentry.captureException).not.toHaveBeenCalled();
    });

    it('a failed end odometer goes to Sentry with the typed value and the GPS distance still moves the bike', async () => {
      mockUserClient._pushResult({ data: completedRow }); // 0: completion UPDATE
      mockUserClient._pushResult({ data: { distance_m: 32_186, motorcycle_id: 'moto-456' } }); // 1: claim
      mockUserClient._pushResult({ data: { current_mileage: 1000, distance_unit: 'mi' } }); // 2: bike (RPC unit)
      mockUserClient._pushResult({ data: { current_mileage: 1000, distance_unit: 'mi' } }); // 3: bike (GPS)
      mockUserClient._pushResult({ data: null, error: null }); // 4: odometer UPDATE
      mockUserClient._pushResult({ data: [] }); // 5: due maintenance tasks
      mockUserClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '57014', message: 'canceling statement due to statement timeout' },
      });

      const result = await service.endRide(userId, {
        ...endBase,
        distanceM: 32_186,
        odometerAtEnd: 1234,
      });

      expect(result.ride.status).toBe('completed');
      expect(sentry.captureException).toHaveBeenCalledTimes(1);
      expect(sentry.captureException.mock.calls[0][1]).toMatchObject({
        extra: { rideId: 'ride-123', odometerAtEnd: 1234 },
      });
      expect(gpsMileageWrites()).toEqual([
        expect.objectContaining({ current_mileage: 1020, odometer_sync_source: 'gps_ride' }),
      ]);
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
    });

    it('a failed bike read skips the odometer write instead of assuming km', async () => {
      mockUserClient._pushResult({ data: completedRow }); // 0: completion UPDATE
      mockUserClient._pushResult({ data: { distance_m: 32_186, motorcycle_id: 'moto-456' } }); // 1: claim
      mockUserClient._pushResult({ data: null, error: { code: '57014', message: 'timeout' } }); // 2: bike

      const result = await service.endRide(userId, { ...endBase, distanceM: 32_186 });

      expect(result.ride.status).toBe('completed');
      expect(gpsMileageWrites()).toEqual([]);
    });

    it('updateRide refuses the end odometer when the bike unit cannot be read', async () => {
      mockUserClient._pushResult({
        data: { ...fakeRow, status: 'completed', motorcycle_id: 'moto-456' },
      }); // 0: ride read
      mockUserClient._pushResult({ data: null, error: { code: '57014', message: 'timeout' } }); // 1: bike

      const err = await service
        .updateRide(userId, { rideId: 'ride-123', odometerAtEnd: 1250 })
        .catch((e) => e);

      // Not a 4xx: the sync queue retries it instead of dead-lettering.
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(BadRequestException);
      expect(rpcCalls('log_ride_end_odometer')).toEqual([]);
    });

    it('a replayed end does not apply the odometer again', async () => {
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } });
      mockUserClient._pushResult({ data: { ...completedRow, mileage_applied: true } });

      await service.endRide(userId, { ...endBase, odometerAtEnd: 1234 });

      expect(rpcCalls('log_ride_end_odometer')).toEqual([]);
      expect(mockUserClient._chain.update).not.toHaveBeenCalledWith({ mileage_applied: true });
    });

    it('a lost mileage claim skips the odometer at end', async () => {
      mockUserClient._pushResult({ data: completedRow });
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } }); // claim lost

      await service.endRide(userId, { ...endBase, odometerAtEnd: 1234 });

      expect(rpcCalls('log_ride_end_odometer')).toEqual([]);
    });

    it('updateRide writes purpose and passenger to ride_private_details, and null clears them', async () => {
      mockUserClient._pushResult({ data: fakeRow }); // own-ride lookup (nothing on rides to change)
      mockUserClient._pushResult({ data: { time_zone: null, purpose: 'tour', passenger: true } });

      const ride = await service.updateRide(userId, {
        rideId: 'ride-123',
        purpose: 'tour',
        passenger: true,
      });
      expect(mockUserClient._chain.update).not.toHaveBeenCalled();
      expect(upsertOf(privateDetailsQueries()[0])).toEqual([
        { ride_id: 'ride-123', user_id: userId, purpose: 'tour', passenger: true },
        { onConflict: 'ride_id' },
      ]);
      expect(ride).toMatchObject({ purpose: 'tour', passenger: true });

      mockUserClient._pushResult({ data: fakeRow });
      mockUserClient._pushResult({ data: { time_zone: null, purpose: null, passenger: true } });
      const cleared = await service.updateRide(userId, { rideId: 'ride-123', purpose: null });
      expect(upsertOf(privateDetailsQueries()[1])).toEqual([
        { ride_id: 'ride-123', user_id: userId, purpose: null },
        { onConflict: 'ride_id' },
      ]);
      expect(cleared.purpose).toBeUndefined();
    });

    it('updateRide leaves the answers alone when the input carries none', async () => {
      mockUserClient._pushResult({ data: { ...fakeRow, name: 'Loop' } });

      await service.updateRide(userId, { rideId: 'ride-123', name: 'Loop' });

      expect(privateDetailsQueries()).toEqual([]);
    });

    it('updateRide surfaces a failed answer write as a server error', async () => {
      mockUserClient._pushResult({ data: fakeRow });
      mockUserClient._pushResult({ data: null, error: { code: '57014', message: 'timeout' } });

      await expect(
        service.updateRide(userId, { rideId: 'ride-123', passenger: true }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it("updateRide never writes answers for a ride that is not the rider's", async () => {
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } });

      await expect(
        service.updateRide(userId, { rideId: 'ride-123', purpose: 'tour' }),
      ).rejects.toThrow(BadRequestException);
      expect(privateDetailsQueries()).toEqual([]);
    });

    it('marks a ride closed at the next start as stale_on_start', async () => {
      mockUserClient._pushResult({ data: null, error: { code: PG_ERROR.NOT_FOUND } });
      mockUserClient._pushResult({
        data: [{ id: 'stale-1', started_at: '2026-03-20T09:00:00Z' }],
        error: null,
      });
      mockUserClient._pushResult({ data: { recorded_at: '2026-03-20T10:00:00Z' } });
      mockUserClient._pushResult({ data: [{ id: 'stale-1' }], error: null });
      mockUserClient._pushResult({ data: fakeRow });

      await service.startRide(userId, {
        rideId: 'ride-123',
        startedAt: '2026-03-22T14:00:00Z',
      });

      expect(updateCall(0)).toMatchObject({
        status: 'completed',
        auto_ended_reason: 'stale_on_start',
        end_source: 'stale_on_start',
      });
    });

    const trackBump = expect.arrayContaining([
      { method: 'update', args: [{ track_updated_at: expect.any(String) }] },
      { method: 'eq', args: ['id', 'ride-123'] },
      { method: 'eq', args: ['user_id', userId] },
      { method: 'eq', args: ['status', 'completed'] },
    ]);

    it('a waypoint upload to a completed ride marks its track as changed', async () => {
      mockUserClient._pushResult({ data: { id: 'ride-123', status: 'completed' } });
      mockUserClient._pushResult({ count: 100 });
      mockUserClient._pushResult({ data: null, error: null }); // upsert
      mockUserClient._pushResult({ data: null, error: null }); // track_updated_at bump

      await service.uploadWaypoints(userId, {
        rideId: 'ride-123',
        waypoints: [{ recordedAt: '2026-03-22T16:00:00Z', latitude: 45, longitude: 14 }],
      });

      const bump = queriesFrom(mockUserClient._calls).at(-1);
      expect(bump?.table).toBe('rides');
      expect(bump?.ops).toEqual(trackBump);
    });

    // The ownership read said `recording`, but the ride ended between that read and
    // the waypoint insert. Deciding from the snapshot skipped the bump, so stats
    // computed at the end never saw this batch. The bump runs after every stored
    // batch and is conditional on the ride being completed at that moment, so a
    // still-recording ride's row is not touched (the update matches nothing).
    it('bumps the track of a ride that completed after the ownership read said recording', async () => {
      mockUserClient._pushResult({ data: { id: 'ride-123', status: 'recording' } });
      mockUserClient._pushResult({ count: 100 });
      mockUserClient._pushResult({ data: null, error: null }); // upsert
      mockUserClient._pushResult({ data: null, error: null }); // conditional bump

      await service.uploadWaypoints(userId, {
        rideId: 'ride-123',
        waypoints: [{ recordedAt: '2026-03-22T14:10:00Z', latitude: 45, longitude: 14 }],
      });

      const queries = queriesFrom(mockUserClient._calls);
      const upsertAt = queries.findIndex(
        (q) => q.table === 'ride_waypoints' && q.ops.some((op) => op.method === 'upsert'),
      );
      const bumpAt = queries.findIndex(
        (q) => q.table === 'rides' && q.ops.some((op) => op.method === 'update'),
      );
      expect(bumpAt).toBeGreaterThan(upsertAt);
      expect(upsertAt).toBeGreaterThanOrEqual(0);
      expect(queries[bumpAt].ops).toEqual(trackBump);
      // The only write to rides is that conditional bump.
      expect(mockUserClient._chain.update).toHaveBeenCalledTimes(1);
    });

    it('a failed waypoint insert never bumps the track', async () => {
      mockUserClient._pushResult({ data: { id: 'ride-123', status: 'completed' } });
      mockUserClient._pushResult({ count: 100 });
      mockUserClient._pushResult({ data: null, error: { code: '22003', message: 'out of range' } });

      await expect(
        service.uploadWaypoints(userId, {
          rideId: 'ride-123',
          waypoints: [{ recordedAt: '2026-03-22T16:00:00Z', latitude: 45, longitude: 14 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserClient._chain.update).not.toHaveBeenCalled();
    });

    describe('findWaypoints', () => {
      const POINTS = 2_500;
      const t0 = Date.parse('2026-03-22T14:00:00Z');
      const track = {
        total_points: POINTS,
        recorded_at: Array.from({ length: POINTS }, (_, i) =>
          new Date(t0 + i * 1000).toISOString(),
        ),
        latitude: Array.from({ length: POINTS }, (_, i) => 45 + i / 10_000),
        longitude: Array.from({ length: POINTS }, () => 14),
        altitude: Array.from({ length: POINTS }, () => 300),
        speed_mps: Array.from({ length: POINTS }, () => 20),
        heading: Array.from({ length: POINTS }, () => 90),
        accuracy: Array.from({ length: POINTS }, () => 5),
      };

      it('reads every point of a 2,500-point ride, so the sample spans the whole ride', async () => {
        mockUserClient._pushResult({ data: { id: 'ride-123' } });
        mockUserClient.rpc.mockResolvedValueOnce({ data: [track], error: null });

        const points = await service.findWaypoints(userId, 'ride-123', 1_000);

        expect(rpcCalls('ride_track_points')).toEqual([
          [
            'ride_track_points',
            { p_ride_id: 'ride-123', p_max_points: RIDE_WAYPOINT_LIMITS.MAX_PER_RIDE },
          ],
        ]);
        expect(points).toHaveLength(1_000);
        expect(points[0].recordedAt).toBe(track.recorded_at[0]);
        // The old capped select ended at fix 1,000; the whole ride ends at fix 2,500.
        expect(points.at(-1)?.recordedAt).toBe(track.recorded_at[POINTS - 1]);
      });

      it('drops fixes worse than the accuracy threshold before sampling', async () => {
        mockUserClient._pushResult({ data: { id: 'ride-123' } });
        mockUserClient.rpc.mockResolvedValueOnce({
          data: [
            {
              total_points: 3,
              recorded_at: ['2026-03-22T14:00:00Z', '2026-03-22T14:00:01Z', '2026-03-22T14:00:02Z'],
              latitude: [45, 45.1, 45.2],
              longitude: [14, 14, 14],
              altitude: [300, null, 310],
              speed_mps: [10, 11, 12],
              heading: [0, 0, 0],
              accuracy: [5, 500, null],
            },
          ],
          error: null,
        });

        const points = await service.findWaypoints(userId, 'ride-123');

        expect(points.map((p) => p.latitude)).toEqual([45, 45.2]);
        expect(points[1]).toMatchObject({ altitude: 310, speedMps: 12, accuracy: undefined });
      });

      it('returns an empty list for a ride with no fixes', async () => {
        mockUserClient._pushResult({ data: { id: 'ride-123' } });
        mockUserClient.rpc.mockResolvedValueOnce({ data: [], error: null });

        expect(await service.findWaypoints(userId, 'ride-123')).toEqual([]);
      });

      it('surfaces a failed track read as InternalServerErrorException', async () => {
        mockUserClient._pushResult({ data: { id: 'ride-123' } });
        mockUserClient.rpc.mockResolvedValueOnce({
          data: null,
          error: { code: '57014', message: 'statement timeout' },
        });

        await expect(service.findWaypoints(userId, 'ride-123')).rejects.toThrow(
          InternalServerErrorException,
        );
      });
    });

    it('getRideMilestoneStats selects the qualifying columns and counts an app auto-end', async () => {
      mockUserClient._pushResult({
        data: [
          {
            id: 'auto',
            status: 'completed',
            deleted_at: null,
            auto_ended_reason: null,
            distance_m: 8_000,
            started_at: '2026-10-10T10:00:00Z',
            ended_at: '2026-10-10T10:30:00Z',
            paused_duration_s: 0,
            auto_paused_duration_s: 0,
          },
        ],
      });

      const stats = await service.getRideMilestoneStats(userId, null);

      expect(stats).toEqual({ qualifyingRideCount: 1, longestQualifyingDistanceM: 8_000 });
      const [query] = queriesFrom(mockUserClient._calls);
      const columns = String(query.ops.find((op) => op.method === 'select')?.args[0]);
      for (const column of ['status', 'deleted_at', 'auto_ended_reason']) {
        expect(columns.split(/,\s*/)).toContain(column);
      }
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

    it('returns 0 without a quota read or upsert when every waypoint was dropped by the schema', async () => {
      // Only the ownership check runs; an empty upsert or quota read could fail
      // the op and dead-letter it, which tolerant ingest exists to prevent.
      mockUserClient._pushResult({ data: { id: 'ride-123' } });

      const result = await service.uploadWaypoints(userId, { rideId: 'ride-123', waypoints: [] });

      expect(result).toBe(0);
      expect(mockUserClient._chain.select).toHaveBeenCalledTimes(1);
      expect(mockUserClient._chain.upsert).not.toHaveBeenCalled();
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
    const rpcCalls = (name: string) =>
      mockUserClient.rpc.mock.calls.filter((call: unknown[]) => call[0] === name);

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

    it("logs the odometer read after the ride as the ride's end reading, in the bike unit", async () => {
      mockUserClient._pushResult({
        data: { ...fakeRow, status: 'completed', motorcycle_id: 'moto-456' },
      }); // 0: ride read
      mockUserClient._pushResult({ data: { current_mileage: 1000, distance_unit: 'mi' } }); // 1: bike

      await service.updateRide(userId, { rideId: 'ride-123', odometerAtEnd: 1250 });

      expect(rpcCalls('log_ride_end_odometer')).toEqual([
        ['log_ride_end_odometer', { p_ride_id: 'ride-123', p_value: 1250, p_unit: 'mi' }],
      ]);
    });

    // The RPC's deterministic refusals come back as 4xx, so the mobile sync queue
    // dead-letters the op once instead of retrying it at the head of the queue.
    it.each([
      ['22023', 'invalid_value'],
      ['22003', 'value "12463000000" is out of range for type integer'],
      [PG_ERROR.NO_DATA_FOUND, 'motorcycle_not_found'],
      [PG_ERROR.OBJECT_NOT_IN_PREREQUISITE_STATE, 'ride_not_completed'],
      [PG_ERROR.INSUFFICIENT_PRIVILEGE, 'not_authenticated'],
    ])('answers a refused odometer (%s) with BadRequestException', async (code, message) => {
      mockUserClient._pushResult({
        data: { ...fakeRow, status: 'completed', motorcycle_id: 'moto-456' },
      });
      mockUserClient._pushResult({ data: { current_mileage: 1000, distance_unit: 'km' } });
      mockUserClient.rpc.mockResolvedValueOnce({ data: null, error: { code, message } });

      const err = await service
        .updateRide(userId, { rideId: 'ride-123', odometerAtEnd: 1250 })
        .catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toContain(code);
    });

    it('keeps an unknown odometer failure retryable (not a 4xx)', async () => {
      mockUserClient._pushResult({
        data: { ...fakeRow, status: 'completed', motorcycle_id: 'moto-456' },
      });
      mockUserClient._pushResult({ data: { current_mileage: 1000, distance_unit: 'km' } });
      mockUserClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '57014', message: 'canceling statement due to statement timeout' },
      });

      const err = await service
        .updateRide(userId, { rideId: 'ride-123', odometerAtEnd: 1250 })
        .catch((e) => e);

      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(BadRequestException);
    });

    it('ignores an odometer for a ride without a bike', async () => {
      mockUserClient._pushResult({
        data: { ...fakeRow, status: 'completed', motorcycle_id: null },
      });

      await service.updateRide(userId, { rideId: 'ride-123', odometerAtEnd: 1250 });

      expect(rpcCalls('log_ride_end_odometer')).toEqual([]);
    });
  });

  describe('setRidePaused', () => {
    it('pauses an open ride and answers true', async () => {
      mockUserClient._pushResult({ data: [{ id: 'ride-123' }] });

      await expect(service.setRidePaused(userId, 'ride-123', true)).resolves.toBe(true);

      expect(mockUserClient._chain.update).toHaveBeenCalledWith({ status: 'paused' });
      // Only an open ride of this rider moves.
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockUserClient._chain.in).toHaveBeenCalledWith('status', ['recording', 'paused']);
      expect(mockUserClient._chain.is).toHaveBeenCalledWith('deleted_at', null);
    });

    it('resumes to recording', async () => {
      mockUserClient._pushResult({ data: [{ id: 'ride-123' }] });

      await expect(service.setRidePaused(userId, 'ride-123', false)).resolves.toBe(true);

      expect(mockUserClient._chain.update).toHaveBeenCalledWith({ status: 'recording' });
    });

    it('answers false, never an error, for a ride that is no longer open', async () => {
      // Ended by the rider or the idle sweep while the phone was offline: an error
      // here would dead-letter the ride's later ops in the phone's sync queue.
      mockUserClient._pushResult({ data: [] });

      await expect(service.setRidePaused(userId, 'ride-123', true)).resolves.toBe(false);
    });

    it('throws a retryable server error when the update itself fails', async () => {
      mockUserClient._pushResult({ data: null, error: { message: 'timeout', code: '57014' } });

      await expect(service.setRidePaused(userId, 'ride-123', true)).rejects.toThrow(
        InternalServerErrorException,
      );
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
      // applied to the new row whenever the statement reads table columns (the
      // WHERE clause alone does it), so stamping deleted_at gets the statement
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

    it("returns the owner's zone, end source and answers in one query", async () => {
      mockUserClient._pushResult({
        data: [
          {
            ...fakeRow,
            end_source: 'client_auto',
            ride_private_details: { time_zone: 'Europe/Vienna', purpose: 'tour', passenger: true },
          },
          { ...fakeRow, id: 'ride-456', end_source: null, ride_private_details: null },
        ],
        count: 2,
      });

      const result = await service.myRides(userId, 20);

      expect(result.edges.map((edge) => edge.node)).toEqual([
        expect.objectContaining({
          id: 'ride-123',
          timeZone: 'Europe/Vienna',
          endSource: 'client_auto',
          purpose: 'tour',
          passenger: true,
        }),
        expect.objectContaining({
          id: 'ride-456',
          timeZone: undefined,
          endSource: undefined,
          purpose: undefined,
          passenger: undefined,
        }),
      ]);
      // One query: the details are embedded, not fetched per ride.
      expect(mockUserClient.from).toHaveBeenCalledTimes(1);
      const columns = String(mockUserClient._chain.select.mock.calls[0][0]);
      expect(columns).toContain('end_source');
      expect(columns).toContain('ride_private_details(time_zone, purpose, passenger)');
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

    it('should throw InternalServerErrorException on a generic query failure', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });

      await expect(service.myRides(userId, 20)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw UnauthorizedException when PostgREST refuses the token', async () => {
      // The regression this guards: PGRST303 ("JWT issued at future") came back
      // as an opaque 500, so the client never refreshed and the alert paged
      // (MOTO-VAULT-NODE-NESTJS-C, 2026-08-27).
      mockUserClient._pushResult({
        data: null,
        error: { code: 'PGRST303', message: 'JWT issued at future' },
      });

      await expect(service.myRides(userId, 20)).rejects.toThrow(UnauthorizedException);
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

    it("returns the owner's zone and answers from ride_private_details", async () => {
      mockUserClient._pushResult({
        data: {
          ...fakeRow,
          ride_private_details: [{ time_zone: 'Asia/Tokyo', purpose: 'errand', passenger: false }],
        },
      });

      const result = await service.findById(userId, 'ride-123');

      expect(result).toMatchObject({ timeZone: 'Asia/Tokyo', purpose: 'errand', passenger: false });
      expect(String(mockUserClient._chain.select.mock.calls[0][0])).toContain(
        'ride_private_details(time_zone, purpose, passenger)',
      );
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
  describe('getRideMilestoneStats', () => {
    // 10 minutes elapsed; distance_m well over the 1 km floor.
    // The columns the query filters on are selected too, as the database returns them.
    const qualifyingRow = {
      id: 'ride-q1',
      status: 'completed',
      deleted_at: null,
      auto_ended_reason: null,
      distance_m: 12_000,
      started_at: '2026-10-10T10:00:00Z',
      ended_at: '2026-10-10T10:10:00Z',
      paused_duration_s: 0,
      auto_paused_duration_s: 0,
    };

    it('applies the R1 filters on the user client and excludes the open ride', async () => {
      mockUserClient._pushResult({ data: [qualifyingRow] });

      await service.getRideMilestoneStats(userId, 'ride-open');

      const [query] = queriesFrom(mockUserClient._calls);
      expect(query.table).toBe('rides');
      expect(query.ops).toEqual(
        expect.arrayContaining([
          { method: 'eq', args: ['user_id', userId] },
          { method: 'eq', args: ['status', 'completed'] },
          { method: 'is', args: ['deleted_at', null] },
          { method: 'is', args: ['auto_ended_reason', null] },
          { method: 'gte', args: ['distance_m', RIDE_MILESTONE_PAYWALL.QUALIFYING_MIN_DISTANCE_M] },
          { method: 'neq', args: ['id', 'ride-open'] },
        ]),
      );
    });

    it('reads past the first page so a heavy rider is never cut off at the row cap', async () => {
      const fullPage = Array.from({ length: 1_000 }, (_, i) => ({
        ...qualifyingRow,
        id: `r-${i}`,
      }));
      mockUserClient._pushResult({ data: fullPage });
      mockUserClient._pushResult({
        data: [{ ...qualifyingRow, id: 'r-long', distance_m: 90_000 }],
      });

      const stats = await service.getRideMilestoneStats(userId, null);

      expect(stats).toEqual({ qualifyingRideCount: 1_001, longestQualifyingDistanceM: 90_000 });
      expect(mockUserClient._chain.range).toHaveBeenNthCalledWith(1, 0, 999);
      expect(mockUserClient._chain.range).toHaveBeenNthCalledWith(2, 1_000, 1_999);
      // Offset paging needs a stable order, or rows can repeat or vanish between pages.
      expect(mockUserClient._chain.order).toHaveBeenCalledWith('id');
    });

    it('reads one more page after an exactly full one and stops on the empty page', async () => {
      const fullPage = Array.from({ length: 1_000 }, (_, i) => ({
        ...qualifyingRow,
        id: `r-${i}`,
      }));
      mockUserClient._pushResult({ data: fullPage });
      mockUserClient._pushResult({ data: [] });

      const stats = await service.getRideMilestoneStats(userId, null);

      expect(stats.qualifyingRideCount).toBe(1_000);
      expect(mockUserClient._chain.range).toHaveBeenCalledTimes(2);
    });

    it('skips the exclusion when no ride id is given', async () => {
      mockUserClient._pushResult({ data: [qualifyingRow] });

      await service.getRideMilestoneStats(userId, null);

      expect(mockUserClient._chain.neq).not.toHaveBeenCalled();
    });

    it('drops rides under the moving-time floor after subtracting manual AND auto pauses', async () => {
      const floorS = RIDE_MILESTONE_PAYWALL.QUALIFYING_MIN_MOVING_S;
      mockUserClient._pushResult({
        data: [
          // 4 minutes elapsed, 90 s auto-paused: 150 s moving, under the floor.
          {
            ...qualifyingRow,
            id: 'auto-paused-short',
            ended_at: '2026-10-10T10:04:00Z',
            auto_paused_duration_s: 90,
          },
          // 4 minutes elapsed, 90 s manually paused: same answer.
          {
            ...qualifyingRow,
            id: 'paused-short',
            ended_at: '2026-10-10T10:04:00Z',
            paused_duration_s: 90,
          },
          // Exactly the floor counts.
          {
            ...qualifyingRow,
            id: 'at-floor',
            ended_at: '2026-10-10T10:04:00Z',
            auto_paused_duration_s: 240 - floorS,
          },
          // Null pause columns read as 0.
          {
            ...qualifyingRow,
            id: 'null-pauses',
            paused_duration_s: null,
            auto_paused_duration_s: null,
          },
          // A row with no end timestamp never qualifies.
          { ...qualifyingRow, id: 'no-end', ended_at: null },
        ],
      });

      const stats = await service.getRideMilestoneStats(userId, null);

      expect(stats.qualifyingRideCount).toBe(2);
    });

    it('reports the longest surviving distance, rounded, and 0 when nothing qualifies', async () => {
      mockUserClient._pushResult({
        data: [
          { ...qualifyingRow, id: 'a', distance_m: 20_000.6 },
          { ...qualifyingRow, id: 'b', distance_m: 55_000.2 },
          // Longest raw row, but under the moving-time floor, so it must not win.
          { ...qualifyingRow, id: 'c', distance_m: 90_000, ended_at: '2026-10-10T10:01:00Z' },
        ],
      });
      expect(await service.getRideMilestoneStats(userId, null)).toEqual({
        qualifyingRideCount: 2,
        longestQualifyingDistanceM: 55_000,
      });

      const fresh = createMockClient();
      fresh._pushResult({ data: [] });
      const emptyService = new RidesService(
        fresh as never,
        fresh as never,
        mockEventEmitter as never,
      );
      expect(await emptyService.getRideMilestoneStats(userId, null)).toEqual({
        qualifyingRideCount: 0,
        longestQualifyingDistanceM: 0,
      });
    });

    it('surfaces a query failure as InternalServerErrorException', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });

      await expect(service.getRideMilestoneStats(userId, null)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

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
