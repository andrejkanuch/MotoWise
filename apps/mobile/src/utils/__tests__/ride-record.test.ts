// The persisted ride is the single source of truth every surface projects from
// (phone HUD, tab button, home, CarPlay). These pin how it is read back — including
// records older builds wrote — and that clearing one ride never touches another.

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());

import type { Waypoint } from '@motovault/types';
import { useRideStore } from '@/stores/ride.store';
import {
  CHUNK_SIZE,
  clearCurrentRide,
  clearRideData,
  RIDE_KEYS,
  readRideRecord,
  readStoredWaypoints,
  rideMMKV,
  rideStorage,
} from '../ride-storage';

const point = (i: number): Waypoint =>
  ({
    latitude: 48 + i * 0.001,
    longitude: 17,
    altitude: 100 + i,
    speedMps: 10 + i,
    timestamp: new Date(1_000 * i).toISOString(),
  }) as Waypoint;

/** Stores `count` waypoints for a ride as a full chunk + a partial buffer. */
function storeWaypoints(rideId: string, count: number) {
  const points = Array.from({ length: count }, (_, i) => point(i));
  rideStorage.set(`ride:${rideId}:wp:0`, JSON.stringify(points.slice(0, CHUNK_SIZE)));
  if (count > CHUNK_SIZE) {
    rideStorage.set(`ride:${rideId}:wp:buffer`, JSON.stringify(points.slice(CHUNK_SIZE)));
  }
}

beforeEach(() => {
  for (const key of Object.values(RIDE_KEYS)) rideStorage.remove(key);
  clearRideData('ride-a');
  clearRideData('ride-b');
  useRideStore.setState({ status: 'idle', distance: 0, maxSpeed: 0 });
});

describe('readRideRecord', () => {
  it('is null with no ride, and for the empty id older builds wrote to clear it', () => {
    expect(readRideRecord()).toBeNull();
    rideStorage.set(RIDE_KEYS.CURRENT_ID, '');
    expect(readRideRecord()).toBeNull();
  });

  it('reads a ride with no stored phase (older builds) as recording', () => {
    rideMMKV.setCurrentId('ride-a');
    expect(readRideRecord()?.phase).toBe('recording');
  });

  it('reads a ride with an open manual pause as paused, whatever the status says', () => {
    rideMMKV.setCurrentId('ride-a');
    rideMMKV.setStatus('recording');
    rideMMKV.setPausedAt(5_000);
    expect(readRideRecord()?.phase).toBe('paused');
  });

  it('keeps an ended ride ended, and ignores an unknown stored phase', () => {
    rideMMKV.setCurrentId('ride-a');
    rideMMKV.setStatus('ended');
    expect(readRideRecord()?.phase).toBe('ended');
    rideStorage.set(RIDE_KEYS.STATUS, 'exploded');
    expect(readRideRecord()?.phase).toBe('recording');
  });
});

describe('clearRideData', () => {
  it('clears an old ride without touching the newer ride now recording', () => {
    storeWaypoints('ride-a', 3);
    rideMMKV.setCurrentId('ride-b');
    rideMMKV.setStatus('recording');
    clearRideData('ride-a');
    expect(readStoredWaypoints('ride-a')).toEqual([]);
    expect(readRideRecord()).toMatchObject({ rideId: 'ride-b', phase: 'recording' });
  });

  it('clears the current ride, but keeps the HUD layout preference', () => {
    rideMMKV.setCurrentId('ride-a');
    rideMMKV.setStatus('ended');
    rideMMKV.setHudLayout('B');
    clearRideData('ride-a');
    expect(readRideRecord()).toBeNull();
    expect(rideMMKV.getHudLayout()).toBe('B');
  });

  it('clearCurrentRide removes the key instead of writing an empty id', () => {
    rideMMKV.setCurrentId('ride-a');
    clearCurrentRide();
    expect(rideStorage.getString(RIDE_KEYS.CURRENT_ID)).toBeUndefined();
  });
});

describe('useRideStore.hydrate — the store as a projection of the persisted ride', () => {
  it('shows a ride the process never saw start, with the distance already covered', () => {
    rideMMKV.setCurrentId('ride-a');
    rideMMKV.setStatus('paused');
    storeWaypoints('ride-a', CHUNK_SIZE + 5);
    useRideStore.getState().hydrate();
    const state = useRideStore.getState();
    expect(state.status).toBe('paused');
    expect(state.distance).toBeGreaterThan(0);
    expect(state.maxSpeed).toBe(10 + CHUNK_SIZE + 4); // includes the partial buffer
  });

  it('never resets the live totals of a ride this process is recording', () => {
    rideMMKV.setCurrentId('ride-a');
    rideMMKV.setStatus('recording');
    storeWaypoints('ride-a', 2);
    useRideStore.setState({ status: 'recording', distance: 12_345, maxSpeed: 40 });
    useRideStore.getState().hydrate();
    expect(useRideStore.getState()).toMatchObject({ distance: 12_345, maxSpeed: 40 });
  });

  it('goes back to idle once the ride is gone (saved, discarded, auto-ended)', () => {
    useRideStore.setState({ status: 'ended', distance: 900 });
    useRideStore.getState().hydrate();
    expect(useRideStore.getState()).toMatchObject({ status: 'idle', distance: 0 });
  });

  it('projects an ended ride as ended, so it is reviewed and never resumed', () => {
    rideMMKV.setCurrentId('ride-a');
    rideMMKV.setStatus('ended');
    useRideStore.getState().hydrate();
    expect(useRideStore.getState().status).toBe('ended');
  });
});
