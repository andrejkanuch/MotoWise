// ride-location.ts runs top-level side effects (TaskManager.defineTask, MMKV,
// store wiring) on import, so stub the native/heavy deps. `defineTask` is a
// jest.fn(), which is what makes the registered task callback recoverable here —
// nothing else in the suite exercises the task body's error branch.
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
jest.mock('expo-location');
jest.mock('expo-notifications');
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
}));

import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { addBreadcrumb, captureException } from '../../lib/analytics';
import { CORE_LOCATION_ERROR_CODE, type LocationTaskError } from '../../lib/location-error';
import { NOTIFICATION_KIND } from '../../lib/notifications';
import { useRideStore } from '../../stores/ride.store';
import { BACKGROUND_LOCATION_TASK, stopGPSListener } from '../ride-location';
import { rideMMKV } from '../ride-storage';
import { enqueueOrExecute } from '../ride-sync-queue';

const RIDE_ID = 'ride-under-test';
const CAPTURE_SOURCE = 'ride-location.backgroundLocationTask';
const DENIED: LocationTaskError = {
  code: CORE_LOCATION_ERROR_CODE.DENIED,
  message: 'Error Domain=kCLErrorDomain Code=1 "(null)"',
};

type TaskBody = (event: {
  data: { locations?: unknown[] } | null;
  error: LocationTaskError | null;
}) => Promise<void>;

/** The callback ride-location registered with TaskManager at import time. */
const runTask = (TaskManager.defineTask as jest.Mock).mock.calls.find(
  ([name]) => name === BACKGROUND_LOCATION_TASK,
)?.[1] as TaskBody;

const mockCapture = captureException as jest.Mock;
const mockBreadcrumb = addBreadcrumb as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockEnqueue = enqueueOrExecute as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  // Clear the per-ride latch (and the persisted flag) between cases.
  await stopGPSListener();
  rideMMKV.setCurrentId(RIDE_ID);
  useRideStore.setState({ status: 'recording', gpsPermissionLost: false });
});

it('registers the background location task', () => {
  expect(runTask).toBeInstanceOf(Function);
});

describe('kCLErrorLocationUnknown (code 0)', () => {
  it('is silent — no Sentry issue, no notification', async () => {
    await runTask({
      data: null,
      error: { code: CORE_LOCATION_ERROR_CODE.LOCATION_UNKNOWN, message: 'unavailable' },
    });

    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    // Kept as a breadcrumb so the context survives into any later real error.
    expect(mockBreadcrumb).toHaveBeenCalledWith('unavailable', 'ride-location', { code: 0 });
  });
});

describe('kCLErrorDenied (code 1)', () => {
  it('reports exactly once, with the CoreLocation code in context', async () => {
    await runTask({ data: null, error: DENIED });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(DENIED, {
      source: CAPTURE_SOURCE,
      coreLocationCode: CORE_LOCATION_ERROR_CODE.DENIED,
      rideId: RIDE_ID,
    });
  });

  it('tells the rider once, routed by the existing RIDE_IDLE handler', async () => {
    await runTask({ data: null, error: DENIED });

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const { content } = mockSchedule.mock.calls[0][0];
    expect(content.data).toEqual({
      kind: NOTIFICATION_KIND.RIDE_IDLE,
      rideId: RIDE_ID,
      autoEnded: false,
    });
    expect(content.title).toBeTruthy();
    expect(content.body).toBeTruthy();
  });

  it('marks the state in both the store and MMKV', async () => {
    await runTask({ data: null, error: DENIED });

    expect(useRideStore.getState().gpsPermissionLost).toBe(true);
    expect(rideMMKV.getGpsPermissionLost()).toBe(true);
  });

  // THE regression guard: this is what turns 51 Sentry events into 1.
  it('stays at one capture and one notification across repeated callbacks', async () => {
    await runTask({ data: null, error: DENIED });
    await runTask({ data: null, error: DENIED });
    await runTask({ data: null, error: DENIED });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it('re-arms for the next ride — the latch is per ride, not per install', async () => {
    await runTask({ data: null, error: DENIED });
    expect(mockCapture).toHaveBeenCalledTimes(1);

    await stopGPSListener();
    expect(rideMMKV.getGpsPermissionLost()).toBe(false);
    rideMMKV.setCurrentId(RIDE_ID);

    await runTask({ data: null, error: DENIED });
    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  // Pins the (b)-over-(c) decision: the buffered waypoints are real and the
  // rider may still be riding, so a later refactor must not quietly auto-end.
  it('does NOT end the ride', async () => {
    await runTask({ data: null, error: DENIED });

    expect(useRideStore.getState().status).toBe('recording');
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe('unclassified failures', () => {
  it('reports an unknown code through the plain REPORT path', async () => {
    const unknown: LocationTaskError = { code: 99, message: 'mystery' };
    await runTask({ data: null, error: unknown });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(unknown, { source: CAPTURE_SOURCE });
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(useRideStore.getState().gpsPermissionLost).toBe(false);
  });
});

describe('payload guard', () => {
  it('does not throw when the task is woken with no locations', async () => {
    await expect(runTask({ data: {}, error: null })).resolves.toBeUndefined();
    await expect(runTask({ data: null, error: null })).resolves.toBeUndefined();
  });
});
