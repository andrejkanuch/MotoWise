/**
 * Every "days until" figure in the app must be the same calendar count in
 * every time zone and at every hour: a task due today is 0 days away at 00:30
 * in Bogotá and at 23:30 in Johannesburg alike.
 *
 * A time zone cannot be switched inside a running jest worker (its
 * `process.env` is a copy, so assigning `TZ` never reaches the runtime). The
 * cases below therefore run three times: once in the zone of the machine, and
 * once each in a child jest started in a fixed UTC+2 and a fixed UTC−5 zone.
 * Neither zone observes daylight saving, so the offset is the same all year.
 * Children run one at a time. Mirrors `lib/bike-hub/__tests__/date-only-timezone.test.ts`.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { MaintenancePriority } from '@motovault/graphql';
import { countGarageBadge } from '@/components/garage/garage-badge-count';
import { computeHealthScore, getRelativeDueDate } from '@/lib/health-score';
import { daysUntil } from '@/utils/days-until';

const CHILD_ZONE_ENV = 'DAYS_UNTIL_TZ_CHILD';
const CHILD_TIMEOUT_MS = 120_000;

/** Minutes behind (+) or ahead (−) of UTC that `getTimezoneOffset` must report on 2026-10-02. */
const ZONES = {
  EAST: { name: 'Africa/Johannesburg', offsetMinutes: -120 },
  WEST: { name: 'America/Bogota', offsetMinutes: 300 },
} as const;

const childZone = process.env[CHILD_ZONE_ENV];
const isChild = childZone !== undefined;

/** The rider's day, 2026-10-02, at the two moments where UTC and local dates differ most. */
const MOMENTS_OF_OCT_2: Array<[label: string, now: Date]> = [
  ['00:30', new Date(2026, 9, 2, 0, 30)],
  ['23:30', new Date(2026, 9, 2, 23, 30)],
];

/** Date-only strings as `due_date` arrives from the API. */
const DUE = {
  TODAY: '2026-10-02',
  TOMORROW: '2026-10-03',
  YESTERDAY: '2026-10-01',
} as const;

describe(`calendar days until a date (${childZone ?? 'machine zone'})`, () => {
  describe.each(MOMENTS_OF_OCT_2)('today is 2026-10-02 at %s', (_label, now) => {
    it('daysUntil: today 0, tomorrow 1, yesterday −1', () => {
      expect(daysUntil(DUE.TODAY, now)).toBe(0);
      expect(daysUntil(DUE.TOMORROW, now)).toBe(1);
      expect(daysUntil(DUE.YESTERDAY, now)).toBe(-1);
    });

    it('Garage badge: due today counts only when critical or high, yesterday always', () => {
      const badge = (priority: MaintenancePriority, dueDate: string) =>
        countGarageBadge([{ priority, dueDate }], now);
      expect(badge(MaintenancePriority.Medium, DUE.TODAY)).toBe(0);
      expect(badge(MaintenancePriority.Critical, DUE.TODAY)).toBe(1);
      expect(badge(MaintenancePriority.High, DUE.TOMORROW)).toBe(1);
      expect(badge(MaintenancePriority.Low, DUE.TOMORROW)).toBe(0);
      expect(badge(MaintenancePriority.Low, DUE.YESTERDAY)).toBe(1);
    });

    it('Garage badge: a critical task due in 3 days counts, in 4 days it does not', () => {
      const badge = (dueDate: string) =>
        countGarageBadge([{ priority: MaintenancePriority.Critical, dueDate }], now);
      expect(badge('2026-10-05')).toBe(1);
      expect(badge('2026-10-06')).toBe(0);
    });

    // Sites that read the clock themselves run with it set to `now`.
    describe('with the clock set', () => {
      beforeEach(() => {
        jest.useFakeTimers({ now });
      });
      afterEach(() => {
        jest.useRealTimers();
      });

      it('CarPlay getRelativeDueDate: due today, due tomorrow, 1d overdue', () => {
        expect(getRelativeDueDate(DUE.TODAY)).toEqual({
          key: 'maintenance.dueToday',
          isOverdue: false,
          daysAway: 0,
        });
        expect(getRelativeDueDate(DUE.TOMORROW)).toEqual({
          key: 'maintenance.dueTomorrow',
          isOverdue: false,
          daysAway: 1,
        });
        expect(getRelativeDueDate(DUE.YESTERDAY)).toEqual({
          key: 'maintenance.overdueByDays',
          params: { count: 1 },
          isOverdue: true,
          daysAway: -1,
        });
      });

      it('health score: today and tomorrow are urgent, not overdue; yesterday is overdue, not urgent', () => {
        const scoreOne = (dueDate: string) =>
          computeHealthScore([{ status: 'pending', priority: 'medium', dueDate }]);
        expect(scoreOne(DUE.TODAY)).toMatchObject({ overdueTasks: 0, urgentTasks: 1 });
        expect(scoreOne(DUE.TOMORROW)).toMatchObject({ overdueTasks: 0, urgentTasks: 1 });
        expect(scoreOne(DUE.YESTERDAY)).toMatchObject({ overdueTasks: 1, urgentTasks: 0 });
      });
    });
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
    const mobileRoot = path.resolve(__dirname, '../..');
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

  describe('the same counts in other time zones', () => {
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
