// How the recorder feeds the forgotten-ride reminders and protects the partial
// waypoint buffer. Driven through the real TaskManager callback (as the task-error
// tests do), with the GPS filter and the reminder scheduler stubbed so each case
// controls exactly what the filter accepts.

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map<string, string | number | boolean>();
    return {
      getString: (k: string) => (typeof store.get(k) === 'string' ? store.get(k) : undefined),
      getNumber: (k: string) => (typeof store.get(k) === 'number' ? store.get(k) : undefined),
      getBoolean: (k: string) => (typeof store.get(k) === 'boolean' ? store.get(k) : undefined),
      set: (k: string, v: string | number | boolean) => store.set(k, v),
      remove: (k: string) => store.delete(k),
      contains: (k: string) => store.has(k),
      getAllKeys: () => [...store.keys()],
    };
  },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-location', () => ({
  hasStartedLocationUpdatesAsync: jest.fn(() => Promise.resolve(true)),
  stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  Accuracy: { Balanced: 3, BestForNavigation: 6 },
  ActivityType: { AutomotiveNavigation: 2 },
}));
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('n')),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../ride-sync-queue', () => ({
  enqueueOrExecute: jest.fn().mockResolvedValue(undefined),
  enqueueWaypointUpload: jest.fn().mockResolvedValue(undefined),
  enqueue: jest.fn(),
  getQueueLength: jest.fn().mockReturnValue(0),
}));
jest.mock('../../lib/analytics', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  trackEvent: jest.fn(),
  AnalyticsEvent: { RIDE_AUTO_SAVED: 'ride_auto_saved', RIDE_COMPLETED: 'ride_completed' },
}));
jest.mock('../ride-reminders', () => ({
  noteRideMovement: jest.fn(),
  cancelRideReminders: jest.fn(() => Promise.resolve()),
  RIDE_IDLE_NUDGE_MINUTES: 10,
  RIDE_IDLE_FINAL_MINUTES: 30,
}));
jest.mock('../ride-gps-filter', () => ({
  gpsFilter: {
    reset: jest.fn(),
    process: jest.fn(),
    stats: {
      totalAscent: 0,
      totalDescent: 0,
      maxAltitude: 0,
      minAltitude: 0,
      stopCount: 0,
    },
  },
}));

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { trackEvent } from '../../lib/analytics';
import { useRideStore } from '../../stores/ride.store';
import { gpsFilter } from '../ride-gps-filter';
import {
  autoEndRide,
  BACKGROUND_LOCATION_TASK,
  endAutoPauseEpisode,
  gpsStartCount,
  gpsStartInFlight,
  startGPSListener,
  stopGPSListener,
} from '../ride-location';
import { cancelRideReminders, noteRideMovement } from '../ride-reminders';
import {
  appendWaypoint,
  CHUNK_SIZE,
  clearPointBuffer,
  flushBufferToMMKV,
  getPointBuffer,
  resetWaypointBudget,
  rideMMKV,
  rideStorage,
} from '../ride-storage';
import { enqueueOrExecute } from '../ride-sync-queue';

type TaskBody = (event: { data: { locations: unknown[] } | null; error: null }) => Promise<void>;
const runTask = (TaskManager.defineTask as jest.Mock).mock.calls.find(
  ([name]) => name === BACKGROUND_LOCATION_TASK,
)?.[1] as TaskBody;

const RIDE_ID = 'ride-under-test';
const BUFFER_KEY = `ride:${RIDE_ID}:wp:buffer`;
const T0 = 1_700_000_000_000;
const filterProcess = gpsFilter.process as jest.Mock;
const note = noteRideMovement as jest.Mock;
const cancel = cancelRideReminders as jest.Mock;

const fix = (timestamp: number, speed: number, lat = 50, lng = 14) => ({
  timestamp,
  coords: { latitude: lat, longitude: lng, altitude: 0, speed, heading: 0, accuracy: 5 },
});
const accepted = (segmentDistance: number, lat = 50) => ({
  status: 'accepted',
  location: {
    latitude: lat,
    longitude: 14,
    smoothedAltitude: 0,
    speed: 5,
    heading: 0,
    accuracy: 5,
    segmentDistance,
  },
});
const sample = (...locations: unknown[]) => runTask({ data: { locations }, error: null });

beforeEach(async () => {
  jest.clearAllMocks();
  await stopGPSListener(); // resets module state between cases
  jest.clearAllMocks();
  clearPointBuffer();
  resetWaypointBudget();
  rideStorage.remove(BUFFER_KEY);
  rideMMKV.setCurrentId(RIDE_ID);
  rideMMKV.setStatus('recording');
  useRideStore.setState({ status: 'recording' });
});

describe('pause after an app kill — the persisted phase decides, not the store', () => {
  it('records nothing during a manual pause the relaunched process never saw', async () => {
    rideMMKV.setStatus('paused');
    useRideStore.setState({ status: 'idle' }); // headless relaunch: store not hydrated
    filterProcess.mockReturnValue(accepted(12));
    await sample(fix(T0, 10));
    expect(note).not.toHaveBeenCalled();
  });

  it('keeps recording a moving ride the relaunched process never saw start', async () => {
    rideMMKV.setStatus('recording');
    useRideStore.setState({ status: 'idle' });
    filterProcess.mockReturnValue(accepted(12));
    await sample(fix(T0, 10));
    expect(note).toHaveBeenCalledWith(T0);
  });
});

describe('auto-pause reaches the screens, not only the disk', () => {
  it('projects the stopped sub-state and the forgotten-ride flag onto the store', async () => {
    rideMMKV.setRecordingSubState('moving');
    useRideStore.setState({ recordingSubState: 'moving', forgotToStopPending: false });
    const now = jest.spyOn(Date, 'now');
    filterProcess.mockReturnValue(accepted(0));
    const at = async (ms: number, speed: number) => {
      now.mockReturnValue(T0 + ms);
      await sample(fix(T0 + ms, speed));
    };

    await at(0, 0);
    await at(61_000, 0); // past the 60 s auto-pause threshold
    expect(rideMMKV.getRecordingSubState()).toBe('stopped');
    expect(useRideStore.getState().recordingSubState).toBe('stopped');

    await at(61_000 + 10 * 60_000 + 1_000, 0); // past the 10 min "still riding?" mark
    expect(useRideStore.getState().forgotToStopPending).toBe(true);

    filterProcess.mockReturnValue(accepted(12));
    await at(12 * 60_000, 10); // moving again answers it
    expect(useRideStore.getState().recordingSubState).toBe('moving');
    expect(useRideStore.getState().forgotToStopPending).toBe(false);
    now.mockRestore();
  });
});

describe('restarting GPS ends a permission loss', () => {
  it('clears the lost flag on disk and in the store once updates start again', async () => {
    rideMMKV.setGpsPermissionLost(true);
    useRideStore.setState({ gpsPermissionLost: true });
    await startGPSListener();
    expect(rideMMKV.getGpsPermissionLost()).toBe(false);
    expect(useRideStore.getState().gpsPermissionLost).toBe(false);
  });

  it('counts every (re)start, so a check in flight can tell one began', async () => {
    const before = gpsStartCount();
    const start = startGPSListener();
    expect(gpsStartCount()).toBe(before + 1); // counted synchronously, at the call
    expect(gpsStartInFlight()).toBe(true);
    await start;
    expect(gpsStartInFlight()).toBe(false);
    // ...and again when it settles, so a check that began mid-start loses too.
    expect(gpsStartCount()).toBe(before + 2);
  });

  it('keeps the flag when the start fails (still no permission)', async () => {
    rideMMKV.setGpsPermissionLost(true);
    (Location.startLocationUpdatesAsync as jest.Mock).mockRejectedValueOnce(new Error('denied'));
    await expect(startGPSListener()).rejects.toThrow('denied');
    expect(rideMMKV.getGpsPermissionLost()).toBe(true);
    expect(gpsStartInFlight()).toBe(false);
  });
});

describe('a manual pause ends the stop episode', () => {
  it('does not auto-end on resume after a long pause taken at a stop, nor bank the pause twice', async () => {
    rideMMKV.setRecordingSubState('moving');
    rideMMKV.setTotalAutoPausedMs(0);
    const now = jest.spyOn(Date, 'now');
    filterProcess.mockReturnValue(accepted(0));
    const at = async (ms: number, speed: number) => {
      now.mockReturnValue(T0 + ms);
      await sample(fix(T0 + ms, speed));
    };

    await at(0, 0);
    await at(120_000, 0); // auto-paused for 2 min
    expect(rideMMKV.getRecordingSubState()).toBe('stopped');

    // The rider pauses (what pauseRideSession does), for 40 min.
    endAutoPauseEpisode(T0 + 120_000);
    rideMMKV.setStatus('paused');
    await at(20 * 60_000, 0); // dropped while paused
    rideMMKV.setStatus('recording');

    await at(42 * 60_000, 0); // first fix after resume, still at the stop
    expect(trackEvent).not.toHaveBeenCalledWith('ride_auto_saved', expect.anything());
    expect(rideMMKV.getCurrentId()).toBe(RIDE_ID);
    // Only the 2 min the GPS saw stopped count as auto-paused, never the pause.
    expect(rideMMKV.getTotalAutoPausedMs()).toBe(120_000);
    // Riding off fast afterwards banks nothing more: the pause is not auto-paused.
    filterProcess.mockReturnValue(accepted(12));
    await at(43 * 60_000, 10);
    expect(rideMMKV.getTotalAutoPausedMs()).toBe(120_000);
    expect(useRideStore.getState().recordingSubState).toBe('moving');
    expect(useRideStore.getState().forgotToStopPending).toBe(false);
    now.mockRestore();
  });
});

describe('reminder push-back', () => {
  it('pushes the reminders back on a moving fix the filter accepted', async () => {
    filterProcess.mockReturnValue(accepted(12));
    await sample(fix(T0, 10));
    expect(note).toHaveBeenCalledWith(T0);
  });

  it('does not push them back for a parked phone whose jitter the filter counted', async () => {
    // Speed 0 and inside the 25 m jitter radius: the stop machine says "not moving",
    // even though the filter accepted a few metres of distance.
    filterProcess.mockReturnValue(accepted(4));
    await sample(fix(T0, 0), fix(T0 + 5_000, 0, 50.00005));
    expect(note).not.toHaveBeenCalled();
  });
});

describe('partial buffer persistence', () => {
  it('persists the partial buffer at most every 30 seconds', async () => {
    filterProcess.mockReturnValue(accepted(12));
    await sample(fix(T0, 10));
    expect(rideStorage.getString(BUFFER_KEY)).toBeDefined();

    rideStorage.remove(BUFFER_KEY);
    await sample(fix(T0 + 10_000, 10));
    expect(rideStorage.getString(BUFFER_KEY)).toBeUndefined();

    await sample(fix(T0 + 31_000, 10));
    expect(rideStorage.getString(BUFFER_KEY)).toBeDefined();
  });

  it('loads the points an earlier process saved before appending (headless relaunch)', async () => {
    const saved = Array.from({ length: 5 }, (_, i) => ({
      latitude: 50 + i / 1000,
      longitude: 14,
      altitude: 0,
      speedMps: 5,
      heading: 0,
      accuracy: 5,
      recordedAt: new Date(T0 - 60_000 + i * 1000).toISOString(),
    }));
    rideStorage.set(BUFFER_KEY, JSON.stringify(saved));
    filterProcess.mockReturnValue(accepted(12));

    await sample(fix(T0, 10));

    // The five saved points survive, plus the new one — not a one-point overwrite.
    expect(getPointBuffer()).toHaveLength(6);
    expect(JSON.parse(rideStorage.getString(BUFFER_KEY) ?? '[]')).toHaveLength(6);
  });

  it('drops the persisted buffer once its points roll into a chunk', () => {
    const wp = (i: number) => ({
      latitude: 50,
      longitude: 14 + i / 1000,
      altitude: 0,
      speedMps: 5,
      heading: 0,
      accuracy: 5,
      recordedAt: new Date(T0 + i * 1000).toISOString(),
    });
    for (let i = 0; i < CHUNK_SIZE - 1; i++) appendWaypoint(RIDE_ID, wp(i));
    flushBufferToMMKV(RIDE_ID);
    expect(rideStorage.getString(BUFFER_KEY)).toBeDefined();

    expect(appendWaypoint(RIDE_ID, wp(CHUNK_SIZE))).toHaveLength(CHUNK_SIZE);
    // A restore after a kill must not re-add points that now live in the chunk.
    expect(rideStorage.getString(BUFFER_KEY)).toBeUndefined();
  });
});

describe('stopGPSListener', () => {
  it('cancels the reminders before awaiting anything, even if stopping location fails', async () => {
    (Location.stopLocationUpdatesAsync as jest.Mock).mockRejectedValueOnce(new Error('native'));
    const settled = expect(stopGPSListener()).rejects.toThrow('native');
    const cancelledSynchronously = cancel.mock.calls.length; // before the first await
    await settled;
    expect(cancelledSynchronously).toBe(1);
  });
});

describe('autoEndRide (30 min without movement)', () => {
  it('ends trimmed to the stop, records it, tells the rider, and leaves nothing behind', () => {
    rideMMKV.setStartedAt(T0 - 3_600_000);
    rideMMKV.setMotorcycleId('bike-under-test');
    const idleSince = T0 - 1_800_000;

    autoEndRide(idleSince);

    expect(cancel).toHaveBeenCalled();
    expect(enqueueOrExecute).toHaveBeenCalledWith(
      'endRide',
      expect.objectContaining({
        variables: {
          input: expect.objectContaining({
            rideId: RIDE_ID,
            endedAt: new Date(idleSince).toISOString(),
          }),
        },
      }),
    );
    expect(trackEvent).toHaveBeenCalledWith(
      'ride_auto_saved',
      expect.objectContaining({ ride_id: RIDE_ID, idle_minutes: 30 }),
    );
    // The canonical "ride saved" event fires too, flagged as an auto-end and
    // timed to the stop (30 min ridden, not the hour since start).
    expect(trackEvent).toHaveBeenCalledWith(
      'ride_completed',
      expect.objectContaining({
        ride_id: RIDE_ID,
        motorcycle_id: 'bike-under-test',
        duration_s: 1_800,
        save_trigger: 'auto_end',
        auto_ended: true,
      }),
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: { kind: 'ride_idle', rideId: RIDE_ID, autoEnded: true },
        }),
      }),
    );
    // Local ride data is gone, so the next Start offers no "unfinished ride".
    expect(rideMMKV.getCurrentId()).toBeUndefined();
  });

  it('sends full stats from the stored waypoints, marked as the app auto-end', () => {
    rideMMKV.setStartedAt(T0 - 3_600_000);
    const altitudes = [200, 200, 204, 210, 220, 222, 230, 230];
    for (const [i, altitude] of altitudes.entries()) {
      appendWaypoint(RIDE_ID, {
        latitude: 50 + i * 0.0001,
        longitude: 14,
        altitude,
        speedMps: i === 5 ? 18 : 11,
        recordedAt: new Date(T0 - 2_000_000 + i * 1000).toISOString(),
      });
    }
    flushBufferToMMKV(RIDE_ID);

    autoEndRide(T0 - 1_800_000);

    const input = (enqueueOrExecute as jest.Mock).mock.calls.find(
      ([type]) => type === 'endRide',
    )?.[1].variables.input;
    expect(input).toMatchObject({
      rideId: RIDE_ID,
      endSource: 'client_auto',
      maxSpeedMps: 18,
      // Median-of-5 then 5 m hysteresis: 200 → 210 → 220 → 230.
      elevationGain: 30,
    });
    // 7 intervals of ~11.1 m over 7 s of moving time.
    expect(input.avgSpeedMps).toBeCloseTo(11.12, 1);
    expect(input).not.toHaveProperty('gpsQuality');
  });

  it('does nothing without an active ride', () => {
    rideMMKV.setCurrentId('');
    autoEndRide(T0);
    expect(enqueueOrExecute).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
