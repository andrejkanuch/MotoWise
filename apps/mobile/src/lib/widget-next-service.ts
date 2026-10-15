import type { AllMaintenanceTasksQuery } from '@motovault/graphql';
import { daysUntil as calendarDaysUntil } from '../utils/days-until';

export type NextServiceTask = Pick<
  AllMaintenanceTasksQuery['allMaintenanceTasks'][number],
  'dueDate' | 'status' | 'completedAt'
>;

export interface NextService<T extends NextServiceTask> {
  task: T;
  /** Whole calendar days until the due date; `null` when the task has no date (mileage target only). */
  daysUntil: number | null;
  isOverdue: boolean;
}

/**
 * The task the Next Service widget shows: the earliest dated task that is not
 * completed, with its day count in calendar days in the rider's time zone, so
 * the count does not change with the hour. Undated tasks sort last; `null`
 * when nothing is pending.
 */
export function pickWidgetNextService<T extends NextServiceTask>(
  tasks: readonly T[],
  now: Date,
): NextService<T> | null {
  const pending = tasks
    .filter((t) => t.status !== 'completed' && !t.completedAt)
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const next = pending[0];
  if (!next) return null;

  const daysUntil = next.dueDate ? calendarDaysUntil(next.dueDate, now) : null;
  const isOverdue = daysUntil !== null && daysUntil < 0;
  return { task: next, daysUntil, isOverdue };
}
