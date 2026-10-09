import {
  MaintenancePriority,
  MaintenanceTaskStatus,
  type MaintenanceTasksByMotorcycleQuery,
} from '@motovault/graphql';
import { filterAndSortTasks, parseTaskFilter, TASK_FILTER } from '../all-tasks';
import { HUB_UNIT } from '../constants';
import type { DueContext } from '../task-due';

type Task = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];

const TODAY = new Date('2026-10-09T12:00:00Z');
const ODOMETER = 12_400;
const CONTEXT: DueContext = { odometer: ODOMETER, today: TODAY, unit: HUB_UNIT.KM };
const PAST = '2026-09-01';
const SOON = '2026-10-20';
const LATER = '2026-12-01';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    status: MaintenanceTaskStatus.Pending,
    priority: MaintenancePriority.Medium,
    dueDate: null,
    targetMileage: null,
    ...overrides,
  } as Task;
}

const ids = (tasks: readonly Task[]) => tasks.map((item) => item.id);

describe('parseTaskFilter', () => {
  it('accepts the four filters and falls back to all', () => {
    expect(parseTaskFilter('overdue')).toBe(TASK_FILTER.OVERDUE);
    expect(parseTaskFilter('completed')).toBe(TASK_FILTER.COMPLETED);
    expect(parseTaskFilter('nonsense')).toBe(TASK_FILTER.ALL);
    expect(parseTaskFilter(undefined)).toBe(TASK_FILTER.ALL);
  });
});

describe('filterAndSortTasks', () => {
  const tasks: Task[] = [
    task('done', { status: MaintenanceTaskStatus.Completed, dueDate: PAST }),
    task('undated-low', { priority: MaintenancePriority.Low }),
    task('undated-critical', { priority: MaintenancePriority.Critical }),
    task('later', { dueDate: LATER }),
    task('soon', { dueDate: SOON, status: MaintenanceTaskStatus.InProgress }),
    task('late', { dueDate: PAST }),
  ];

  it('all: overdue first, then by date, undated by priority, completed last', () => {
    expect(ids(filterAndSortTasks(tasks, TASK_FILTER.ALL, CONTEXT))).toEqual([
      'late',
      'soon',
      'later',
      'undated-critical',
      'undated-low',
      'done',
    ]);
  });

  it('overdue: open tasks with a past due date', () => {
    expect(ids(filterAndSortTasks(tasks, TASK_FILTER.OVERDUE, CONTEXT))).toEqual(['late']);
  });

  it('upcoming: open tasks due now or later, or undated', () => {
    expect(ids(filterAndSortTasks(tasks, TASK_FILTER.UPCOMING, CONTEXT))).toEqual([
      'soon',
      'later',
      'undated-critical',
      'undated-low',
    ]);
  });

  it('completed: completed tasks only', () => {
    expect(ids(filterAndSortTasks(tasks, TASK_FILTER.COMPLETED, CONTEXT))).toEqual(['done']);
  });

  it('does not reorder the cached query array', () => {
    const before = ids(tasks);
    filterAndSortTasks(tasks, TASK_FILTER.ALL, CONTEXT);
    expect(ids(tasks)).toEqual(before);
  });

  describe('overdue is the hub rule: date passed OR odometer at the target', () => {
    const mixed: Task[] = [
      task('later', { dueDate: LATER }),
      task('undated-critical', { priority: MaintenancePriority.Critical }),
      // 400 km over, no date: was filed under Upcoming and sorted last among open work.
      task('km-over-undated', { targetMileage: 12_000 }),
      // 400 km over, date still ahead.
      task('km-over-dated', { targetMileage: 12_000, dueDate: SOON }),
      task('date-over', { dueDate: PAST }),
      // Same date as date-over: a tie keeps the query order.
      task('both-over', { dueDate: PAST, targetMileage: 11_000 }),
      task('km-ahead', { targetMileage: 20_000 }),
      task('done-km-over', { status: MaintenanceTaskStatus.Completed, targetMileage: 12_000 }),
    ];

    it('files mileage-overdue, date-overdue and both under Overdue, dated before undated', () => {
      expect(ids(filterAndSortTasks(mixed, TASK_FILTER.OVERDUE, CONTEXT))).toEqual([
        'date-over',
        'both-over',
        'km-over-dated',
        'km-over-undated',
      ]);
    });

    it('keeps them out of Upcoming', () => {
      expect(ids(filterAndSortTasks(mixed, TASK_FILTER.UPCOMING, CONTEXT))).toEqual([
        'later',
        'undated-critical',
        'km-ahead',
      ]);
    });

    it('sorts a mileage-overdue undated task ahead of every not-overdue task on all', () => {
      expect(ids(filterAndSortTasks(mixed, TASK_FILTER.ALL, CONTEXT))).toEqual([
        'date-over',
        'both-over',
        'km-over-dated',
        'km-over-undated',
        'later',
        'undated-critical',
        'km-ahead',
        'done-km-over',
      ]);
    });

    it('never counts a completed task as overdue', () => {
      expect(ids(filterAndSortTasks(mixed, TASK_FILTER.COMPLETED, CONTEXT))).toEqual([
        'done-km-over',
      ]);
    });

    it('treats a never-set odometer as not past any target', () => {
      const context: DueContext = { ...CONTEXT, odometer: null };
      expect(ids(filterAndSortTasks(mixed, TASK_FILTER.OVERDUE, context))).toEqual([
        'date-over',
        'both-over',
      ]);
    });

    it('does not count a task due today as overdue (the hub calendar-day rule)', () => {
      const dueToday = [task('today', { dueDate: '2026-10-09' })];
      expect(ids(filterAndSortTasks(dueToday, TASK_FILTER.OVERDUE, CONTEXT))).toEqual([]);
      expect(ids(filterAndSortTasks(dueToday, TASK_FILTER.UPCOMING, CONTEXT))).toEqual(['today']);
    });
  });

  it('orders undated tasks by priority, critical first', () => {
    const byPriority = [
      task('low', { priority: MaintenancePriority.Low }),
      task('high', { priority: MaintenancePriority.High }),
      task('critical', { priority: MaintenancePriority.Critical }),
      task('medium', { priority: MaintenancePriority.Medium }),
    ];
    expect(ids(filterAndSortTasks(byPriority, TASK_FILTER.ALL, CONTEXT))).toEqual([
      'critical',
      'high',
      'medium',
      'low',
    ]);
  });
});
