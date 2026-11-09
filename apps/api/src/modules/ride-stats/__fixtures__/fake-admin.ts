import { vi } from 'vitest';
import type { TrackPointsRow } from '../../../common/track-points';
import { drive, type Leg, mountainLoopLegs } from '../compute/__fixtures__/roads';
import { STALE_COUNT_RPC, STALE_RIDES_RPC } from '../ride-stats.service';
import { RIDE_PRIVATE_DETAILS_TABLE, type RideForStats } from '../ride-stats.types';

/**
 * Test doubles for the ride-stats service: a ride row, a track and a service-role client fake.
 * A fixture ride's `time_zone` is served from `ride_private_details` (null = no row there),
 * never from `rides`.
 */

const PLACES_READY = {
  reference_ready: true,
  countries: [{ iso_a2: 'ES', core_m: 20_000, first_at: 0 }],
  start_place: { name: 'Logroño', iso_a2: 'ES', admin1_code: '27' },
  end_place: null,
};

export function ride(id: string, overrides: Partial<RideForStats> = {}): RideForStats {
  return {
    id,
    user_id: `user-of-${id}`,
    motorcycle_id: null,
    status: 'completed',
    deleted_at: null,
    started_at: '2026-06-06T08:00:00Z',
    ended_at: '2026-06-06T08:30:00Z',
    distance_m: 20_000,
    route_polyline: null,
    time_zone: 'Europe/Madrid',
    ...overrides,
  };
}

export function pointsRow(legs: Leg[] = mountainLoopLegs(), speedMps = 12): TrackPointsRow {
  const f = drive(legs, { speedMps });
  return {
    total_points: f.length,
    recorded_at: f.map((x) => x.recordedAt),
    latitude: f.map((x) => x.latitude),
    longitude: f.map((x) => x.longitude),
    altitude: f.map((x) => x.altitude),
    speed_mps: f.map((x) => x.speedMps),
    heading: f.map((x) => x.heading),
    accuracy: f.map((x) => x.accuracy),
  };
}

interface FakeOptions {
  rides: Record<string, RideForStats>;
  points?: Record<string, TrackPointsRow>;
  stale?: Array<{ ride_id: string; user_id: string; is_synthetic: boolean; stale_since: string }>;
  staleCount?: number;
  places?: unknown;
  throwFor?: string[];
  /** Runs after the ride's track points are read, before the RPC returns them. */
  afterTrackRead?: (rideId: string) => Promise<void>;
}

function rideRow(ride: RideForStats): Omit<RideForStats, 'time_zone'> {
  const { time_zone: _zone, ...row } = ride;
  return row;
}

function privateDetails(ride: RideForStats) {
  return ride.time_zone === null
    ? null
    : { ride_id: ride.id, user_id: ride.user_id, time_zone: ride.time_zone };
}

/** Service-role client fake: rides by id, track points and the helper RPCs. */
export function fakeAdmin(options: FakeOptions) {
  const upserts: Array<{ table: string; row: Record<string, unknown>; onConflict?: string }> = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  const from = vi.fn((table: string) => {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'not', 'order', 'limit']) chain[m] = () => chain;
    chain.eq = (column: string, value: unknown) => {
      filters[column] = value;
      return chain;
    };
    chain.maybeSingle = async () => {
      if (table === 'rides') {
        const id = filters.id as string;
        if (options.throwFor?.includes(id)) return { data: null, error: { message: 'boom' } };
        const found = options.rides[id];
        return { data: found ? rideRow(found) : null, error: null };
      }
      if (table === RIDE_PRIVATE_DETAILS_TABLE) {
        const found = options.rides[filters.ride_id as string];
        return { data: found ? privateDetails(found) : null, error: null };
      }
      if (table === 'motorcycles') return { data: { type: 'sportbike' }, error: null };
      return { data: null, error: null };
    };
    chain.upsert = async (row: Record<string, unknown>, opts?: { onConflict?: string }) => {
      upserts.push({ table, row, onConflict: opts?.onConflict });
      return { error: null };
    };
    // biome-ignore lint/suspicious/noThenProperty: mimics a thenable PostgREST builder
    chain.then = (resolve: (v: unknown) => void) => {
      if (table !== RIDE_PRIVATE_DETAILS_TABLE) return resolve({ data: [], error: null });
      const rows = Object.values(options.rides)
        .filter((r) => r.user_id === filters.user_id)
        .map(privateDetails)
        .filter((r) => r !== null);
      return resolve({ data: rows, error: null });
    };
    return chain;
  });

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    if (name === 'ride_track_points') {
      const row = options.points?.[args.p_ride_id as string];
      await options.afterTrackRead?.(args.p_ride_id as string);
      return { data: row ? [row] : [], error: null };
    }
    if (name === 'ride_stats_places') return { data: options.places ?? PLACES_READY, error: null };
    if (name === STALE_RIDES_RPC) return { data: options.stale ?? [], error: null };
    if (name === STALE_COUNT_RPC) return { data: options.staleCount ?? 0, error: null };
    return { data: null, error: { message: `unknown rpc ${name}` } };
  });

  return { client: { from, rpc }, upserts, rpcCalls };
}
