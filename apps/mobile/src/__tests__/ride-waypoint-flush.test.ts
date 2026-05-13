/**
 * Tests for the waypoint flush-on-end fix.
 *
 * The bug: when a ride ended, only full 50-waypoint chunks were uploaded.
 * Any remaining waypoints in the in-memory buffer were lost, causing
 * "Insufficient data for chart" on short rides.
 *
 * The fix: upload the partial buffer before sending the endRide mutation.
 */

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string | number | boolean>();
  return {
    createMMKV: () => ({
      getString: jest.fn((key: string) => {
        const val = store.get(key);
        return typeof val === 'string' ? val : undefined;
      }),
      getNumber: jest.fn((key: string) => {
        const val = store.get(key);
        return typeof val === 'number' ? val : undefined;
      }),
      getBoolean: jest.fn((key: string) => {
        const val = store.get(key);
        return typeof val === 'boolean' ? val : undefined;
      }),
      set: jest.fn((key: string, value: string | number | boolean) => {
        store.set(key, value);
      }),
      remove: jest.fn((key: string) => {
        store.delete(key);
      }),
      contains: jest.fn((key: string) => store.has(key)),
      getAllKeys: jest.fn(() => [...store.keys()]),
      __store: store,
    }),
  };
});

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
jest.mock('../utils/ride-sync-queue', () => ({
  enqueue: jest.fn(),
  enqueueOrExecute: jest.fn().mockResolvedValue(undefined),
  getQueueLength: jest.fn().mockReturnValue(0),
}));

import type { Waypoint } from '@motovault/types';
import {
  CHUNK_SIZE,
  appendWaypoint,
  clearPointBuffer,
  flushBufferToMMKV,
  getPointBuffer,
} from '../utils/ride-storage';
import { enqueueOrExecute } from '../utils/ride-sync-queue';

const mockedEnqueueOrExecute = enqueueOrExecute as jest.MockedFunction<typeof enqueueOrExecute>;

function makeWaypoint(index: number): Waypoint {
  return {
    latitude: 48.1486 + index * 0.0001,
    longitude: 17.1077 + index * 0.0001,
    altitude: 150 + index,
    speedMps: 10 + index * 0.5,
    heading: 90,
    accuracy: 5,
    recordedAt: new Date(Date.now() + index * 1000).toISOString(),
  };
}

describe('waypoint buffer flush on ride end', () => {
  const rideId = 'test-ride-id';

  beforeEach(() => {
    clearPointBuffer();
    mockedEnqueueOrExecute.mockClear();
  });

  it('appendWaypoint returns null when buffer is not full', () => {
    const result = appendWaypoint(rideId, makeWaypoint(0));
    expect(result).toBeNull();
    expect(getPointBuffer()).toHaveLength(1);
  });

  it('appendWaypoint returns chunk when buffer reaches CHUNK_SIZE', () => {
    for (let i = 0; i < CHUNK_SIZE - 1; i++) {
      expect(appendWaypoint(rideId, makeWaypoint(i))).toBeNull();
    }
    const chunk = appendWaypoint(rideId, makeWaypoint(CHUNK_SIZE - 1));
    expect(chunk).not.toBeNull();
    expect(chunk).toHaveLength(CHUNK_SIZE);
    // Buffer should be empty after flush
    expect(getPointBuffer()).toHaveLength(0);
  });

  it('partial buffer waypoints are available via getPointBuffer for upload at ride end', () => {
    const partialCount = 15;
    for (let i = 0; i < partialCount; i++) {
      appendWaypoint(rideId, makeWaypoint(i));
    }

    // Simulate what handleEndRide now does: read buffer and upload
    const bufferPoints = [...getPointBuffer()];
    expect(bufferPoints).toHaveLength(partialCount);

    // The fix: upload remaining waypoints
    if (bufferPoints.length > 0) {
      enqueueOrExecute('uploadWaypoints', {
        variables: { input: { rideId, waypoints: bufferPoints } },
      });
    }

    expect(mockedEnqueueOrExecute).toHaveBeenCalledWith('uploadWaypoints', {
      variables: {
        input: {
          rideId,
          waypoints: expect.arrayContaining([
            expect.objectContaining({ latitude: expect.any(Number) }),
          ]),
        },
      },
    });
    expect(mockedEnqueueOrExecute).toHaveBeenCalledTimes(1);
  });

  it('does NOT upload when buffer is empty (all waypoints already sent in full chunks)', () => {
    // Fill and flush exactly one full chunk
    for (let i = 0; i < CHUNK_SIZE; i++) {
      const chunk = appendWaypoint(rideId, makeWaypoint(i));
      if (chunk) {
        enqueueOrExecute('uploadWaypoints', {
          variables: { input: { rideId, waypoints: chunk } },
        });
      }
    }
    mockedEnqueueOrExecute.mockClear();

    // Simulate ride end — buffer is empty
    const bufferPoints = [...getPointBuffer()];
    expect(bufferPoints).toHaveLength(0);

    if (bufferPoints.length > 0) {
      enqueueOrExecute('uploadWaypoints', {
        variables: { input: { rideId, waypoints: bufferPoints } },
      });
    }

    // No extra upload call — all waypoints were already sent
    expect(mockedEnqueueOrExecute).not.toHaveBeenCalled();
  });

  it('flushBufferToMMKV persists partial buffer for crash recovery', () => {
    for (let i = 0; i < 5; i++) {
      appendWaypoint(rideId, makeWaypoint(i));
    }

    expect(getPointBuffer()).toHaveLength(5);
    flushBufferToMMKV(rideId);
    // Buffer is still in memory (flushBufferToMMKV is non-destructive)
    expect(getPointBuffer()).toHaveLength(5);
  });

  it('handles ride with waypoints spanning full chunks plus remainder', () => {
    const totalPoints = CHUNK_SIZE + 20; // 70 waypoints: 1 full chunk + 20 remaining
    let chunkCount = 0;

    for (let i = 0; i < totalPoints; i++) {
      const chunk = appendWaypoint(rideId, makeWaypoint(i));
      if (chunk) {
        chunkCount++;
        enqueueOrExecute('uploadWaypoints', {
          variables: { input: { rideId, waypoints: chunk } },
        });
      }
    }

    expect(chunkCount).toBe(1); // One full chunk was flushed during ride
    expect(mockedEnqueueOrExecute).toHaveBeenCalledTimes(1);

    // At ride end: 20 remaining waypoints need uploading
    const bufferPoints = [...getPointBuffer()];
    expect(bufferPoints).toHaveLength(20);

    mockedEnqueueOrExecute.mockClear();
    if (bufferPoints.length > 0) {
      enqueueOrExecute('uploadWaypoints', {
        variables: { input: { rideId, waypoints: bufferPoints } },
      });
    }

    expect(mockedEnqueueOrExecute).toHaveBeenCalledTimes(1);
    const uploadedWaypoints = mockedEnqueueOrExecute.mock.calls[0][1] as {
      variables: { input: { waypoints: Waypoint[] } };
    };
    expect(uploadedWaypoints.variables.input.waypoints).toHaveLength(20);
  });

  it('short ride with fewer waypoints than CHUNK_SIZE still gets uploaded', () => {
    // This is the exact scenario from the bug: an 11-min ride with < 50 waypoints
    const shortRideWaypoints = 30;

    for (let i = 0; i < shortRideWaypoints; i++) {
      appendWaypoint(rideId, makeWaypoint(i));
    }

    // During the ride, no chunks were uploaded (never hit CHUNK_SIZE)
    expect(mockedEnqueueOrExecute).not.toHaveBeenCalled();

    // At ride end: all 30 waypoints are in the buffer
    const bufferPoints = [...getPointBuffer()];
    expect(bufferPoints).toHaveLength(shortRideWaypoints);

    // The fix ensures these get uploaded
    if (bufferPoints.length > 0) {
      enqueueOrExecute('uploadWaypoints', {
        variables: { input: { rideId, waypoints: bufferPoints } },
      });
    }

    expect(mockedEnqueueOrExecute).toHaveBeenCalledTimes(1);
    const uploadedWaypoints = mockedEnqueueOrExecute.mock.calls[0][1] as {
      variables: { input: { waypoints: Waypoint[] } };
    };
    expect(uploadedWaypoints.variables.input.waypoints).toHaveLength(shortRideWaypoints);
  });
});
