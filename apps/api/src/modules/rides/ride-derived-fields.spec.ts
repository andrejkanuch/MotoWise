import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { clearTierCache } from '../../common/entitlements/resolve-tier';
import { RIDE_NEW_ROADS_RPC } from '../rider-insights/rider-insights.types';
import type { Ride } from './models/ride.model';
import { RideDerivedLoader } from './ride-derived.loader';
import { RidesResolver } from './rides.resolver';
import { RidesService } from './rides.service';

const OWNER = 'owner-1';
const RIDE_ID = 'ride-1';

/** A service-role fake: ride_stats rows, reference country names, the users tier row and RPCs. */
function fakeAdmin(options: {
  statsRows?: Array<Record<string, unknown>>;
  countryNames?: Record<string, string>;
  tier?: 'free' | 'pro';
  newRoads?: number | null;
}) {
  const selects: Array<{ table: string; columns: string; filters: Array<[string, unknown]> }> = [];
  const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
    data: options.newRoads ?? null,
    error: null,
  }));
  const from = vi.fn((table: string) => {
    const entry = { table, columns: '', filters: [] as Array<[string, unknown]> };
    selects.push(entry);
    const chain: Record<string, unknown> = {};
    chain.select = (columns: string) => {
      entry.columns = columns;
      return chain;
    };
    chain.eq = (column: string, value: unknown) => {
      entry.filters.push([column, value]);
      return chain;
    };
    // `.in()` ends every ride_stats read in the service.
    chain.in = async (column: string, value: unknown) => {
      entry.filters.push([column, value]);
      return { data: options.statsRows ?? [], error: null };
    };
    chain.limit = () => chain;
    chain.maybeSingle = async () => {
      const iso = entry.filters.find(([c]) => c === 'iso_a2')?.[1] as string;
      const name = options.countryNames?.[iso];
      return { data: name ? { name } : null, error: null };
    };
    chain.single = async () => ({
      data: {
        subscription_tier: options.tier ?? 'free',
        subscription_status: 'active',
        subscription_expires_at: null,
      },
      error: null,
    });
    return chain;
  });
  return { client: { from, rpc } as never, selects, rpc };
}

function ridesService(admin: ReturnType<typeof fakeAdmin>) {
  return new RidesService({} as never, admin.client, { emit: vi.fn() } as never);
}

/** Every column of a computed ride_stats row, Pro-group values included. */
const fullStatsRow = {
  ride_id: RIDE_ID,
  moving_time_s: 3_600,
  avg_moving_speed_mps: 15.2,
  max_speed_mps: 33.1,
  climb_m: 812,
  descent_m: 790,
  gps_quality: 0.93,
  stop_count: 2,
  countries: ['ES', 'FR'],
  start_place: 'Logroño',
  end_place: 'Jaca',
  band_km: { straight: 10, sweeping: 20, twisty: 30, tight: 5 },
  bends_count: 412,
  bends_per_km: 6.3,
  lean_bands: { under20: 0.5 },
  cells: ['617700169958293503'],
  start_cell: '617700169958293503',
};

beforeEach(() => {
  clearTierCache();
});

describe('RidesService derived ride fields', () => {
  it('stats hold the free allowlist only, even when the row carries Pro-group columns', async () => {
    const admin = fakeAdmin({ statsRows: [fullStatsRow] });
    const derived = await ridesService(admin).findDerivedByRideIds(OWNER, [RIDE_ID]);

    expect(Object.keys(derived.get(RIDE_ID)?.stats ?? {}).sort()).toEqual([
      'avgMovingSpeedMps',
      'climbM',
      'descentM',
      'gpsQuality',
      'maxSpeedMps',
      'movingTimeS',
      'stopCount',
    ]);
    expect(derived.get(RIDE_ID)).toMatchObject({
      countries: ['ES', 'FR'],
      startPlace: 'Logroño',
      endPlace: 'Jaca',
    });
    const read = admin.selects[0];
    for (const proColumn of ['band_km', 'bends', 'lean_bands', 'cells', 'start_cell']) {
      expect(read.columns).not.toContain(proColumn);
    }
    expect(read.filters).toContainEqual(['user_id', OWNER]);
  });

  it('newRoadsM is null for a free rider without reading the ride', async () => {
    const admin = fakeAdmin({ tier: 'free', newRoads: 4_200 });
    await expect(ridesService(admin).findNewRoadsM(OWNER, RIDE_ID)).resolves.toBeNull();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('newRoadsM is null for a Pro rider while the ride is pending, and 0 on known roads', async () => {
    const pending = fakeAdmin({ tier: 'pro', newRoads: null });
    await expect(ridesService(pending).findNewRoadsM(OWNER, RIDE_ID)).resolves.toBeNull();
    expect(pending.rpc).toHaveBeenCalledWith(RIDE_NEW_ROADS_RPC, {
      p_user_id: OWNER,
      p_ride_id: RIDE_ID,
    });

    clearTierCache();
    const known = fakeAdmin({ tier: 'pro', newRoads: 0 });
    await expect(ridesService(known).findNewRoadsM(OWNER, RIDE_ID)).resolves.toBe(0);
  });

  it('names the start country of each ride from the reference geodata', async () => {
    const admin = fakeAdmin({
      statsRows: [
        { ride_id: 'a', countries: ['PT', 'ES'] },
        { ride_id: 'b', countries: null },
      ],
      countryNames: { PT: 'Portugal' },
    });
    const names = await ridesService(admin).findStartCountryNames(['a', 'b']);
    expect([...names]).toEqual([['a', 'Portugal']]);
  });
});

describe('RidesResolver derived ride fields', () => {
  const ride = { id: RIDE_ID, userId: OWNER } as Ride;
  const owner = { id: OWNER } as AuthUser;
  const stranger = { id: 'someone-else' } as AuthUser;

  function resolverWith(admin: ReturnType<typeof fakeAdmin>) {
    const service = ridesService(admin);
    return new RidesResolver(service, new RideDerivedLoader(service));
  }

  it('resolves places, countries and stats for the owner only', async () => {
    const resolver = resolverWith(fakeAdmin({ statsRows: [fullStatsRow] }));
    expect(await resolver.startPlace(ride, owner)).toBe('Logroño');
    expect(await resolver.countries(ride, owner)).toEqual(['ES', 'FR']);
    expect(await resolver.stats(ride, owner)).toMatchObject({ climbM: 812, stopCount: 2 });

    for (const viewer of [stranger, undefined]) {
      expect(await resolver.startPlace(ride, viewer)).toBeNull();
      expect(await resolver.endPlace(ride, viewer)).toBeNull();
      expect(await resolver.countries(ride, viewer)).toBeNull();
      expect(await resolver.stats(ride, viewer)).toBeNull();
    }
  });

  it('gives the owner null stats while the ride is pending', async () => {
    const resolver = resolverWith(fakeAdmin({ statsRows: [] }));
    expect(await resolver.stats(ride, owner)).toBeNull();
  });

  it('newRoadsM is null for a non-owner, even a Pro one', async () => {
    const admin = fakeAdmin({ tier: 'pro', newRoads: 4_200 });
    const resolver = resolverWith(admin);
    expect(await resolver.newRoadsM(ride, { id: 'pro-stranger' } as AuthUser)).toBeNull();
    expect(await resolver.newRoadsM(ride, undefined)).toBeNull();
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(await resolver.newRoadsM(ride, owner)).toBe(4_200);
  });

  it('region keeps a stored value and otherwise names the start country, for any viewer', async () => {
    const resolver = resolverWith(
      fakeAdmin({
        statsRows: [{ ride_id: RIDE_ID, countries: ['AT'] }],
        countryNames: { AT: 'Austria' },
      }),
    );
    expect(await resolver.region({ ...ride, region: 'Tirol' } as Ride)).toBe('Tirol');
    expect(await resolver.region(ride)).toBe('Austria');
  });
});
