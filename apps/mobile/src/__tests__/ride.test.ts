jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn(),
    getAllKeys: jest.fn().mockReturnValue([]),
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-location');
jest.mock('expo-notifications');
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../utils/ride-sync-queue', () => ({
  enqueue: jest.fn(),
}));

import { distanceMeters } from '../utils/ride-location';
import { CHUNK_SIZE, RIDE_KEYS } from '../utils/ride-storage';
import { useRideStore } from '../stores/ride.store';

// --- distanceMeters (haversine) ---

describe('distanceMeters', () => {
  it('returns 0 for the same point', () => {
    const p = { lat: 48.1486, lng: 17.1077 };
    expect(distanceMeters(p, p)).toBe(0);
  });

  it('calculates Bratislava to Vienna as ~55km', () => {
    const bratislava = { lat: 48.1486, lng: 17.1077 };
    const vienna = { lat: 48.2082, lng: 16.3738 };
    const d = distanceMeters(bratislava, vienna);
    expect(d).toBeGreaterThan(50_000);
    expect(d).toBeLessThan(60_000);
  });

  it('calculates antipodal points as ~20,000km', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0, lng: 180 };
    const d = distanceMeters(a, b);
    expect(d).toBeGreaterThan(19_000_000);
    expect(d).toBeLessThan(21_000_000);
  });

  it('calculates small distance (~10 meters apart)', () => {
    const a = { lat: 48.1486, lng: 17.1077 };
    // ~10m north
    const b = { lat: 48.14869, lng: 17.1077 };
    const d = distanceMeters(a, b);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(15);
  });
});

// --- Zustand ride store ---

describe('useRideStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useRideStore.setState({
      status: 'idle',
      currentSpeed: 0,
      elapsedTime: 0,
      distance: 0,
      recordingSubState: 'moving',
      isNightMode: false,
      isBatterySaver: false,
      permissionLevel: 'denied',
    });
  });

  it('has idle as initial status', () => {
    expect(useRideStore.getState().status).toBe('idle');
  });

  it('startRide sets status to recording and resets counters', () => {
    useRideStore.getState().startRide();
    const state = useRideStore.getState();
    expect(state.status).toBe('recording');
    expect(state.currentSpeed).toBe(0);
    expect(state.elapsedTime).toBe(0);
    expect(state.distance).toBe(0);
    expect(state.recordingSubState).toBe('moving');
  });

  it('pauseRide sets status to paused', () => {
    useRideStore.getState().startRide();
    useRideStore.getState().pauseRide();
    expect(useRideStore.getState().status).toBe('paused');
  });

  it('resumeRide sets status to recording', () => {
    useRideStore.getState().startRide();
    useRideStore.getState().pauseRide();
    useRideStore.getState().resumeRide();
    expect(useRideStore.getState().status).toBe('recording');
  });

  it('endRide sets status to ended', () => {
    useRideStore.getState().startRide();
    useRideStore.getState().endRide();
    const state = useRideStore.getState();
    expect(state.status).toBe('ended');
    expect(state.currentSpeed).toBe(0);
  });

  it('updateSpeed updates currentSpeed', () => {
    useRideStore.getState().updateSpeed(25.5);
    expect(useRideStore.getState().currentSpeed).toBe(25.5);
  });

  it('updateDistance updates distance', () => {
    useRideStore.getState().updateDistance(1500);
    expect(useRideStore.getState().distance).toBe(1500);
  });

  it('updateElapsedTime updates elapsedTime', () => {
    useRideStore.getState().updateElapsedTime(3600);
    expect(useRideStore.getState().elapsedTime).toBe(3600);
  });

  it('toggleNightMode toggles boolean', () => {
    expect(useRideStore.getState().isNightMode).toBe(false);
    useRideStore.getState().toggleNightMode();
    expect(useRideStore.getState().isNightMode).toBe(true);
    useRideStore.getState().toggleNightMode();
    expect(useRideStore.getState().isNightMode).toBe(false);
  });

  it('toggleBatterySaver toggles boolean', () => {
    expect(useRideStore.getState().isBatterySaver).toBe(false);
    useRideStore.getState().toggleBatterySaver();
    expect(useRideStore.getState().isBatterySaver).toBe(true);
    useRideStore.getState().toggleBatterySaver();
    expect(useRideStore.getState().isBatterySaver).toBe(false);
  });
});

// --- RIDE_KEYS constants ---

describe('RIDE_KEYS', () => {
  it('all keys use dot-notation prefix ride.', () => {
    for (const value of Object.values(RIDE_KEYS)) {
      expect(value).toMatch(/^ride\./);
    }
  });

  it('CHUNK_SIZE is 50', () => {
    expect(CHUNK_SIZE).toBe(50);
  });
});
