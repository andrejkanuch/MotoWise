/**
 * The client-side waypoint budget (Sentry MOTO-VAULT-REACT-NATIVE-1M).
 *
 * The server caps a ride at RIDE_WAYPOINT_LIMITS.MAX_PER_RIDE and permanently
 * rejects anything past it. An uncapped recorder therefore does not just lose
 * points — it mints a payload that can never be accepted every time a chunk fills,
 * for the rest of the ride. 351 of that issue's 391 events came from ONE rider on
 * ONE long ride, one event per rejected chunk.
 *
 * These tests pin the two properties that make the loop impossible: the running
 * total never reaches the cap, and nothing past the cap is ever handed to the
 * sync queue.
 */

// Capture the MMKV instance so the persisted waypoint count can be seeded/read.
let mockRideStore: Map<string, string | number | boolean>;

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map<string, string | number | boolean>();
    mockRideStore = store;
    return {
      getString: (k: string) => {
        const v = store.get(k);
        return typeof v === 'string' ? v : undefined;
      },
      getNumber: (k: string) => {
        const v = store.get(k);
        return typeof v === 'number' ? v : undefined;
      },
      getBoolean: (k: string) => {
        const v = store.get(k);
        return typeof v === 'boolean' ? v : undefined;
      },
      set: (k: string, v: string | number | boolean) => store.set(k, v),
      remove: (k: string) => store.delete(k),
      contains: (k: string) => store.has(k),
      getAllKeys: () => [...store.keys()],
    };
  },
}));

// ride-storage lazily import()s analytics on the corruption path only; stub it so
// the test never pulls the real (ESM) Sentry module into the jest transform.
jest.mock('../../lib/analytics', () => ({ captureException: jest.fn() }));

import { RIDE_WAYPOINT_LIMITS, type Waypoint } from '@motovault/types';
import {
  appendWaypoint,
  CHUNK_SIZE,
  clearPointBuffer,
  getPointBuffer,
  resetWaypointBudget,
  rideMMKV,
  waypointRecordingStride,
} from '../ride-storage';

const CAP = RIDE_WAYPOINT_LIMITS.MAX_PER_RIDE;
const RIDE_ID = 'ride-1';

function waypoint(index: number): Waypoint {
  return {
    latitude: 45 + index * 1e-5,
    longitude: 14 + index * 1e-5,
    recordedAt: new Date(1_700_000_000_000 + index * 1000).toISOString(),
  };
}

beforeEach(() => {
  mockRideStore.clear();
  clearPointBuffer();
  resetWaypointBudget();
});

describe('waypointRecordingStride', () => {
  it('keeps every fix while the ride is under half the cap', () => {
    expect(waypointRecordingStride(0)).toBe(1);
    expect(waypointRecordingStride(CAP / 2 - 1)).toBe(1);
  });

  it('doubles the stride each time half the remaining budget is spent', () => {
    // Each tier consumes half of what is left at twice the stride, so each covers
    // twice the wall-clock of the one before.
    expect(waypointRecordingStride(CAP / 2)).toBe(2);
    expect(waypointRecordingStride(CAP / 2 + CAP / 4)).toBe(4);
    expect(waypointRecordingStride(CAP / 2 + CAP / 4 + CAP / 8)).toBe(8);
  });

  it('never returns a finite stride at or past the cap', () => {
    expect(waypointRecordingStride(CAP)).toBe(Number.POSITIVE_INFINITY);
    expect(waypointRecordingStride(CAP + 1_000)).toBe(Number.POSITIVE_INFINITY);
  });

  it('terminates and stays monotonic right up to the cap', () => {
    let previous = 0;
    for (const recorded of [CAP - 1, CAP - 2, CAP - 10, CAP - 500]) {
      const stride = waypointRecordingStride(recorded);
      expect(Number.isFinite(stride)).toBe(true);
      expect(stride).toBeGreaterThan(0);
    }
    for (const recorded of [0, 1_000, 5_000, 8_000, 9_500, 9_990]) {
      const stride = waypointRecordingStride(recorded);
      expect(stride).toBeGreaterThanOrEqual(previous);
      previous = stride;
    }
  });
});

describe('appendWaypoint budget enforcement', () => {
  it('banks every fix and flushes a chunk at CHUNK_SIZE while under half the cap', () => {
    const flushed: Waypoint[][] = [];
    for (let i = 0; i < CHUNK_SIZE; i++) {
      const chunk = appendWaypoint(RIDE_ID, waypoint(i));
      if (chunk) flushed.push(chunk);
    }

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(CHUNK_SIZE);
    expect(rideMMKV.getWaypointCount()).toBe(CHUNK_SIZE);
  });

  it('decimates once the ride crosses half the cap', () => {
    rideMMKV.setWaypointCount(CAP / 2);

    // stride 2 → every other fix is kept.
    for (let i = 0; i < 10; i++) appendWaypoint(RIDE_ID, waypoint(i));

    expect(getPointBuffer()).toHaveLength(5);
    expect(rideMMKV.getWaypointCount()).toBe(CAP / 2 + 5);
  });

  it('records nothing at all once the cap is reached', () => {
    rideMMKV.setWaypointCount(CAP);

    for (let i = 0; i < 200; i++) {
      // A returned chunk would be enqueued and permanently rejected — the exact
      // loop this budget exists to prevent.
      expect(appendWaypoint(RIDE_ID, waypoint(i))).toBeNull();
    }

    expect(getPointBuffer()).toHaveLength(0);
    expect(rideMMKV.getWaypointCount()).toBe(CAP);
  });

  it('never lets the banked total exceed the cap over a very long ride', () => {
    // 40,000 fixes ≈ 11 hours at 1 Hz — four times the raw cap.
    for (let i = 0; i < 40_000; i++) appendWaypoint(RIDE_ID, waypoint(i));

    expect(rideMMKV.getWaypointCount()).toBeLessThan(CAP);
    // …and the track still covers the whole ride rather than stopping dead at 10k.
    expect(rideMMKV.getWaypointCount()).toBeGreaterThan(CAP / 2);
  });

  it('resetWaypointBudget returns a fresh ride to full resolution', () => {
    rideMMKV.setWaypointCount(CAP);
    resetWaypointBudget();

    expect(rideMMKV.getWaypointCount()).toBe(0);
    expect(appendWaypoint(RIDE_ID, waypoint(0))).toBeNull(); // buffered, not yet a chunk
    expect(getPointBuffer()).toHaveLength(1);
  });
});
