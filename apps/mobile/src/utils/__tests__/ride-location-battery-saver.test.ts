// toggleBatterySaver restarts location updates with a new accuracy profile.
// Sentry MOTO-VAULT-REACT-NATIVE-3X: with permission revoked mid-ride the
// restart rejected AFTER the stop succeeded, so the ride lost GPS entirely and
// the HUD flipped its toggle anyway.

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => undefined,
    getNumber: () => undefined,
    getBoolean: () => undefined,
    set: () => undefined,
    remove: () => undefined,
    contains: () => false,
    getAllKeys: () => [],
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-location', () => ({
  hasStartedLocationUpdatesAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
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

import * as Location from 'expo-location';
import { captureException } from '../../lib/analytics';
import { toggleBatterySaver } from '../ride-location';

const mocked = Location as jest.Mocked<typeof Location>;
const granted = (value: boolean) =>
  mocked.getForegroundPermissionsAsync.mockResolvedValue({
    granted: value,
  } as Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>);

/** The `accuracy` of the nth startLocationUpdatesAsync call. */
const startedAccuracy = (n: number) =>
  (mocked.startLocationUpdatesAsync.mock.calls[n]?.[1] as { accuracy: number }).accuracy;

describe('toggleBatterySaver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    granted(true);
  });

  it('restarts a running session with the new profile and reports it applied', async () => {
    await expect(toggleBatterySaver(true)).resolves.toBe(true);

    expect(mocked.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    expect(startedAccuracy(0)).toBe(Location.Accuracy.Balanced);
  });

  it('leaves a running session alone when foreground permission is gone', async () => {
    granted(false);

    await expect(toggleBatterySaver(true)).resolves.toBe(false);

    expect(mocked.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mocked.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('restores the previous profile when the restart fails, then rethrows', async () => {
    const failure = new Error('DeniedForegroundLocationPermission');
    mocked.startLocationUpdatesAsync.mockRejectedValueOnce(failure);

    await expect(toggleBatterySaver(true)).rejects.toBe(failure);

    expect(mocked.startLocationUpdatesAsync).toHaveBeenCalledTimes(2);
    expect(startedAccuracy(1)).toBe(Location.Accuracy.BestForNavigation);
  });

  it('reports a failed restore but still rethrows the original failure', async () => {
    const failure = new Error('restart failed');
    const restoreFailure = new Error('restore failed');
    mocked.startLocationUpdatesAsync
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(restoreFailure);

    await expect(toggleBatterySaver(true)).rejects.toBe(failure);

    expect(captureException).toHaveBeenCalledWith(restoreFailure, {
      source: 'ride-location.toggleBatterySaver.restore',
    });
  });

  it('has nothing to restart when no session is running', async () => {
    mocked.hasStartedLocationUpdatesAsync.mockResolvedValue(false);

    await expect(toggleBatterySaver(true)).resolves.toBe(true);

    expect(mocked.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });
});
