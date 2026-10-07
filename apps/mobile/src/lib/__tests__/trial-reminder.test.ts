// Day-5 trial-ending reminder (R8 / AE4). Pins the pure fire-time rule and the
// reconcile contract: one OS notification per renewing trial, cancelled when the
// trial stops renewing, re-armed when the OS lost it (sign-out cancels all).

jest.mock('expo-notifications', () => {
  let n = 0;
  return {
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
    scheduleNotificationAsync: jest.fn(() => Promise.resolve(`notif-${++n}`)),
    cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
    SchedulableTriggerInputTypes: { DATE: 'date' },
  };
});
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      }),
      removeItem: jest.fn((k: string) => {
        store.delete(k);
        return Promise.resolve();
      }),
      __store: store,
    },
  };
});
jest.mock('../notifications', () => ({
  IOS_NOTIFICATION_BUDGET: 60,
  NOTIFICATION_CHANNEL: { ACCOUNT: 'account' },
  NOTIFICATION_KIND: { TRIAL_REMINDER: 'trial_reminder' },
  hasNotificationPermission: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('../logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('../../i18n', () => ({
  __esModule: true,
  default: {
    t: (_key: string, opts: { defaultValue: string }) => opts.defaultValue,
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, subHours } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { hasNotificationPermission } from '../notifications';
import { reconcileTrialReminder, trialReminderFireDate } from '../trial-reminder';

const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const getScheduled = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const permission = hasNotificationPermission as jest.Mock;
// biome-ignore lint/suspicious/noExplicitAny: reaching into the mock's backing map
const storage = (AsyncStorage as any).__store as Map<string, string>;

const NOW = new Date('2026-10-07T10:00:00.000Z');
const EXPIRES = addDays(NOW, 7);
const renewingTrial = {
  periodType: 'TRIAL',
  willRenew: true,
  expirationDate: EXPIRES.toISOString(),
};

/** The OS's view of pending notifications, as getAllScheduledNotificationsAsync returns it. */
function osHas(...ids: string[]) {
  getScheduled.mockResolvedValue(
    ids.map((identifier) => ({ identifier, content: { data: { kind: 'trial_reminder' } } })),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  storage.clear();
  permission.mockResolvedValue(true);
  getScheduled.mockResolvedValue([]);
});

describe('trialReminderFireDate', () => {
  it('fires 48 h before a renewing 7-day trial expires (AE4)', () => {
    expect(trialReminderFireDate(renewingTrial, NOW)).toEqual(subHours(EXPIRES, 48));
  });

  it('is none when the trial will not renew', () => {
    expect(trialReminderFireDate({ ...renewingTrial, willRenew: false }, NOW)).toBeNull();
  });

  it('is none for a paid (NORMAL) period', () => {
    expect(trialReminderFireDate({ ...renewingTrial, periodType: 'NORMAL' }, NOW)).toBeNull();
  });

  it('is none without an expiration date or entitlement', () => {
    expect(trialReminderFireDate({ ...renewingTrial, expirationDate: null }, NOW)).toBeNull();
    expect(trialReminderFireDate(undefined, NOW)).toBeNull();
  });

  it('is none once expiration − 48 h has passed', () => {
    const soon = { ...renewingTrial, expirationDate: addDays(NOW, 1).toISOString() };
    expect(trialReminderFireDate(soon, NOW)).toBeNull();
  });
});

describe('reconcileTrialReminder', () => {
  it('schedules one reminder at expiration − 48 h for a renewing trial', async () => {
    await reconcileTrialReminder(renewingTrial, NOW);

    expect(schedule).toHaveBeenCalledTimes(1);
    const req = schedule.mock.calls[0][0];
    expect(req.trigger.date).toEqual(subHours(EXPIRES, 48));
    expect(req.trigger.channelId).toBe('account');
    expect(req.content.data).toEqual({ kind: 'trial_reminder' });
  });

  it('cancels the existing reminder when the trial stops renewing', async () => {
    await reconcileTrialReminder(renewingTrial, NOW);
    const id = await schedule.mock.results[0].value;
    osHas(id);
    schedule.mockClear();

    await reconcileTrialReminder({ ...renewingTrial, willRenew: false }, NOW);

    expect(cancel).toHaveBeenCalledWith(id);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('schedules nothing for a NORMAL period', async () => {
    await reconcileTrialReminder({ ...renewingTrial, periodType: 'NORMAL' }, NOW);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('schedules nothing when the fire time is already past', async () => {
    await reconcileTrialReminder(
      { ...renewingTrial, expirationDate: addDays(NOW, 1).toISOString() },
      NOW,
    );
    expect(schedule).not.toHaveBeenCalled();
  });

  it('does not reschedule an unchanged target the OS still holds', async () => {
    await reconcileTrialReminder(renewingTrial, NOW);
    osHas(await schedule.mock.results[0].value);
    schedule.mockClear();

    await reconcileTrialReminder(renewingTrial, NOW);

    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('reschedules an unchanged target the OS lost (sign-out cancels all)', async () => {
    await reconcileTrialReminder(renewingTrial, NOW);
    osHas(); // cancelAllScheduledNotificationsAsync ran in between
    schedule.mockClear();

    await reconcileTrialReminder(renewingTrial, NOW);

    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it('schedules nothing and does not throw without notification permission', async () => {
    permission.mockResolvedValue(false);

    await expect(reconcileTrialReminder(renewingTrial, NOW)).resolves.toBeUndefined();
    expect(schedule).not.toHaveBeenCalled();
  });
});
