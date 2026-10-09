import {
  MaintenancePriority,
  MaintenanceTaskStatus,
  type MaintenanceTasksByMotorcycleQuery,
} from '@motovault/graphql';
import { filterAndSortTasks, parseTaskFilter, TASK_FILTER } from '../all-tasks';

type Task = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];

const NOW = new Date('2026-10-09T12:00:00Z').getTime();
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
    expect(ids(filterAndSortTasks(tasks, TASK_FILTER.ALL, NOW))).toEqual([
      'late',
      'soon',
      'later',
      'undated-critical',
      'undated-low',
      'done',
    ]);
  });

  it('overdue: open tasks with a past due date only', () => {
    expect(ids(filterAndSortTasks(tasks, TASK_FILTER.OVERDUE, NOW))).toEqual(['late']);
  });

  it('upcoming: open tasks due now or later, or undated', () => {
    expect(ids(filterAndSortTasks(tasks, TASK_FILTER.UPCOMING, NOW))).toEqual([
      'soon',
      'later',
      'undated-critical',
      'undated-low',
    ]);
  });

  it('completed: completed tasks only', () => {
    expect(ids(filterAndSortTasks(tasks, TASK_FILTER.COMPLETED, NOW))).toEqual(['done']);
  });

  it('does not reorder the cached query array', () => {
    const before = ids(tasks);
    filterAndSortTasks(tasks, TASK_FILTER.ALL, NOW);
    expect(ids(tasks)).toEqual(before);
  });
});
