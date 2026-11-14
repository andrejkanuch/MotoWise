// Focused tests for the shared ride-controller: the elapsed-from-timestamps math
// and the start-session orchestration (denied guard + happy-path side effects).
// The heavy collaborators (permissions, GPS listener, MMKV, sync, analytics) are
// mocked so we assert the controller's wiring, not their internals. Mocks are
// defined INSIDE each factory (the preset resolves modules before module-scope
// consts initialize) and read back through the imported mocked modules.

jest.mock('@/utils/ride-permissions', () => ({
  checkAndRequestPermissions: jest.fn(() => Promise.resolve('full')),
  readPermissionLevel: jest.fn(() => Promise.resolve('full')),
  isApproximateLocation: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('@/utils/ride-reminders', () => ({
  armRideReminders: jest.fn(() => Promise.resolve()),
  cancelRideReminders: jest.fn(() => Promise.resolve()),
  rideEndTrimTarget: jest.fn(() => 1_200_000),
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted', canAskAgain: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}));
jest.mock('@/utils/ride-location', () => ({
  endAutoPauseEpisode: jest.fn(),
  gpsStartInFlight: jest.fn(() => false),
  startGPSListener: jest.fn(() => Promise.resolve()),
  stopGPSListener: jest.fn(() => Promise.resolve()),
  isLocationRecording: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('@/utils/ride-storage', () => {
  const state = {
    startedAt: 0 as number | undefined,
    totalPausedMs: 0,
    totalAutoPausedMs: 0,
    pausedAt: 0,
    currentId: '',
    status: undefined as string | undefined,
    endedSummary: undefined as string | undefined,
  };
  const PHASE = { RECORDING: 'recording', PAUSED: 'paused', ENDED: 'ended' };
  return {
    __state: state,
    RIDE_PHASE: PHASE,
    // Mirrors the real normalization: no id → no ride; an open pause → paused.
    readRideRecord: () =>
      state.currentId
        ? {
            rideId: state.currentId,
            phase:
              state.status === PHASE.ENDED
                ? PHASE.ENDED
                : state.status === PHASE.PAUSED || state.pausedAt > 0
                  ? PHASE.PAUSED
                  : PHASE.RECORDING,
            startedAt: state.startedAt,
            recordingSubState: 'moving',
            gpsPermissionLost: false,
          }
        : null,
    clearCurrentRide: jest.fn(() => {
      state.currentId = '';
      state.status = undefined;
      state.endedSummary = undefined;
    }),
    rideMMKV: {
      getCurrentId: () => state.currentId,
      setStatus: jest.fn((status: string) => {
        state.status = status;
      }),
      getEndedSummaryJson: () => state.endedSummary,
      setEndedSummaryJson: jest.fn((json: string) => {
        state.endedSummary = json;
      }),
      getStartedAt: () => state.startedAt,
      getTotalPausedMs: () => state.totalPausedMs,
      getPausedAt: () => state.pausedAt,
      getTotalAutoPausedMs: () => state.totalAutoPausedMs,
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
    restoreBufferFromMMKV: jest.fn(),
    resetWaypointBudget: jest.fn(),
    clearRideData: jest.fn(),
  };
});
jest.mock('@/utils/ride-sync-queue', () => ({
  deleteEndedRide: jest.fn(() => Promise.resolve()),
  enqueueOrExecute: jest.fn(),
  enqueueWaypointUpload: jest.fn().mockResolvedValue(undefined),
}));
// Bike-less rides resolve the primary bike (cache-first, then fetch) so the odometer
// still tracks — mock the data seam; default to "no bikes cached / fetch empty".
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: jest.fn(() => Promise.resolve(undefined)),
}));
jest.mock('@/lib/query-client', () => ({
  queryClient: { getQueryData: jest.fn(() => undefined), invalidateQueries: jest.fn() },
}));
jest.mock('@/lib/query-keys', () => ({
  queryKeys: { motorcycles: { all: ['motorcycles'] }, rides: { all: ['rides'] } },
}));
jest.mock('@/lib/invalidate', () => ({ invalidateSavedRide: jest.fn() }));
jest.mock('@/lib/ride-analytics', () => ({
  RIDE_SAVE_TRIGGER: { NEW_RIDE: 'new_ride' },
  RIDE_DISCARD_REASON: { BELOW_FLOOR: 'below_floor', RIDER: 'rider' },
  RIDE_DISCARD_TRIGGER: { GUARD: 'guard', AUTO_END: 'auto_end', SUMMARY: 'summary' },
  trackRideCompleted: jest.fn(),
  trackRideDiscarded: jest.fn(),
}));
jest.mock('@/utils/ride-heatmap', () => ({ encodePolyline: jest.fn(() => 'poly') }));
jest.mock('@/lib/analytics', () => ({
  trackEvent: jest.fn(),
  captureException: jest.fn(),
  AnalyticsEvent: {
    RIDE_STARTED: 'ride_started',
    RIDE_ENDED: 'ride_ended',
    RIDE_PAUSED: 'ride_paused',
    RIDE_RESUMED: 'ride_resumed',
  },
}));
jest.mock('@/stores/ride.store', () => {
  const store = {
    status: 'recording' as 'idle' | 'recording' | 'paused' | 'ended',
    startRide: jest.fn(),
    endRide: jest.fn(),
    hydrate: jest.fn(),
    setPermissionLevel: jest.fn(),
    isNightMode: false,
    isBatterySaver: false,
    distance: 0,
  };
  return { useRideStore: { getState: () => store, setState: jest.fn() } };
});
jest.mock('expo-localization', () => ({
  getCalendars: jest.fn(() => [{ timeZone: 'Europe/Bratislava' }]),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'ride-uuid-1' }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Heavy: 'heavy' },
}));

import * as Localization from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { trackEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { invalidateSavedRide } from '@/lib/invalidate';
import { queryClient } from '@/lib/query-client';
import { trackRideCompleted, trackRideDiscarded } from '@/lib/ride-analytics';
import { useRideStore } from '@/stores/ride.store';
import * as gps from '@/utils/ride-location';
import * as perms from '@/utils/ride-permissions';
import * as reminders from '@/utils/ride-reminders';
import * as storage from '@/utils/ride-storage';
import * as syncQueue from '@/utils/ride-sync-queue';
import {
  buildRideSummaryHref,
  discardEndedRide,
  elapsedRideSeconds,
  endRecoveredRide,
  endRideSession,
  endRideWithoutSaving,
  finalizeEndedRide,
  pauseRideSession,
  readEndedRideSummary,
  resumeRecoveredRide,
  resumeRideSession,
  startRideSession,
} from '../ride-controller';

// biome-ignore lint/suspicious/noExplicitAny: reaching into the mock's mutable state
const mmkvState = (storage as any).__state as {
  startedAt: number | undefined;
  totalPausedMs: number;
  totalAutoPausedMs: number;
  pausedAt: number;
  currentId: string;
  status: string | undefined;
  endedSummary: string | undefined;
};
const checkPerms = perms.checkAndRequestPermissions as jest.Mock;
const readPerms = perms.readPermissionLevel as jest.Mock;
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
const isApproximate = perms.isApproximateLocation as jest.Mock;
const restoreBuffer = storage.restoreBufferFromMMKV as jest.Mock;
const armReminders = reminders.armRideReminders as jest.Mock;
const cancelReminders = reminders.cancelRideReminders as jest.Mock;
const notifPerms = Notifications.getPermissionsAsync as jest.Mock;
const requestNotifPerms = Notifications.requestPermissionsAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mmkvState.startedAt = 0;
  mmkvState.totalPausedMs = 0;
  mmkvState.totalAutoPausedMs = 0;
  mmkvState.pausedAt = 0;
  mmkvState.currentId = '';
  mmkvState.status = undefined;
  mmkvState.endedSummary = undefined;
  store.status = 'recording';
  (gps.isLocationRecording as jest.Mock).mockResolvedValue(true);
  checkPerms.mockResolvedValue('full');
  readPerms.mockResolvedValue('full');
  isApproximate.mockResolvedValue(false);
  notifPerms.mockResolvedValue({ status: 'granted', canAskAgain: true });
  getPointBuffer.mockReturnValue([]);
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
    readPerms.mockResolvedValueOnce('denied');
    const result = await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(result).toEqual({ ok: false, reason: 'denied' });
    expect(startGPS).not.toHaveBeenCalled();
    expect(rideMMKV.setCurrentId).not.toHaveBeenCalled();
  });

  // A CarPlay Start must never raise an iPhone permission prompt: the rider can't
  // answer it on the bike, and iOS holds it back until the phone app is in front, so
  // the awaited request never settles and Start looks dead.
  it('only READS permission for a CarPlay start (never requests)', async () => {
    await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(readPerms).toHaveBeenCalledTimes(1);
    expect(checkPerms).not.toHaveBeenCalled();
  });

  it('lets the phone start request permission as before', async () => {
    await startRideSession({ motorcycleId: null, source: 'phone' });
    expect(checkPerms).toHaveBeenCalledTimes(1);
    expect(readPerms).not.toHaveBeenCalled();
  });

  it('records a CarPlay ride on When-In-Use alone (foreground_only)', async () => {
    readPerms.mockResolvedValueOnce('foreground_only');
    const result = await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(result).toEqual({ ok: true, rideId: 'ride-uuid-1' });
    expect(store.setPermissionLevel).toHaveBeenCalledWith('foreground_only');
    expect(startGPS).toHaveBeenCalledTimes(1);
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

  it("sends the device's time zone with the server start", async () => {
    await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    const startCall = enqueue.mock.calls.find(([type]) => type === 'startRide');
    expect(startCall?.[1].variables.input).toMatchObject({
      rideId: 'ride-uuid-1',
      timeZone: 'Europe/Bratislava',
    });
  });

  it('sends no time zone when the device calendar has none', async () => {
    (Localization.getCalendars as jest.Mock).mockReturnValueOnce([{ timeZone: null }]);
    await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    const startCall = enqueue.mock.calls.find(([type]) => type === 'startRide');
    expect(startCall?.[1].variables.input).not.toHaveProperty('timeZone');
  });

  it('rolls back (removes the id, re-projects the store) and does NOT enqueue when GPS start throws', async () => {
    startGPS.mockRejectedValueOnce(new Error('location updates failed'));
    const result = await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(result).toEqual({ ok: false, reason: 'gps_failed' });
    // The key is removed, never set to '' (older readers took '' for a ride), and the
    // store is re-projected from storage — back to idle, not stuck at 'ended'.
    expect(storage.clearCurrentRide).toHaveBeenCalledTimes(1);
    expect(mmkvState.currentId).toBe('');
    expect(store.hydrate).toHaveBeenCalled();
    expect(store.endRide).not.toHaveBeenCalled();
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
    getPointBuffer.mockReturnValue([wp(0, 0, 115, 30)]);

    const summary = endRideSession('phone');

    expect(store.endRide).toHaveBeenCalledTimes(1);
    expect(enqueueWaypoints).toHaveBeenCalledWith('ride-7', [wp(0, 0, 115, 30)]);
    expect(enqueue).toHaveBeenCalledWith('endRide', expect.anything());
    expect(summary).toMatchObject({ rideId: 'ride-7', maxSpeedMps: 30, motorcycleId: 'bike-9' });
  });

  it('says how the ride ended: the phone Stop and the CarPlay Stop', () => {
    const endSourceOf = () =>
      enqueue.mock.calls.filter(([type]) => type === 'endRide').at(-1)?.[1].variables.input
        .endSource;

    mmkvState.currentId = 'ride-ph';
    endRideSession('phone');
    expect(endSourceOf()).toBe('rider_phone');

    mmkvState.currentId = 'ride-cp';
    mmkvState.status = undefined;
    store.status = 'recording';
    endRideSession('carplay');
    expect(endSourceOf()).toBe('rider_carplay');
  });

  it("sends the summary's climb and drops the constant GPS quality and lean", () => {
    mmkvState.currentId = 'ride-climb';
    mmkvState.startedAt = 1_000_000;
    getWaypointChunks.mockReturnValueOnce([
      [100, 100, 103, 110, 120, 121, 130, 130].map((alt, i) => ({
        ...wp(0, i * 0.0001, alt, 10),
        recordedAt: new Date(1_000_000 + i * 1000).toISOString(),
      })),
    ]);

    const summary = endRideSession('phone');
    const input = enqueue.mock.calls.find(([type]) => type === 'endRide')?.[1].variables.input;

    // Median-of-5 then 5 m hysteresis: 100 → 110 → 120 → 130.
    expect(summary?.elevationGain).toBe(30);
    expect(input.elevationGain).toBe(30);
    expect(input).not.toHaveProperty('gpsQuality');
    expect(input).not.toHaveProperty('maxLeanAngle');
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

  it("carries the server's moving time to the summary and its route, separately from durationS", () => {
    // The summary's durationS is the displayed clock (manual pauses only); the
    // server's moving time also subtracts auto-pauses, so the summary needs that
    // number to apply R1 the same way the server does.
    jest.spyOn(Date, 'now').mockReturnValue(1_240_000);
    mmkvState.currentId = 'ride-ap';
    mmkvState.startedAt = 1_000_000;
    mmkvState.totalAutoPausedMs = 90_000;

    const summary = endRideSession('phone');

    expect(summary).toMatchObject({ durationS: 240, movingTimeS: 150 });
    const endCall = enqueue.mock.calls.find(([type]) => type === 'endRide');
    expect(endCall?.[1].variables.input.autoPausedDurationS).toBe(90);
    const ended = summary as NonNullable<typeof summary>;
    expect(buildRideSummaryHref(ended)).toMatchObject({
      params: expect.objectContaining({ durationS: '240', movingTimeS: '150', recovered: '' }),
    });
    expect(buildRideSummaryHref(ended, { recovered: true })).toMatchObject({
      params: expect.objectContaining({ recovered: '1' }),
    });
    (Date.now as jest.Mock).mockRestore();
  });

  it('ends the unfinished ride Start Ride found, trimmed, and marks its summary recovered', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_240_000);
    mmkvState.currentId = 'ride-crashed';
    mmkvState.startedAt = 1_000_000;

    const href = endRecoveredRide();

    expect(href).toMatchObject({
      pathname: '/(modals)/ride-summary',
      params: expect.objectContaining({ rideId: 'ride-crashed', recovered: '1' }),
    });
    (Date.now as jest.Mock).mockRestore();
  });

  it('returns no summary when there is no unfinished ride to end', () => {
    mmkvState.currentId = '';
    expect(endRecoveredRide()).toBeNull();
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

describe('startRideSession — forgotten-ride reminders and location quality', () => {
  it('arms the still-riding reminders once GPS is running', async () => {
    const result = await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    expect(result).toEqual({ ok: true, rideId: 'ride-uuid-1' });
    expect(armReminders).toHaveBeenCalledTimes(1);
  });

  it('cancels reminders and never arms them when GPS start fails', async () => {
    startGPS.mockRejectedValueOnce(new Error('boom'));
    const result = await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    expect(result).toEqual({ ok: false, reason: 'gps_failed' });
    expect(cancelReminders).toHaveBeenCalled();
    expect(armReminders).not.toHaveBeenCalled();
  });

  it('stops a phone start on approximate location, before minting a ride', async () => {
    isApproximate.mockResolvedValueOnce(true);
    const result = await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    expect(result).toEqual({ ok: false, reason: 'approximate' });
    expect(startGPS).not.toHaveBeenCalled();
    expect(rideMMKV.setCurrentId).not.toHaveBeenCalled();
  });

  it('starts anyway on approximate location when the rider chose to', async () => {
    isApproximate.mockResolvedValue(true);
    const result = await startRideSession({
      motorcycleId: 'bike-1',
      source: 'phone',
      allowApproximate: true,
    });
    expect(result.ok).toBe(true);
  });

  it('never blocks a CarPlay start on approximate location (no way to ask there)', async () => {
    isApproximate.mockResolvedValue(true);
    const result = await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(result.ok).toBe(true);
    expect(isApproximate).not.toHaveBeenCalled();
  });

  it('asks for notification permission on a phone start only when undetermined', async () => {
    notifPerms.mockResolvedValueOnce({ status: 'undetermined', canAskAgain: true });
    await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    expect(requestNotifPerms).toHaveBeenCalledTimes(1);

    requestNotifPerms.mockClear();
    notifPerms.mockResolvedValueOnce({ status: 'denied', canAskAgain: false });
    await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    expect(requestNotifPerms).not.toHaveBeenCalled();
  });

  it('never prompts for notifications from CarPlay', async () => {
    notifPerms.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(requestNotifPerms).not.toHaveBeenCalled();
  });
});

describe('endRideSession — trimmed end', () => {
  it('ends at the given time: duration and endedAt stop at the last movement', () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000_000);
    mmkvState.currentId = 'ride-trim';
    mmkvState.startedAt = 1_000_000;

    const summary = endRideSession('phone', { endAt: 4_000_000 });

    expect(summary?.durationS).toBe(3_000);
    const endCall = enqueue.mock.calls.find(([type]) => type === 'endRide');
    expect(endCall?.[1].variables.input.endedAt).toBe(new Date(4_000_000).toISOString());
    (Date.now as jest.Mock).mockRestore();
  });

  it('banks only the part of an open pause that falls before the trimmed end', () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000_000);
    mmkvState.currentId = 'ride-trim-pause';
    mmkvState.startedAt = 1_000_000;
    mmkvState.pausedAt = 3_000_000;

    const summary = endRideSession('phone', { endAt: 4_000_000 });

    // 3,000 s from start to end, minus the 1,000 s paused before the end point.
    expect(summary?.durationS).toBe(2_000);
    (Date.now as jest.Mock).mockRestore();
  });

  it('restores the on-disk partial buffer when memory is empty (ended after an app kill)', () => {
    mmkvState.currentId = 'ride-restored';
    getPointBuffer.mockReturnValue([]);
    endRideSession('phone');
    expect(restoreBuffer).toHaveBeenCalledWith('ride-restored');
  });

  it('does not touch the on-disk buffer when this process still holds points', () => {
    mmkvState.currentId = 'ride-live';
    getPointBuffer.mockReturnValue([wpAt(1, 1)]);
    endRideSession('phone');
    expect(restoreBuffer).not.toHaveBeenCalled();
  });
});

function wpAt(latitude: number, longitude: number) {
  return { latitude, longitude, altitude: 0, speedMps: 5, recordedAt: '2026-10-04T00:00:00.000Z' };
}

describe('one persisted ride — start, end, review', () => {
  it('persists the phase as recording when a ride starts', async () => {
    await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    expect(mmkvState.status).toBe('recording');
  });

  it('never mints a second ride while one is recording: Start leads to it', async () => {
    mmkvState.currentId = 'ride-open';
    mmkvState.status = 'recording';
    const result = await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(result).toEqual({ ok: true, rideId: 'ride-open' });
    expect(rideMMKV.setCurrentId).not.toHaveBeenCalled();
    // Leading to a running ride confirms it: entry points go to its HUD again.
    expect(useRideStore.setState).toHaveBeenCalledWith({ recordingInterrupted: false });
    expect(enqueue).not.toHaveBeenCalledWith('startRide', expect.anything());
  });

  it('restarts GPS for the open ride when the app was killed and it is not recording', async () => {
    mmkvState.currentId = 'ride-open';
    mmkvState.status = 'paused';
    (gps.isLocationRecording as jest.Mock).mockResolvedValue(false);
    const result = await startRideSession({ motorcycleId: null, source: 'carplay' });
    expect(result).toEqual({ ok: true, rideId: 'ride-open' });
    expect(startGPS).toHaveBeenCalledTimes(1);
    // A paused ride stays paused; its reminders are re-armed for the phase (the
    // single "still paused" one — ride-reminders picks the set).
    expect(mmkvState.status).toBe('paused');
    expect(armReminders).toHaveBeenCalledTimes(1);
  });

  it('saves an ended-but-unreviewed ride as it stands, then starts the new one', async () => {
    mmkvState.currentId = 'ride-ended';
    mmkvState.status = 'ended';
    mmkvState.endedSummary = JSON.stringify({
      rideId: 'ride-ended',
      distanceM: 8_200,
      durationS: 900,
      maxSpeedMps: 20,
      avgSpeedMps: 9,
      elevationGain: 40,
      elevationLoss: 30,
      movingTimeS: 840,
      motorcycleId: 'bike-old',
    });
    const result = await startRideSession({ motorcycleId: 'bike-1', source: 'carplay' });
    expect(clearRideData).toHaveBeenCalledWith('ride-ended');
    expect(result).toEqual({ ok: true, rideId: 'ride-uuid-1' });
    // Kept as it stands is still a saved ride: counted once, and the caches the
    // end changed (rides, odometer) refreshed.
    expect(trackRideCompleted).toHaveBeenCalledWith({
      trigger: 'new_ride',
      rideId: 'ride-ended',
      motorcycleId: 'bike-old',
      distanceM: 8_200,
      durationS: 900,
    });
    expect(invalidateSavedRide).toHaveBeenCalledTimes(1);
  });

  it('ends a ride that was not recording trimmed and recovered, for the calling surface', () => {
    mmkvState.currentId = 'ride-open';
    mmkvState.status = 'recording';
    mmkvState.startedAt = 1_000_000;
    const href = endRecoveredRide('carplay');
    expect(href).toEqual(
      expect.objectContaining({ params: expect.objectContaining({ recovered: '1' }) }),
    );
    expect(trackEvent).toHaveBeenCalledWith(
      'ride_ended',
      expect.objectContaining({ ride_id: 'ride-open', source: 'carplay' }),
    );
  });

  it('banks a stop the GPS was still timing when the ride ends', () => {
    mmkvState.currentId = 'ride-open';
    mmkvState.status = 'recording';
    mmkvState.startedAt = 1_000_000;
    endRideSession('phone', { endAt: 1_500_000 });
    // Up to where the ride really ended (a trimmed end stops at the last movement).
    expect(gps.endAutoPauseEpisode).toHaveBeenCalledWith(1_500_000);
  });

  it('persists the end and a reviewable summary for the same ride', () => {
    mmkvState.currentId = 'ride-7';
    mmkvState.startedAt = Date.now() - 60_000;
    const summary = endRideSession('carplay');
    expect(mmkvState.status).toBe('ended');
    expect(readEndedRideSummary()).toEqual(summary);
  });

  it('will not end an ended ride again, even after a kill reset the store', () => {
    mmkvState.currentId = 'ride-7';
    mmkvState.status = 'ended';
    store.status = 'idle';
    expect(endRideSession('phone')).toBeNull();
    expect(enqueue).not.toHaveBeenCalledWith('endRide', expect.anything());
  });

  it('has no summary to review for a ride that is not ended, or a corrupt one', () => {
    mmkvState.currentId = 'ride-7';
    mmkvState.status = 'recording';
    mmkvState.endedSummary = JSON.stringify({ rideId: 'ride-7' });
    expect(readEndedRideSummary()).toBeNull();
    mmkvState.status = 'ended';
    mmkvState.endedSummary = '{not json';
    expect(readEndedRideSummary()).toBeNull();
    mmkvState.endedSummary = JSON.stringify({ rideId: 'another-ride', distanceM: 1 });
    expect(readEndedRideSummary()).toBeNull();
  });

  it('finalizing a reviewed ride clears only that ride and re-projects the store', () => {
    finalizeEndedRide('ride-7');
    expect(clearRideData).toHaveBeenCalledWith('ride-7');
    expect(store.hydrate).toHaveBeenCalled();
  });

  it('resumes a recovered ride: stats re-projected, GPS restarted, reminders for a moving ride', async () => {
    mmkvState.currentId = 'ride-open';
    mmkvState.status = 'recording';
    await expect(resumeRecoveredRide()).resolves.toBe(true);
    expect(store.hydrate).toHaveBeenCalled();
    expect(startGPS).toHaveBeenCalledTimes(1);
    expect(armReminders).toHaveBeenCalledTimes(1);
    // Never through store.startRide(), which zeroes distance and top speed.
    expect(store.startRide).not.toHaveBeenCalled();
  });

  it('a resumed ride is confirmed recording (no longer interrupted)', async () => {
    mmkvState.currentId = 'ride-open';
    mmkvState.status = 'recording';
    await resumeRecoveredRide();
    expect(useRideStore.setState).toHaveBeenCalledWith({ recordingInterrupted: false });
  });

  it('two overlapping starts (phone + CarPlay) mint one ride, not two', async () => {
    let releasePermission!: (level: string) => void;
    checkPerms.mockReturnValueOnce(
      new Promise((resolve) => {
        releasePermission = resolve;
      }),
    );
    const phone = startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    const carplay = startRideSession({ motorcycleId: null, source: 'carplay' });
    releasePermission('full');
    const [a, b] = await Promise.all([phone, carplay]);
    expect(a).toEqual(b);
    expect(rideMMKV.setCurrentId).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls.filter(([op]) => op === 'startRide')).toHaveLength(1);
  });

  it('a later start is a fresh start once the first has settled', async () => {
    await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    mmkvState.currentId = '';
    await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    expect(rideMMKV.setCurrentId).toHaveBeenCalledTimes(2);
  });

  it('keeps the recovered flag with a recovered ride, so its review stays recovered', () => {
    mmkvState.currentId = 'ride-7';
    mmkvState.startedAt = Date.now() - 60_000;
    endRecoveredRide();
    expect(readEndedRideSummary()?.recovered).toBe(true);
  });

  it('never resumes an ended ride — the server has already completed it', async () => {
    mmkvState.currentId = 'ride-ended';
    mmkvState.status = 'ended';
    await expect(resumeRecoveredRide()).resolves.toBe(false);
    expect(startGPS).not.toHaveBeenCalled();
  });
});

describe('pause and resume — one engine path for the HUD and CarPlay', () => {
  beforeEach(() => {
    mmkvState.currentId = 'ride-1';
    mmkvState.status = 'recording';
    mmkvState.startedAt = 1_000_000;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ends a stop the GPS was timing before the ride turns paused', () => {
    let statusAtReset: string | undefined;
    (gps.endAutoPauseEpisode as jest.Mock).mockImplementationOnce(() => {
      statusAtReset = mmkvState.status;
    });
    pauseRideSession('carplay');
    expect(gps.endAutoPauseEpisode).toHaveBeenCalledTimes(1);
    expect(statusAtReset).toBe('recording');
  });

  it('pauses: persists the phase and pause start, projects, re-arms for the phase', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_600_000);
    expect(pauseRideSession('carplay')).toBe(true);
    expect(mmkvState.status).toBe('paused');
    expect(mmkvState.pausedAt).toBe(1_600_000);
    expect(useRideStore.setState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paused' }),
    );
    // The phase is paused when the reminders re-arm, so they pick the paused set.
    expect(armReminders).toHaveBeenCalledWith(1_600_000);
    // The server learns too (its idle sweep then skips the "still riding?" push).
    expect(enqueue).toHaveBeenCalledWith(
      'pauseRide',
      expect.objectContaining({ variables: { input: { rideId: 'ride-1' } } }),
    );
    expect(trackEvent).toHaveBeenCalledWith(
      'ride_paused',
      expect.objectContaining({ ride_id: 'ride-1', source: 'carplay', duration_at_pause_s: 600 }),
    );
  });

  it('ignores a second pause and a pause with no recording ride', () => {
    mmkvState.status = 'paused';
    mmkvState.pausedAt = 1_200_000;
    expect(pauseRideSession('phone')).toBe(false);
    expect(mmkvState.pausedAt).toBe(1_200_000);
    mmkvState.currentId = '';
    expect(pauseRideSession('phone')).toBe(false);
    expect(armReminders).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('resumes: banks the pause, persists recording, restarts the reminder clock', () => {
    mmkvState.status = 'paused';
    mmkvState.pausedAt = 1_200_000;
    mmkvState.totalPausedMs = 5_000;
    jest.spyOn(Date, 'now').mockReturnValue(1_500_000);
    expect(resumeRideSession('phone')).toBe(true);
    expect(mmkvState.totalPausedMs).toBe(305_000);
    expect(mmkvState.pausedAt).toBe(0);
    expect(mmkvState.status).toBe('recording');
    expect(useRideStore.setState).toHaveBeenCalledWith({ status: 'recording' });
    expect(armReminders).toHaveBeenCalledWith(1_500_000);
    expect(enqueue).toHaveBeenCalledWith(
      'resumeRide',
      expect.objectContaining({ variables: { input: { rideId: 'ride-1' } } }),
    );
    expect(trackEvent).toHaveBeenCalledWith(
      'ride_resumed',
      expect.objectContaining({ ride_id: 'ride-1', pause_duration_s: 300, source: 'phone' }),
    );
  });

  it('does not resume a ride that is recording or ended', () => {
    expect(resumeRideSession('carplay')).toBe(false);
    mmkvState.status = 'ended';
    expect(resumeRideSession('carplay')).toBe(false);
    expect(armReminders).not.toHaveBeenCalled();
  });
});

describe('endRideSession — summary before the phase', () => {
  it('stores the summary before any surface can see the ride as ended', () => {
    mmkvState.currentId = 'ride-1';
    mmkvState.status = 'recording';
    mmkvState.startedAt = 1_000_000;
    let summaryAtFlip: string | undefined;
    (store.endRide as jest.Mock).mockImplementationOnce(() => {
      summaryAtFlip = mmkvState.endedSummary;
    });
    endRideSession('carplay');
    expect(summaryAtFlip).toContain('"rideId":"ride-1"');
  });
});

describe('resumeRecoveredRide — one restart, and never onto an ended ride', () => {
  beforeEach(() => {
    mmkvState.currentId = 'ride-open';
    mmkvState.status = 'recording';
    mmkvState.startedAt = 1_000_000;
  });

  it('stops GPS again when the ride was ended while GPS was starting', async () => {
    startGPS.mockImplementationOnce(async () => {
      mmkvState.status = 'ended'; // Stop on the head unit lands mid-start
    });
    await expect(resumeRecoveredRide()).resolves.toBe(false);
    expect(gps.stopGPSListener).toHaveBeenCalledTimes(1);
    expect(useRideStore.setState).not.toHaveBeenCalledWith({ recordingInterrupted: false });
    expect(armReminders).not.toHaveBeenCalled();
  });

  it('leaves the GPS to a new ride that replaced this one meanwhile', async () => {
    startGPS.mockImplementationOnce(async () => {
      mmkvState.currentId = 'ride-new';
    });
    await expect(resumeRecoveredRide()).resolves.toBe(false);
    expect(gps.stopGPSListener).not.toHaveBeenCalled();
  });

  it('stops the GPS when the ride was cleared meanwhile (auto-end, saved summary)', async () => {
    startGPS.mockImplementationOnce(async () => {
      mmkvState.currentId = '';
    });
    await expect(resumeRecoveredRide()).resolves.toBe(false);
    await new Promise((resolve) => setImmediate(resolve));
    expect(gps.stopGPSListener).toHaveBeenCalledTimes(1);
  });

  it('leaves the GPS to a new ride whose start is under way (old ride saved, no id yet)', async () => {
    let releaseStart: () => void = () => {};
    startGPS.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseStart = resolve;
        }),
    );
    const resumed = resumeRecoveredRide();
    // A new ride starts meanwhile: it saves the old one and waits on permission.
    mmkvState.currentId = '';
    let grant: (level: string) => void = () => {};
    readPerms.mockImplementationOnce(() => new Promise((resolve) => (grant = resolve)));
    const started = startRideSession({ motorcycleId: null, source: 'carplay' });
    releaseStart();
    await expect(resumed).resolves.toBe(false);
    expect(gps.stopGPSListener).not.toHaveBeenCalled(); // decided only once it settles
    grant('full');
    await started;
    await new Promise((resolve) => setImmediate(resolve));
    // The new ride owns the GPS now.
    expect(gps.stopGPSListener).not.toHaveBeenCalled();
  });

  it('stops the GPS once a new start that saved this ride is refused', async () => {
    let releaseStart: () => void = () => {};
    startGPS.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseStart = resolve;
        }),
    );
    const resumed = resumeRecoveredRide();
    mmkvState.currentId = '';
    let answer: (level: string) => void = () => {};
    readPerms.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const started = startRideSession({ motorcycleId: null, source: 'carplay' });
    releaseStart();
    await resumed;
    answer('denied');
    await expect(started).resolves.toEqual({ ok: false, reason: 'denied' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(gps.stopGPSListener).toHaveBeenCalledTimes(1);
  });

  it('shares one restart between callers asking at once', async () => {
    const first = resumeRecoveredRide();
    const second = resumeRecoveredRide();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(startGPS).toHaveBeenCalledTimes(1);
  });
});

describe('startRideSession — a check racing the GPS start', () => {
  it('clears "interrupted" once the new ride\'s GPS is confirmed running', async () => {
    await startRideSession({ motorcycleId: 'bike-1', source: 'phone' });
    expect(useRideStore.setState).toHaveBeenCalledWith({ recordingInterrupted: false });
  });
});

describe('finalizeEndedRide', () => {
  it('says whether the ride was still the one waiting for review', () => {
    mmkvState.currentId = 'ride-a';
    expect(finalizeEndedRide('ride-a')).toBe(true);
    mmkvState.currentId = 'ride-b'; // a new start already saved ride-a
    expect(finalizeEndedRide('ride-a')).toBe(false);
  });
});

// Issue 365 T09 (FS-PO4b, D3): one discard path for the guard and the summary.
describe('discardEndedRide', () => {
  it('deletes the ride on the server, clears it from the phone and fires ride_discarded', async () => {
    mmkvState.currentId = 'ride-d';
    mmkvState.status = 'ended';

    discardEndedRide(
      { rideId: 'ride-d', distanceM: 12, durationS: 90 },
      { reason: 'below_floor', trigger: 'guard' },
    );

    expect(syncQueue.deleteEndedRide).toHaveBeenCalledWith('ride-d');
    expect(clearRideData).toHaveBeenCalledWith('ride-d');
    expect(store.hydrate).toHaveBeenCalled();
    expect(trackRideDiscarded).toHaveBeenCalledWith({
      rideId: 'ride-d',
      distanceM: 12,
      durationS: 90,
      reason: 'below_floor',
      trigger: 'guard',
    });
    expect(trackRideCompleted).not.toHaveBeenCalled();
    // The rides lists refetch once the delete has drained, not before.
    await new Promise((resolve) => setImmediate(resolve));
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['rides'] });
  });
});

describe('endRideWithoutSaving (the guard\'s "End without saving")', () => {
  it('ends a 90 s / 20 m ride and discards it: never a summary to save', () => {
    mmkvState.currentId = 'ride-g';
    mmkvState.startedAt = Date.now() - 90_000;

    const summary = endRideWithoutSaving('phone');

    expect(summary?.rideId).toBe('ride-g');
    expect(enqueue).toHaveBeenCalledWith('endRide', expect.anything());
    expect(syncQueue.deleteEndedRide).toHaveBeenCalledWith('ride-g');
    expect(trackRideDiscarded).toHaveBeenCalledWith(
      expect.objectContaining({ rideId: 'ride-g', reason: 'below_floor', trigger: 'guard' }),
    );
    expect(clearRideData).toHaveBeenCalledWith('ride-g');
    expect(trackRideCompleted).not.toHaveBeenCalled();
  });

  it('does nothing without a ride to end', () => {
    expect(endRideWithoutSaving('phone')).toBeNull();
    expect(syncQueue.deleteEndedRide).not.toHaveBeenCalled();
    expect(trackRideDiscarded).not.toHaveBeenCalled();
  });
});
