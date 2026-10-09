import { MaintenanceTaskStatus } from '@motovault/graphql';
import { DUE_STATE } from './constants';
import {
  comparePriority,
  type DueContext,
  getTaskDue,
  type HubTask,
  isActiveTask,
} from './task-due';

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

function dueTime(task: HubTask): number | null {
  return task.dueDate ? new Date(task.dueDate).getTime() : null;
}

/**
 * The hub's one meaning of overdue (`countOverdueTasks`, the row tone): an open
 * task whose date has passed OR whose target odometer has been reached.
 */
function isOverdue(task: HubTask, context: DueContext): boolean {
  return isActiveTask(task) && getTaskDue(task, context).state === DUE_STATE.OVERDUE;
}

const MATCHES: Record<TaskFilter, (task: HubTask, overdue: boolean) => boolean> = {
  [TASK_FILTER.ALL]: () => true,
  [TASK_FILTER.OVERDUE]: (_task, overdue) => overdue,
  [TASK_FILTER.UPCOMING]: (task, overdue) => isActiveTask(task) && !overdue,
  [TASK_FILTER.COMPLETED]: (task) => task.status === MaintenanceTaskStatus.Completed,
};

/**
 * The tasks a filter shows, in list order: on `all` completed work sinks to the
 * bottom; then overdue first, then nearest due date, undated after dated, then
 * priority (critical first). Overdue is the hub's rule (`getTaskDue`: date
 * passed OR odometer at the target), so a row that reads "400 km over" sits
 * under Overdue and leads the list, the same as Overview and the Service badge
 * count it. Never mutates `tasks`.
 */
export function filterAndSortTasks(
  tasks: readonly HubTask[],
  filter: TaskFilter,
  context: DueContext,
): HubTask[] {
  const matches = MATCHES[filter];
  const overdueIds = new Set(
    tasks.filter((task) => isOverdue(task, context)).map((task) => task.id),
  );
  return tasks
    .filter((task) => matches(task, overdueIds.has(task.id)))
    .sort((a, b) => {
      if (filter === TASK_FILTER.ALL) {
        const aCompleted = a.status === MaintenanceTaskStatus.Completed;
        const bCompleted = b.status === MaintenanceTaskStatus.Completed;
        if (aCompleted && !bCompleted) return 1;
        if (!aCompleted && bCompleted) return -1;
      }

      const aOverdue = overdueIds.has(a.id);
      const bOverdue = overdueIds.has(b.id);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      const aDue = dueTime(a);
      const bDue = dueTime(b);
      if (aDue !== null && bDue !== null) return aDue - bDue;
      if (aDue !== null) return -1;
      if (bDue !== null) return 1;

      return comparePriority(a.priority, b.priority);
    });
}
