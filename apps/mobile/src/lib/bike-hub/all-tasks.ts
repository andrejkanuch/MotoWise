import { MaintenanceTaskStatus, type MaintenanceTasksByMotorcycleQuery } from '@motovault/graphql';

type HubTask = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];

/** The All Tasks screen's filters, in segment order. */
export const TASK_FILTER = {
  ALL: 'all',
  OVERDUE: 'overdue',
  UPCOMING: 'upcoming',
  COMPLETED: 'completed',
} as const;
export type TaskFilter = (typeof TASK_FILTER)[keyof typeof TASK_FILTER];

export const TASK_FILTERS: readonly TaskFilter[] = [
  TASK_FILTER.ALL,
  TASK_FILTER.OVERDUE,
  TASK_FILTER.UPCOMING,
  TASK_FILTER.COMPLETED,
];

/** A deep-link `initialFilter` param, or `all` when it is missing or unknown. */
export function parseTaskFilter(value: string | undefined): TaskFilter {
  return TASK_FILTERS.find((filter) => filter === value) ?? TASK_FILTER.ALL;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const UNKNOWN_PRIORITY = 99;

function isOpen(task: HubTask): boolean {
  return (
    task.status === MaintenanceTaskStatus.Pending ||
    task.status === MaintenanceTaskStatus.InProgress
  );
}

function dueTime(task: HubTask): number | null {
  return task.dueDate ? new Date(task.dueDate).getTime() : null;
}

const MATCHES: Record<TaskFilter, (task: HubTask, now: number) => boolean> = {
  [TASK_FILTER.ALL]: () => true,
  [TASK_FILTER.OVERDUE]: (task, now) => {
    const due = dueTime(task);
    return isOpen(task) && due !== null && due < now;
  },
  [TASK_FILTER.UPCOMING]: (task, now) => {
    const due = dueTime(task);
    return isOpen(task) && (due === null || due >= now);
  },
  [TASK_FILTER.COMPLETED]: (task) => task.status === MaintenanceTaskStatus.Completed,
};

/**
 * The tasks a filter shows, in list order: on `all` completed work sinks to the
 * bottom; then date-overdue first, then nearest due date, undated after dated,
 * then priority. Overdue here means a past due date only (the filter's rule),
 * not the hub's date-or-odometer due state. Never mutates `tasks`.
 */
export function filterAndSortTasks(
  tasks: readonly HubTask[],
  filter: TaskFilter,
  now: number,
): HubTask[] {
  const matches = MATCHES[filter];
  return tasks
    .filter((task) => matches(task, now))
    .sort((a, b) => {
      if (filter === TASK_FILTER.ALL) {
        const aCompleted = a.status === MaintenanceTaskStatus.Completed;
        const bCompleted = b.status === MaintenanceTaskStatus.Completed;
        if (aCompleted && !bCompleted) return 1;
        if (!aCompleted && bCompleted) return -1;
      }

      const aDue = dueTime(a);
      const bDue = dueTime(b);
      const aOverdue = aDue !== null && aDue < now;
      const bOverdue = bDue !== null && bDue < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      if (aDue !== null && bDue !== null) return aDue - bDue;
      if (aDue !== null) return -1;
      if (bDue !== null) return 1;

      return (
        (PRIORITY_ORDER[a.priority] ?? UNKNOWN_PRIORITY) -
        (PRIORITY_ORDER[b.priority] ?? UNKNOWN_PRIORITY)
      );
    });
}
