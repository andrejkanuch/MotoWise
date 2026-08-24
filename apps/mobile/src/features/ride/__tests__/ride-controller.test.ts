// Focused tests for the shared ride-controller: the elapsed-from-timestamps math
// and the start-session orchestration (denied guard + happy-path side effects).
// The heavy collaborators (permissions, GPS listener, MMKV, sync, analytics) are
// mocked so we assert the controller's wiring, not their internals. Mocks are
// defined INSIDE each factory (the preset resolves modules before module-scope
// consts initialize) and read back through the imported mocked modules.

jest.mock('../../../utils/ride-permissions', () => ({
  checkAndRequestPermissions: jest.fn(() => Promise.resolve('full')),
}));
jest.mock('../../../utils/ride-location', () => ({
  startGPSListener: jest.fn(() => Promise.resolve()),
  stopGPSListener: jest.fn(() => Promise.resolve()),
  distanceMeters: jest.fn(() => 0),
}));
jest.mock('../../../utils/ride-storage', () => {
  const state = {
    startedAt: 0 as number | undefined,
    totalPausedMs: 0,
    pausedAt: 0,
    currentId: '',
  };
  return {
    __state: state,
    rideMMKV: {
      getCurrentId: () => state.currentId,
      getStartedAt: () => state.startedAt,
      getTotalPausedMs: () => state.totalPausedMs,
      getPausedAt: () => state.pausedAt,
      getTotalAutoPausedMs: () => 0,
      getMotorcycleId: () => 'bike-9',
      getHudLayout: () => 'A',
      setCurrentId: jest.fn((id: string) => {
        state.currentId = id;
      }),
      setStartedAt: jest.fn(),
      setMotorcycleId: jest.fn(),
      setTotalPausedMs: jest.fn((ms: number) => {
        state.totalPausedMs = ms;
      }),
      setPausedAt: jest.fn((ms: number) => {
        state.pausedAt = ms;
      }),
    },
    flushBufferToMMKV: jest.fn(),
    getPointBuffer: jest.fn(() => []),
    getWaypointChunks: jest.fn(() => []),
    removeWaypointBuffer: jest.fn(),
    resetWaypointBudget: jest.fn(),
    clearRideData: jest.fn(),
  };
});
jest.mock('../../../utils/ride-sync-queue', () => ({
  enqueueOrExecute: jest.fn(),
  enqueueWaypointUpload: jest.fn().mockResolvedValue(undefined),
}));
// Bike-less rides resolve the primary bike (cache-first, then fetch) so the odometer
// still tracks — mock the data seam; default to "no bikes cached / fetch empty".
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: jest.fn(() => Promise.resolve(undefined)),
}));
jest.mock('../../../lib/query-client', () => ({
  queryClient: { getQueryData: jest.fn(() => undefined) },
}));
jest.mock('../../../lib/query-keys', () => ({
  queryKeys: { motorcycles: { all: ['motorcycles'] } },
}));
jest.mock('../../../utils/ride-heatmap', () => ({ encodePolyline: jest.fn(() => 'poly') }));
jest.mock('../../../lib/analytics', () => ({
  trackEvent: jest.fn(),
  captureException: jest.fn(),
  AnalyticsEvent: { RIDE_STARTED: 'ride_started', RIDE_ENDED: 'ride_ended' },
}));
jest.mock('../../../stores/ride.store', () => {
  const store = {
    status: 'recording' as 'idle' | 'recording' | 'paused' | 'ended',
    startRide: jest.fn(),
    endRide: jest.fn(),
    setPermissionLevel: jest.fn(),
    maxLeanAngle: 0,
    isNightMode: false,
    isBatterySaver: false,
  };
  return { useRideStore: { getState: () => store } };
});
jest.mock('expo-crypto', () => ({ randomUUID: () => 'ride-uuid-1' }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Heavy: 'heavy' },
}));

import { gqlFetcher } from '../../../lib/graphql-client';
import { queryClient } from '../../../lib/query-client';
import { useRideStore } from '../../../stores/ride.store';
import * as gps from '../../../utils/ride-location';
import * as perms from '../../../utils/ride-permissions';
import * as storage from '../../../utils/ride-storage';
import * as syncQueue from '../../../utils/ride-sync-queue';
import { elapsedRideSeconds, endRideSession, startRideSession } from '../ride-controller';

// biome-ignore lint/suspicious/noExplicitAny: reaching into the mock's mutable state
const mmkvState = (storage as any).__state as {
  startedAt: number | undefined;
  totalPausedMs: number;
  pausedAt: number;
  currentId: string;
};
const checkPerms = perms.checkAndRequestPermissions as jest.Mock;
const startGPS = gps.startGPSListener as jest.Mock;
const rideMMKV = storage.rideMMKV as unknown as Record<string, jest.Mock>;
const clearRideData = storage.clearRideData as jest.Mock;
const getWaypointChunks = storage.getWaypointChunks as jest.Mock;
const getPointBuffer = storage.getPointBuffer as jest.Mock;
const enqueue = syncQueue.enqueueOrExecute as jest.Mock;
// Waypoint batches go through their own producer so they are always split to the
// server's per-upload max (MOTO-VAULT-REACT-NATIVE-1M).
const enqueueWaypoints = syncQueue.enqueueWaypointUpload as jest.Mock;
const store = useRideStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  mmkvState.startedAt = 0;
  mmkvState.totalPausedMs = 0;
  mmkvState.pausedAt = 0;
  mmkvState.currentId = '';
  store.status = 'recording';
  checkPerms.mockResolvedValue('full');
});

describe('elapsedRideSeconds', () => {
  it('returns 0 when no ride is started', () => {
    mmkvState.startedAt = undefined;
    expect(elapsedRideSeconds(1_000_000)).toBe(0);
  });

  it('subtracts paused time and never goes negative', () => {
    mmkvState.startedAt = 1_000_000;
    mmkvState.totalPausedMs = 30_000; // 30s paused
    expect(elapsedRideSeconds(1_000_000 + 90_000)).toBe(60); // 90s - 30s
    expect(elapsedRideSeconds(1_000_000 - 5_000)).toBe(0); // clamp
  });

  it('freezes while paused — subtracts the in-progress pause too', () => {
    mmkvState.startedAt = 1_000_000;
    mmkvState.totalPausedMs = 0;
    mmkvState.pausedAt = 1_000_000 + 60_000; // paused at +60s, still paused
    // 90s of wall clock, but paused since +60s -> elapsed frozen at 60s
    expect(elapsedRideSeconds(1_000_000 + 90_000)).toBe(60);
  });
});

describe('startRideSession', () => {
  it('bails without starting GPS when permission is denied', async () => {
    checkPerms.mockResolvedValueOnce('denied');
    const result = await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(result).toEqual({ ok: false, reason: 'denied' });
    expect(startGPS).not.toHaveBeenCalled();
    expect(rideMMKV.setCurrentId).not.toHaveBeenCalled();
  });

  it('mints a ride, flips the store, enqueues the server start, and starts GPS', async () => {
    const result = await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    expect(result).toEqual({ ok: true, rideId: 'ride-uuid-1' });
    expect(rideMMKV.setCurrentId).toHaveBeenCalledWith('ride-uuid-1');
    expect(rideMMKV.setMotorcycleId).toHaveBeenCalledWith('bike-1');
    expect(store.startRide).toHaveBeenCalledTimes(1);
    expect(startGPS).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith('startRide', expect.anything());
    // A previous ride's banked waypoint count would start this one part-way
    // through its cap and decimate a short ride for no reason.
    expect(storage.resetWaypointBudget).toHaveBeenCalledTimes(1);
  });

  it('rolls back (clears id, reverts store) and does NOT enqueue when GPS start throws', async () => {
    startGPS.mockRejectedValueOnce(new Error('location updates failed'));
    const result = await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(result).toEqual({ ok: false, reason: 'gps_failed' });
    expect(rideMMKV.setCurrentId).toHaveBeenLastCalledWith(''); // rolled back
    expect(store.endRide).toHaveBeenCalledTimes(1);
    expect(enqueue).not.toHaveBeenCalledWith('startRide', expect.anything());
  });

  it('attributes a bike-less ride (CarPlay / Quick Ride) to the cached primary bike', async () => {
    (queryClient.getQueryData as jest.Mock).mockReturnValueOnce({
      myMotorcycles: [
        { id: 'secondary', isPrimary: false },
        { id: 'primary-1', isPrimary: true },
      ],
    });
    const result = await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(result).toEqual({ ok: true, rideId: 'ride-uuid-1' });
    // The ride carries the primary bike so the API applies mileage on end (odometer).
    expect(rideMMKV.setMotorcycleId).toHaveBeenCalledWith('primary-1');
    expect(enqueue).toHaveBeenCalledWith(
      'startRide',
      expect.objectContaining({
        variables: { input: expect.objectContaining({ motorcycleId: 'primary-1' }) },
      }),
    );
  });

  it('fetches the primary bike when the list is not cached (cold CarPlay launch)', async () => {
    (queryClient.getQueryData as jest.Mock).mockReturnValueOnce(undefined);
    (gqlFetcher as jest.Mock).mockResolvedValueOnce({
      myMotorcycles: [{ id: 'primary-2', isPrimary: true }],
    });
    await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(rideMMKV.setMotorcycleId).toHaveBeenCalledWith('primary-2');
  });

  it('leaves the ride bike-less when the rider has no bikes (no odometer target)', async () => {
    (queryClient.getQueryData as jest.Mock).mockReturnValueOnce({ myMotorcycles: [] });
    const result = await startRideSession({ motorcycleId: null, source: 'phone' });
    expect(result).toEqual({ ok: true, rideId: 'ride-uuid-1' });
    expect(rideMMKV.setMotorcycleId).not.toHaveBeenCalled();
  });
});

describe('endRideSession', () => {
  const wp = (latitude: number, longitude: number, altitude: number, speedMps: number) => ({
    latitude,
    longitude,
    altitude,
    speedMps,
    recordedAt: '2026-06-28T00:00:00.000Z',
  });

  it('returns null and is inert when no ride is active', () => {
    mmkvState.currentId = '';
    const result = endRideSession('carplay');
    expect(result).toBeNull();
    expect(store.endRide).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(enqueueWaypoints).not.toHaveBeenCalled();
  });

  it('aggregates waypoints, stops GPS, and enqueues both uploads and the end', () => {
    mmkvState.currentId = 'ride-7';
    mmkvState.startedAt = 1_000_000;
    getWaypointChunks.mockReturnValueOnce([[wp(0, 0, 100, 10), wp(0, 0, 110, 20)]]);
    getPointBuffer.mockReturnValueOnce([wp(0, 0, 115, 30)]);

    const summary = endRideSession('phone');

    expect(store.endRide).toHaveBeenCalledTimes(1);
    expect(enqueueWaypoints).toHaveBeenCalledWith('ride-7', [wp(0, 0, 115, 30)]);
    expect(enqueue).toHaveBeenCalledWith('endRide', expect.anything());
    expect(summary).toMatchObject({ rideId: 'ride-7', maxSpeedMps: 30, motorcycleId: 'bike-9' });
  });

  it('does not clear ride data on end — the ride-summary screen owns cleanup', () => {
    // Both a phone End and a CarPlay Stop now route to the ride-summary screen,
    // which reads the waypoint chunks to draw the route and clears the data on
    // save/discard. endRideSession must NOT clear, for either source, or the
    // summary would have nothing to render.
    mmkvState.currentId = 'ride-cp';
    endRideSession('carplay');
    expect(clearRideData).not.toHaveBeenCalled();

    mmkvState.currentId = 'ride-ph';
    endRideSession('phone');
    expect(clearRideData).not.toHaveBeenCalled();
  });

  it('is idempotent on a double-Stop — returns null and does not re-end when already ended', () => {
    // endRideSession deliberately leaves the persisted ride id set (the summary owns
    // cleanup), so a second Stop (or a Stop racing the auto-end timer) must not re-run
    // the end path or enqueue a duplicate EndRide. Once the store is 'ended', it bails.
    mmkvState.currentId = 'ride-dup';
    store.status = 'ended';
    const result = endRideSession('carplay');
    expect(result).toBeNull();
    expect(store.endRide).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalledWith('endRide', expect.anything());
  });
});
