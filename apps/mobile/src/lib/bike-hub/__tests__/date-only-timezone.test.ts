/**
 * Date-only strings ("2026-03-15") are calendar days. Parsed as UTC midnight
 * they slip to the previous day west of Greenwich, so "due today" would read
 * "1 day late" for every rider in the Americas.
 *
 * A time zone cannot be switched inside a running jest worker (its `process.env`
 * is a copy, so assigning `TZ` never reaches the runtime). The cases below
 * therefore run three times: once in the zone of the machine, and once each in
 * a child jest started with a negative and a positive UTC offset.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { MaintenancePriority } from '@motovault/graphql';
import { CATEGORIES, document, expenseYear, task } from '@/test/bike-hub-fixtures';
import { DUE_STATE, HUB_UNIT, RIDE_STATUS } from '../constants';
import { summariseCosts } from '../costs-summary';
import { getDocumentSignals } from '../documents';
import { formatMonthYear, formatShortDate } from '../format';
import { validateReading } from '../odometer-input';
import { getRideStatus } from '../ride-status';
import { type DueContext, getTaskDue } from '../task-due';

const CHILD_ZONE_ENV = 'BIKE_HUB_TZ_CHILD';
const CHILD_TIMEOUT_MS = 120_000;
const LOCALE = 'en-US';

/** Minutes behind (+) or ahead (−) of UTC that `getTimezoneOffset` must report on 2026-10-02. */
const ZONES = {
  NEGATIVE: { name: 'America/Los_Angeles', offsetMinutes: 420 },
  POSITIVE: { name: 'Pacific/Kiritimati', offsetMinutes: -840 },
} as const;

const childZone = process.env[CHILD_ZONE_ENV];
const isChild = childZone !== undefined;

/** "Today" for the rider, at three moments of the same local day. */
const MOMENTS_OF_OCT_2: Array<[label: string, today: Date]> = [
  ['just after midnight', new Date(2026, 9, 2, 0, 0, 30)],
  ['at noon', new Date(2026, 9, 2, 12)],
  ['just before midnight', new Date(2026, 9, 2, 23, 59, 30)],
];

const km = (today: Date): DueContext => ({ odometer: 38_167, today, unit: HUB_UNIT.KM });
const a = (dueDate: string) => task({ id: 'a', title: 'Task', dueDate });

describe(`date-only strings are local days (${childZone ?? 'machine zone'})`, () => {
  describe.each(MOMENTS_OF_OCT_2)('today is 2026-10-02, %s', (_label, today) => {
    it('a task dated 2026-10-02 is due today, not late', () => {
      const due = getTaskDue(a('2026-10-02'), km(today));
      expect(due.state).toBe(DUE_STATE.SOON);
      expect(due.primary).toMatchObject({ amount: 0 });
    });

    it('a task dated 2026-10-01 is exactly 1 day late', () => {
      const due = getTaskDue(a('2026-10-01'), km(today));
      expect(due.state).toBe(DUE_STATE.OVERDUE);
      expect(due.primary).toMatchObject({ amount: 1 });
    });

    it('a task dated 2026-03-15 is 201 days late', () => {
      expect(getTaskDue(a('2026-03-15'), km(today)).primary).toMatchObject({ amount: 201 });
    });

    it('a task dated 2026-11-01 is 30 days ahead: still due soon', () => {
      expect(getTaskDue(a('2026-11-01'), km(today)).state).toBe(DUE_STATE.SOON);
    });

    it('a task dated 2026-11-02 is 31 days ahead: no longer due soon', () => {
      expect(getTaskDue(a('2026-11-02'), km(today)).state).toBe(DUE_STATE.LATER);
    });

    it('insurance dated 2026-10-14 expires in 12 days', () => {
      const [signal] = getDocumentSignals(
        [document({ id: 'd', categoryId: 'cat-insurance', expiryDate: '2026-10-14' })],
        CATEGORIES,
        today,
      );
      expect(signal).toMatchObject({ expired: false, days: 12 });
    });

    it('insurance dated 2026-10-02 expires today: check, not "not ready"', () => {
      const result = getRideStatus({
        tasks: [],
        documents: [document({ id: 'd', categoryId: 'cat-insurance', expiryDate: '2026-10-02' })],
        categories: CATEGORIES,
        recalls: [],
        ...km(today),
      });
      expect(result.status).toBe(RIDE_STATUS.CHECK);
    });

    it('an overdue Critical task dated yesterday blocks riding', () => {
      const result = getRideStatus({
        tasks: [
          task({
            id: 'c',
            title: 'Brakes',
            priority: MaintenancePriority.Critical,
            dueDate: '2026-10-01',
          }),
        ],
        documents: [],
        categories: CATEGORIES,
        recalls: [],
        ...km(today),
      });
      expect(result.status).toBe(RIDE_STATUS.NOT_READY);
    });

    it('costs: an expense dated the 1st belongs to this month, the 30th of September does not', () => {
      const summary = summariseCosts({
        currentYearExpenses: expenseYear({
          fuel: [
            ['2026-10-01', 40],
            ['2026-09-30', 25],
          ],
        }),
        previousYearExpenses: null,
        today,
        fallbackCurrency: 'EUR',
      });
      expect(summary.thisMonth).toBe(40);
    });

    it('costs: last year’s expense dated Oct 2 is in the same period, Oct 3 is not', () => {
      const summary = summariseCosts({
        currentYearExpenses: expenseYear({ fuel: [['2026-01-01', 100]] }),
        previousYearExpenses: expenseYear({
          fuel: [
            ['2025-01-01', 10],
            ['2025-10-02', 20],
            ['2025-10-03', 400],
          ],
        }),
        today,
        fallbackCurrency: 'EUR',
      });
      expect(summary.total).toBe(100);
      expect(summary.samePeriodLastYear).toBe(30);
    });

    it('odometer: a reading dated today is not a future date', () => {
      const result = validateReading({
        value: 39_407,
        lastValue: 38_167,
        recordedAt: new Date(2026, 9, 2, 12),
        lastRecordedAt: new Date(2026, 8, 28, 12),
        today,
      });
      expect(result).toEqual({ ok: true, backdated: false });
    });
  });

  it('formats a date-only string on its own day and month', () => {
    expect(formatShortDate('2026-09-28', LOCALE)).toBe('Sep 28');
    expect(formatShortDate('2026-10-01', LOCALE)).toBe('Oct 1');
    expect(formatMonthYear('2022-06-01', LOCALE)).toBe('June 2022');
    expect(formatMonthYear('2027-01-01', LOCALE)).toBe('January 2027');
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
    const mobileRoot = path.resolve(__dirname, '../../../..');
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

  describe('date-only strings are local days in other time zones', () => {
    it.concurrent.each([
      ['a negative UTC offset', ZONES.NEGATIVE.name],
      ['a positive UTC offset', ZONES.POSITIVE.name],
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
