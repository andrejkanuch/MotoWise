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
  AnalyticsEvent: { RIDE_AUTO_SAVED: 'ride_auto_saved' },
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
import { autoEndRide, BACKGROUND_LOCATION_TASK, stopGPSListener } from '../ride-location';
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
  useRideStore.setState({ status: 'recording' });
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

  it('does nothing without an active ride', () => {
    rideMMKV.setCurrentId('');
    autoEndRide(T0);
    expect(enqueueOrExecute).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
