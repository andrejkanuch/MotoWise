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
  const state = { startedAt: 0 as number | undefined, totalPausedMs: 0 };
  return {
    __state: state,
    rideMMKV: {
      getStartedAt: () => state.startedAt,
      getTotalPausedMs: () => state.totalPausedMs,
      getTotalAutoPausedMs: () => 0,
      getMotorcycleId: () => '',
      getHudLayout: () => 'A',
      setCurrentId: jest.fn(),
      setStartedAt: jest.fn(),
      setMotorcycleId: jest.fn(),
    },
    flushBufferToMMKV: jest.fn(),
    getPointBuffer: jest.fn(() => []),
    getWaypointChunks: jest.fn(() => []),
    removeWaypointBuffer: jest.fn(),
  };
});
jest.mock('../../../utils/ride-sync-queue', () => ({ enqueueOrExecute: jest.fn() }));
jest.mock('../../../utils/ride-heatmap', () => ({ encodePolyline: jest.fn(() => null) }));
jest.mock('../../../lib/analytics', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvent: { RIDE_STARTED: 'ride_started', RIDE_ENDED: 'ride_ended' },
}));
jest.mock('../../../stores/ride.store', () => {
  const store = {
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

import { useRideStore } from '../../../stores/ride.store';
import * as gps from '../../../utils/ride-location';
import * as perms from '../../../utils/ride-permissions';
import * as storage from '../../../utils/ride-storage';
import * as syncQueue from '../../../utils/ride-sync-queue';
import { elapsedRideSeconds, startRideSession } from '../ride-controller';

// biome-ignore lint/suspicious/noExplicitAny: reaching into the mock's mutable state
const mmkvState = (storage as any).__state as {
  startedAt: number | undefined;
  totalPausedMs: number;
};
const checkPerms = perms.checkAndRequestPermissions as jest.Mock;
const startGPS = gps.startGPSListener as jest.Mock;
const rideMMKV = storage.rideMMKV as unknown as Record<string, jest.Mock>;
const enqueue = syncQueue.enqueueOrExecute as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mmkvState.startedAt = 0;
  mmkvState.totalPausedMs = 0;
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
    expect(useRideStore.getState().startRide).toHaveBeenCalledTimes(1);
    expect(startGPS).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith('startRide', expect.anything());
  });
});
