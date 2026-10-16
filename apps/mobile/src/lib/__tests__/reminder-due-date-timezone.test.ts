/**
 * A reminder for a task due on the 20th fires on the 19th at 09:00 in the
 * rider's time zone, in every time zone. `due_date` arrives as a date-only
 * string (`YYYY-MM-DD`); read as UTC midnight it is still the 19th in the
 * Americas, so every stage landed a day early there.
 *
 * A time zone cannot be switched inside a running jest worker, so the cases run
 * once in the machine zone and once each in a child jest pinned to UTC+2 and
 * UTC−5 (no daylight saving in either). Mirrors `__tests__/days-until-timezone.test.ts`.
 */
jest.mock('expo-notifications', () => {
  let n = 0;
  return {
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
    scheduleNotificationAsync: jest.fn(() => Promise.resolve(`notif-${++n}`)),
    cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
    setNotificationCategoryAsync: jest.fn(() => Promise.resolve()),
    setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
    SchedulableTriggerInputTypes: { DATE: 'date' },
    AndroidImportance: { HIGH: 4, DEFAULT: 3 },
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
jest.mock('../logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));
jest.mock('../../i18n', () => ({
  __esModule: true,
  default: { t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key },
}));

import { execFile } from 'node:child_process';
import path from 'node:path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  reconcileMaintenanceReminders,
  scheduleDocumentExpiryReminder,
  scheduleMaintenanceReminder,
} from '../notifications';

const CHILD_ZONE_ENV = 'REMINDER_TZ_CHILD';
const CHILD_TIMEOUT_MS = 120_000;

/** Minutes behind (+) or ahead (−) of UTC that `getTimezoneOffset` must report in October 2026. */
const ZONES = {
  EAST: { name: 'Africa/Johannesburg', offsetMinutes: -120 },
  WEST: { name: 'America/Bogota', offsetMinutes: 300 },
} as const;

const childZone = process.env[CHILD_ZONE_ENV];
const isChild = childZone !== undefined;

const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
// biome-ignore lint/suspicious/noExplicitAny: reaching into the mock's backing map
const storage = (AsyncStorage as any).__store as Map<string, string>;
const NOTIFICATION_MAP_KEY = '@motovault/notification-map';
const SCHEDULE_VERSION_KEY = '@motovault/reminder-schedule-version';

/** The rider's day, 2026-10-02, at the two moments where UTC and local dates differ most. */
const MOMENTS_OF_OCT_2: Array<[label: string, now: Date]> = [
  ['00:30', new Date(2026, 9, 2, 0, 30)],
  ['23:30', new Date(2026, 9, 2, 23, 30)],
];

/** Date-only strings as `due_date` and `expiry_date` arrive from the API. */
const DUE_OCT_20 = '2026-10-20';
const NINE_AM = (day: number) => new Date(2026, 9, day, 9, 0, 0, 0);

const triggerDates = () =>
  schedule.mock.calls
    .map(([input]) => (input.trigger as { date: Date }).date)
    .sort((a, b) => a.getTime() - b.getTime());

describe(`reminder fire dates (${childZone ?? 'machine zone'})`, () => {
  describe.each(MOMENTS_OF_OCT_2)('today is 2026-10-02 at %s', (_label, now) => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers({ now });
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('maintenance task due on the 20th: the 7-day stage fires on the 13th, the 1-day stage on the 19th, both at 09:00 local', async () => {
      await scheduleMaintenanceReminder(
        {
          id: 'task-1',
          title: 'Chain',
          dueDate: DUE_OCT_20,
          motorcycleId: 'bike-1',
          remind7d: true,
          remind1d: true,
        },
        'Africa Twin',
      );
      expect(triggerDates()).toEqual([NINE_AM(13), NINE_AM(19)]);
    });

    it('document expiring on the 20th: the 7-day and 1-day stages fire on the 13th and 19th at 09:00 local (30-day already past)', async () => {
      await scheduleDocumentExpiryReminder(
        { id: 'doc-1', title: 'Insurance', expiryDate: DUE_OCT_20, motorcycleId: 'bike-1' },
        'Africa Twin',
      );
      expect(triggerDates()).toEqual([NINE_AM(13), NINE_AM(19)]);
    });
  });
});

describe('stages scheduled under the old rule are rescheduled once', () => {
  const task = {
    id: 'task-1',
    title: 'Chain',
    dueDate: DUE_OCT_20,
    motorcycleId: 'bike-1',
    status: 'pending',
    remind1d: true,
  };
  const bikeNames = { 'bike-1': 'Africa Twin' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(2026, 9, 2, 9, 30) });
    storage.clear();
    // What a rider updating from 3.26.0 carries: stage ids stored for an active
    // task and for a document, and no schedule version.
    storage.set(
      NOTIFICATION_MAP_KEY,
      JSON.stringify({ 'task-1': ['old-task-stage'], 'doc:doc-1': ['old-doc-stage'] }),
    );
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reconcile drops the stored maintenance stages, reschedules the task on the right day, and leaves documents alone', async () => {
    await reconcileMaintenanceReminders([task], bikeNames);

    expect(cancel).toHaveBeenCalledWith('old-task-stage');
    expect(cancel).not.toHaveBeenCalledWith('old-doc-stage');
    expect(triggerDates()).toEqual([NINE_AM(19)]);
    expect(storage.get(SCHEDULE_VERSION_KEY)).toBeDefined();
    const map = JSON.parse(storage.get(NOTIFICATION_MAP_KEY) ?? '{}');
    expect(map['doc:doc-1']).toEqual(['old-doc-stage']);
    expect(map['task-1']).toHaveLength(1);
  });

  it('the next reconcile leaves the rescheduled stages alone', async () => {
    await reconcileMaintenanceReminders([task], bikeNames);
    jest.clearAllMocks();

    await reconcileMaintenanceReminders([task], bikeNames);

    expect(cancel).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });
});

if (isChild) {
  it(`really runs in ${childZone}`, () => {
    const zone = Object.values(ZONES).find((candidate) => candidate.name === childZone);
    expect(zone).toBeDefined();
    expect(new Date(2026, 9, 2).getTimezoneOffset()).toBe(zone?.offsetMinutes);
  });
} else {
  /** Runs this file again in a child jest whose runtime is in `zone`. */
  function runIn(zone: string): Promise<{ code: number; output: string }> {
    const mobileRoot = path.resolve(__dirname, '../../..');
    const jestBin = require.resolve('jest/bin/jest');
    // The child must not think it is a worker of this run.
    const { JEST_WORKER_ID: _worker, ...env } = process.env;
    return new Promise((resolve) => {
      execFile(
        process.execPath,
        [jestBin, '--runTestsByPath', __filename, '--ci', '--silent', '--colors=false'],
        {
          cwd: mobileRoot,
          env: { ...env, TZ: zone, [CHILD_ZONE_ENV]: zone },
          timeout: CHILD_TIMEOUT_MS,
        },
        (error, stdout, stderr) => {
          const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
          resolve({ code, output: `${stdout}\n${stderr}` });
        },
      );
    });
  }

  describe('the same fire dates in other time zones', () => {
    // Serial on purpose: one child jest at a time.
    it.each([
      ['UTC+2', ZONES.EAST.name],
      ['UTC−5', ZONES.WEST.name],
    ])(
      'the same cases pass under %s (%s)',
      async (_label, zone) => {
        const { code, output } = await runIn(zone);
        // The child's report is the failure message when a case breaks there.
        expect({ zone, code, output: code === 0 ? '' : output }).toEqual({
          zone,
          code: 0,
          output: '',
        });
      },
      CHILD_TIMEOUT_MS,
    );
  });
}
