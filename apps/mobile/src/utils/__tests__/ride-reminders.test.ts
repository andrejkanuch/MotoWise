// The forgotten-ride reminders are scheduled OS notifications pushed back by
// movement. These tests pin the contract the rest of the ride code relies on:
// what gets scheduled and when, that cancel really cancels (even when ride data is
// wiped right after), and the trim target an "End ride" press uses.

jest.mock('expo-notifications', () => {
  let n = 0;
  return {
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    scheduleNotificationAsync: jest.fn(() => Promise.resolve(`notif-${++n}`)),
    cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
    dismissNotificationAsync: jest.fn(() => Promise.resolve()),
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  };
});
jest.mock('../../lib/analytics', () => ({ captureException: jest.fn() }));
jest.mock('../../lib/notifications', () => ({
  NOTIFICATION_CATEGORY: { RIDE_IDLE: 'RIDE_IDLE', RIDE_PAUSED: 'RIDE_PAUSED' },
  NOTIFICATION_CHANNEL: { RIDE_ALERTS: 'ride-alerts' },
  NOTIFICATION_KIND: { RIDE_IDLE: 'ride_idle' },
}));
jest.mock('../../i18n', () => ({
  __esModule: true,
  default: {
    t: (_key: string, opts: { defaultValue: string }) => opts.defaultValue,
  },
}));
jest.mock('../ride-storage', () => {
  const state = {
    currentId: 'ride-1' as string | undefined,
    startedAt: 1_000_000 as number | undefined,
    lastMovementAt: 0,
    reminderIds: [] as string[],
    phase: 'recording' as string,
  };
  return {
    __state: state,
    RIDE_PHASE: { RECORDING: 'recording', PAUSED: 'paused', ENDED: 'ended' },
    readRideRecord: () =>
      state.currentId ? { rideId: state.currentId, phase: state.phase } : null,
    rideMMKV: {
      getCurrentId: () => state.currentId,
      getStartedAt: () => state.startedAt,
      getLastMovementAt: () => state.lastMovementAt,
      setLastMovementAt: (ms: number) => {
        state.lastMovementAt = ms;
      },
      getReminderIds: () => state.reminderIds,
      setReminderIds: (ids: string[]) => {
        state.reminderIds = [...ids];
      },
    },
  };
});

import * as Notifications from 'expo-notifications';
import {
  __resetRideRemindersForTest,
  armRideReminders,
  cancelRideReminders,
  noteRideMovement,
  RIDE_PAUSED_REMINDER_MINUTES,
  RIDE_REMINDER_REARM_THROTTLE_MS,
  rideEndTrimTarget,
  rideReminderContent,
} from '../ride-reminders';
import * as storage from '../ride-storage';

// biome-ignore lint/suspicious/noExplicitAny: reaching into the mock's mutable state
const state = (storage as any).__state as {
  currentId: string | undefined;
  startedAt: number | undefined;
  lastMovementAt: number;
  reminderIds: string[];
  phase: string;
};
const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const permissions = Notifications.getPermissionsAsync as jest.Mock;
const NOW = 5_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  __resetRideRemindersForTest();
  state.currentId = 'ride-1';
  state.startedAt = 1_000_000;
  state.lastMovementAt = 0;
  state.reminderIds = [];
  state.phase = 'recording';
  permissions.mockResolvedValue({ status: 'granted' });
  // clearAllMocks keeps implementations; undo a test's throwing override.
  (Notifications.dismissNotificationAsync as jest.Mock).mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  (Date.now as jest.Mock).mockRestore();
});

describe('armRideReminders', () => {
  it('schedules a 10-minute nudge and a 30-minute final reminder from the given time', async () => {
    await armRideReminders(NOW);

    expect(schedule).toHaveBeenCalledTimes(2);
    const [nudge, final] = schedule.mock.calls.map(([req]) => req);
    expect(nudge.trigger).toMatchObject({ seconds: 600, channelId: 'ride-alerts' });
    expect(final.trigger).toMatchObject({ seconds: 1800, channelId: 'ride-alerts' });
    expect(nudge.content.categoryIdentifier).toBe('RIDE_IDLE');
    expect(state.reminderIds).toHaveLength(2);
  });

  it('counts from the last movement, not from when the call runs', async () => {
    // Movement 4 minutes ago: the nudge is 6 minutes out, not 10.
    await armRideReminders(NOW - 4 * 60_000);
    expect(schedule.mock.calls[0][0].trigger.seconds).toBe(360);
  });

  it('cancels the previous set before scheduling the next', async () => {
    await armRideReminders(NOW);
    const first = [...state.reminderIds];
    await armRideReminders(NOW);
    expect(cancel.mock.calls.map(([id]) => id)).toEqual(first);
  });

  it('schedules nothing without notification permission', async () => {
    permissions.mockResolvedValue({ status: 'denied' });
    await armRideReminders(NOW);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('gives a paused ride one "still paused" reminder 2 h out, not the idle pair', async () => {
    state.phase = 'paused';
    await armRideReminders(NOW);
    expect(schedule).toHaveBeenCalledTimes(1);
    const [{ content, trigger }] = schedule.mock.calls[0];
    expect(content.data).toEqual(expect.objectContaining({ stage: 'paused', rideId: 'ride-1' }));
    // Its own buttons: End ride / Resume ride, not "Still riding".
    expect(content.categoryIdentifier).toBe('RIDE_PAUSED');
    expect(trigger.seconds).toBe(RIDE_PAUSED_REMINDER_MINUTES * 60);
  });

  it('swaps the sets when the phase changes, cancelling the previous one', async () => {
    await armRideReminders(NOW);
    const idleIds = [...state.reminderIds];
    expect(idleIds).toHaveLength(2);
    state.phase = 'paused';
    await armRideReminders(NOW);
    expect(cancel.mock.calls.map(([id]) => id)).toEqual(expect.arrayContaining(idleIds));
    expect(state.reminderIds).toHaveLength(1);
  });

  it('schedules nothing once the ride has ended or is gone', async () => {
    state.phase = 'ended';
    await armRideReminders(NOW);
    state.phase = 'recording';
    state.currentId = undefined;
    await armRideReminders(NOW);
    expect(schedule).not.toHaveBeenCalled();
  });
});

describe('cancelRideReminders', () => {
  it('cancels the scheduled ids even if ride data is wiped right after the call', async () => {
    await armRideReminders(NOW);
    const ids = [...state.reminderIds];

    const pending = cancelRideReminders();
    // The headless auto-end clears every ride key synchronously after ending.
    state.reminderIds = [];
    await pending;

    expect(cancel.mock.calls.map(([id]) => id)).toEqual(ids);
  });

  it('also removes reminders already shown, so a stale one cannot reopen the ride', async () => {
    await armRideReminders(NOW);
    const ids = [...state.reminderIds];
    await cancelRideReminders();
    const dismissed = (Notifications.dismissNotificationAsync as jest.Mock).mock.calls.map(
      ([id]) => id,
    );
    expect(dismissed).toEqual(expect.arrayContaining(ids));
  });

  it('still cancels when removing a shown reminder fails', async () => {
    (Notifications.dismissNotificationAsync as jest.Mock).mockImplementation(() => {
      throw new Error('not presented');
    });
    await armRideReminders(NOW);
    const ids = [...state.reminderIds];
    await cancelRideReminders();
    expect(cancel.mock.calls.map(([id]) => id)).toEqual(expect.arrayContaining(ids));
  });
});

describe('noteRideMovement', () => {
  it('persists the movement time and re-arms at most once per throttle window', async () => {
    noteRideMovement(NOW);
    noteRideMovement(NOW + 10_000);
    await new Promise((r) => setImmediate(r)); // let the queued arm settle

    expect(state.lastMovementAt).toBe(NOW + 10_000);
    expect(schedule).toHaveBeenCalledTimes(2); // one arm = two stages

    noteRideMovement(NOW + RIDE_REMINDER_REARM_THROTTLE_MS);
    await new Promise((r) => setImmediate(r));
    expect(schedule).toHaveBeenCalledTimes(4);
  });
});

describe('rideEndTrimTarget', () => {
  it('ends at the last movement after the start', () => {
    state.lastMovementAt = 3_000_000;
    expect(rideEndTrimTarget(NOW)).toBe(3_000_000);
  });

  it('falls back to now when nothing moved during this ride', () => {
    state.lastMovementAt = 500_000; // a previous ride's value
    expect(rideEndTrimTarget(NOW)).toBe(NOW);
    state.lastMovementAt = 0;
    expect(rideEndTrimTarget(NOW)).toBe(NOW);
  });
});

describe('rideReminderContent', () => {
  it('is routable by the shared RIDE_IDLE handler', () => {
    expect(rideReminderContent('nudge', 'ride-1', 10).data).toEqual({
      kind: 'ride_idle',
      rideId: 'ride-1',
      autoEnded: false,
      stage: 'nudge',
    });
  });

  it('interpolates the minutes into the fallback copy', () => {
    const { body } = rideReminderContent('final', 'ride-1', 30);
    expect(body).toContain('30');
    expect(body).not.toContain('{{minutes}}');
  });
});
