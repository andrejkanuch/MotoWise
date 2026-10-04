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
jest.mock('../../features/ride/ride-reminders', () => ({
  noteRideMovement: jest.fn(),
  cancelRideReminders: jest.fn(() => Promise.resolve()),
}));

import {
  type AutoPauseState,
  decideAutoPause,
  rideAutoEndedNotificationContent,
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

  it('re-anchors instead of pausing when the rider creeps forward past the jitter radius', () => {
    const state: AutoPauseState = { ...FRESH, zeroSpeedTimer: NOW - 61_000, zeroSpeedAnchor: POS };
    const movedPos = { lat: 50.001, lng: 14 }; // ~111m away
    const d = decideAutoPause(state, { rawSpeed: 0, pos: movedPos }, 'moving', NOW);
    expect(d.effects).toEqual([]);
    expect(d.next.zeroSpeedAnchor).toEqual(movedPos);
    expect(d.next.zeroSpeedTimer).toBe(NOW);
  });

  it('ends the stop episode when the rider creeps forward after being nudged', () => {
    // Traffic crawl: >5m per sample but under the speed threshold, so only the
    // distance re-anchor path sees the movement. It used to leave the episode armed —
    // CarPlay kept asking "STILL RIDING?", a later real stop could never nudge again,
    // and the pre-creep stationary time still counted toward the 30-min auto-end.
    const state: AutoPauseState = {
      zeroSpeedTimer: NOW - 12 * MIN,
      zeroSpeedAnchor: POS,
      continuousAutoPauseStart: NOW - 11 * MIN,
      forgotToStopNotified: true,
    };
    const movedPos = { lat: 50.001, lng: 14 }; // ~111m away
    const d = decideAutoPause(state, { rawSpeed: 0, pos: movedPos }, 'stopped', NOW);

    expect(d.effects).toEqual([
      { kind: 'setForgotToStopPending', value: false },
      { kind: 'setSubState', value: 'moving' },
    ]);
    expect(d.next.continuousAutoPauseStart).toBeNull();
    expect(d.next.forgotToStopNotified).toBe(false);
    // Re-anchored, not paused.
    expect(d.next.zeroSpeedAnchor).toEqual(movedPos);
    expect(d.next.zeroSpeedTimer).toBe(NOW);
    expect(d.abort).toBe(false);
  });

  it('re-arms the forgot-to-stop episode after a creep, so a later stop still nudges', () => {
    // The reason the creep emits setSubState 'moving': with the sub-state stuck at
    // 'stopped', continuousAutoPauseStart would never be set again and the rider
    // could not be nudged for the rest of the ride.
    const afterCreep: AutoPauseState = {
      zeroSpeedTimer: NOW - 61_000,
      zeroSpeedAnchor: POS,
      continuousAutoPauseStart: null,
      forgotToStopNotified: false,
    };
    const d = decideAutoPause(afterCreep, { rawSpeed: 0, pos: POS }, 'moving', NOW);
    expect(d.next.continuousAutoPauseStart).toBe(NOW);
  });

  it('flags forgot-to-stop once after 10 min stopped (the notification itself is scheduled by ride-reminders)', () => {
    const state: AutoPauseState = {
      zeroSpeedTimer: NOW - 12 * MIN,
      zeroSpeedAnchor: POS,
      continuousAutoPauseStart: NOW - 11 * MIN,
      forgotToStopNotified: false,
    };
    const d = decideAutoPause(state, { rawSpeed: 0, pos: POS }, 'stopped', NOW);
    // The persisted flag ships alongside the notification so the CarPlay panel can
    // show the prompt too — the notification alone is easy to miss on a bike.
    expect(d.effects).toEqual([{ kind: 'setForgotToStopPending', value: true }]);
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

describe('creep radius', () => {
  const stopped: AutoPauseState = {
    ...FRESH,
    zeroSpeedTimer: NOW - 61_000,
    zeroSpeedAnchor: POS,
  };
  // ~11 m north of POS: well inside the GPS jitter of a parked phone.
  const jitterPos = { lat: 50.0001, lng: 14 };

  it('treats wander inside 25 m as standing still, not creeping', () => {
    // At the old 5 m radius every jittery fix re-anchored and restarted the stop
    // clock, so a parked rider indoors was never flagged and never auto-ended.
    const d = decideAutoPause(stopped, { rawSpeed: 0, pos: jitterPos, accuracy: 8 }, 'moving', NOW);
    expect(d.next.zeroSpeedAnchor).toEqual(POS);
    expect(d.effects).toContainEqual({ kind: 'setSubState', value: 'stopped' });
  });

  it("widens the radius to twice a poor fix's accuracy", () => {
    const farPos = { lat: 50.0003, lng: 14 }; // ~33 m
    const precise = decideAutoPause(
      stopped,
      { rawSpeed: 0, pos: farPos, accuracy: 5 },
      'moving',
      NOW,
    );
    expect(precise.next.zeroSpeedAnchor).toEqual(farPos); // beyond 25 m: creeping

    const poor = decideAutoPause(
      stopped,
      { rawSpeed: 0, pos: farPos, accuracy: 30 },
      'moving',
      NOW,
    );
    expect(poor.next.zeroSpeedAnchor).toEqual(POS); // inside 60 m: still standing
  });
});

describe('rideAutoEndedNotificationContent', () => {
  it('marks the ride as already ended so the tap opens the saved ride', () => {
    expect(rideAutoEndedNotificationContent('ride-123').data).toEqual({
      kind: 'ride_idle',
      rideId: 'ride-123',
      autoEnded: true,
    });
  });

  it('interpolates the auto-end threshold into the fallback copy', () => {
    const { body } = rideAutoEndedNotificationContent('r1');
    expect(body).toContain('30');
    expect(body).not.toContain('{{minutes}}');
  });
});
