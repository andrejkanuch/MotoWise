import type { AllMaintenanceTasksQuery } from '@motovault/graphql';
import { daysUntil } from '../../utils/days-until';

export type BadgeTask = Pick<
  AllMaintenanceTasksQuery['allMaintenanceTasks'][number],
  'dueDate' | 'priority'
>;

/** Critical and high tasks due within this many calendar days count. */
const URGENT_WITHIN_DAYS = 3;

/**
 * How many tasks the Garage tab badge shows: every overdue task, plus critical
 * and high tasks due within three days. Undated tasks never count. Days are
 * calendar days in the rider's time zone, so a task due today is not overdue
 * at any hour or in any zone.
 */
export function countGarageBadge(tasks: readonly BadgeTask[], now: Date): number {
  let count = 0;
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const days = daysUntil(task.dueDate, now);
    // Overdue tasks
    if (days < 0) {
      count++;
    }
    // Critical/high due within 3 days
    else if (
      days <= URGENT_WITHIN_DAYS &&
      (task.priority === 'critical' || task.priority === 'high')
    ) {
      count++;
    }
  }
  return count;
}
