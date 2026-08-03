// ride-location.ts runs top-level side effects (TaskManager.defineTask, MMKV,
// store wiring) on import, so stub the native/heavy deps. decideAutoPause itself
// is pure — it only uses distanceMeters + the module's threshold constants.
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
  enqueue: jest.fn(),
  getQueueLength: jest.fn().mockReturnValue(0),
}));
jest.mock('../../lib/analytics', () => ({ captureException: jest.fn() }));

import {
  type AutoPauseState,
  decideAutoPause,
  forgotToStopNotificationContent,
} from '../ride-location';

const NOW = 1_700_000_000_000;
const POS = { lat: 50, lng: 14 };
const MIN = 60_000;

const FRESH: AutoPauseState = {
  zeroSpeedTimer: null,
  zeroSpeedAnchor: null,
  continuousAutoPauseStart: null,
  forgotToStopNotified: false,
};

describe('decideAutoPause', () => {
  it('does nothing while moving with no pending stop', () => {
    const d = decideAutoPause(FRESH, { rawSpeed: 12, pos: POS }, 'moving', NOW);
    expect(d.next).toEqual(FRESH);
    expect(d.effects).toEqual([]);
    expect(d.abort).toBe(false);
  });

  it('arms the zero-speed timer on the first slow sample without pausing yet', () => {
    const d = decideAutoPause(FRESH, { rawSpeed: 0, pos: POS }, 'moving', NOW);
    expect(d.next.zeroSpeedTimer).toBe(NOW);
    expect(d.next.zeroSpeedAnchor).toEqual(POS);
    expect(d.effects).toEqual([]);
  });

  it('transitions to stopped after 60s of stillness', () => {
    const state: AutoPauseState = { ...FRESH, zeroSpeedTimer: NOW - 61_000, zeroSpeedAnchor: POS };
    const d = decideAutoPause(state, { rawSpeed: 0, pos: POS }, 'moving', NOW);
    expect(d.effects).toEqual([
      { kind: 'setSubState', value: 'stopped' },
      { kind: 'updateSpeedZero' },
    ]);
    expect(d.next.continuousAutoPauseStart).toBe(NOW);
  });

  it('re-anchors instead of pausing when the rider creeps forward >5m', () => {
    const state: AutoPauseState = { ...FRESH, zeroSpeedTimer: NOW - 61_000, zeroSpeedAnchor: POS };
    const movedPos = { lat: 50.001, lng: 14 }; // ~111m away
    const d = decideAutoPause(state, { rawSpeed: 0, pos: movedPos }, 'moving', NOW);
    expect(d.effects).toEqual([]);
    expect(d.next.zeroSpeedAnchor).toEqual(movedPos);
    expect(d.next.zeroSpeedTimer).toBe(NOW);
  });

  it('fires the forgot-to-stop notification once after 10 min stopped', () => {
    const state: AutoPauseState = {
      zeroSpeedTimer: NOW - 12 * MIN,
      zeroSpeedAnchor: POS,
      continuousAutoPauseStart: NOW - 11 * MIN,
      forgotToStopNotified: false,
    };
    const d = decideAutoPause(state, { rawSpeed: 0, pos: POS }, 'stopped', NOW);
    // The persisted flag ships alongside the notification so the CarPlay panel can
    // show the prompt too — the notification alone is easy to miss on a bike.
    expect(d.effects).toEqual([
      { kind: 'notifyForgotToStop' },
      { kind: 'setForgotToStopPending', value: true },
    ]);
    expect(d.next.forgotToStopNotified).toBe(true);
  });

  it('does not re-notify once already notified', () => {
    const state: AutoPauseState = {
      zeroSpeedTimer: NOW - 12 * MIN,
      zeroSpeedAnchor: POS,
      continuousAutoPauseStart: NOW - 11 * MIN,
      forgotToStopNotified: true,
    };
    const d = decideAutoPause(state, { rawSpeed: 0, pos: POS }, 'stopped', NOW);
    expect(d.effects).toEqual([]);
  });

  it('auto-ends the ride and aborts after 30 min stopped', () => {
    const idleSince = NOW - 31 * MIN;
    const state: AutoPauseState = {
      zeroSpeedTimer: NOW - 32 * MIN,
      zeroSpeedAnchor: POS,
      continuousAutoPauseStart: idleSince,
      forgotToStopNotified: true,
    };
    const d = decideAutoPause(state, { rawSpeed: 0, pos: POS }, 'stopped', NOW);
    expect(d.effects).toEqual([{ kind: 'autoEnd', idleSince }]);
    expect(d.abort).toBe(true);
  });

  it('accumulates auto-paused time and resumes when moving after a >60s stop', () => {
    const state: AutoPauseState = {
      zeroSpeedTimer: NOW - 90_000,
      zeroSpeedAnchor: POS,
      continuousAutoPauseStart: NOW - 80_000,
      forgotToStopNotified: true,
    };
    const d = decideAutoPause(state, { rawSpeed: 10, pos: POS }, 'stopped', NOW);
    // Moving again answers "still riding?" — the flag must clear, or CarPlay keeps
    // prompting a rider who is demonstrably still going.
    expect(d.effects).toEqual([
      { kind: 'addAutoPausedMs', ms: 90_000 },
      { kind: 'setSubState', value: 'moving' },
      { kind: 'setForgotToStopPending', value: false },
    ]);
    expect(d.next).toEqual(FRESH); // all timers cleared
  });

  it('resets timers without accumulating when the stop was under 60s', () => {
    const state: AutoPauseState = { ...FRESH, zeroSpeedTimer: NOW - 30_000, zeroSpeedAnchor: POS };
    const d = decideAutoPause(state, { rawSpeed: 10, pos: POS }, 'moving', NOW);
    expect(d.effects).toEqual([]);
    expect(d.next).toEqual(FRESH);
  });
});

describe('forgotToStopNotificationContent', () => {
  it('carries the RIDE_IDLE kind and rideId so the tap is routable', () => {
    // The bug this pins: the nudge used to ship with no `data` at all, so the tap
    // handler in _layout hit its `if (!data?.taskId) return` guard and tapping the
    // notification did nothing. The kind is what makes it routable, and the shape
    // must match the server sweep's push so one handler branch covers both.
    const content = forgotToStopNotificationContent('ride-123');

    expect(content.data).toEqual({
      kind: 'ride_idle',
      rideId: 'ride-123',
      autoEnded: false,
    });
  });

  it('is still routable when no ride id is available', () => {
    // A missing rideId must not drop the kind — the handler falls back to the live
    // HUD, which is the correct destination for a ride that is still recording.
    expect(forgotToStopNotificationContent(undefined).data).toMatchObject({
      kind: 'ride_idle',
      autoEnded: false,
    });
  });

  it('interpolates the stopped-for duration from the configured threshold', () => {
    // i18n is not initialized under jest, so t() returns the defaultValue — which is
    // exactly what we want to assert: the fallback copy is interpolated, not literal.
    expect(forgotToStopNotificationContent('r1', 15 * 60_000).body).toContain('15');
    expect(forgotToStopNotificationContent('r1', 15 * 60_000).body).not.toContain('{{minutes}}');
  });
});
