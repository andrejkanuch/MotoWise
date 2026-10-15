import type { AllMaintenanceTasksQuery } from '@motovault/graphql';

export type BadgeTask = Pick<
  AllMaintenanceTasksQuery['allMaintenanceTasks'][number],
  'dueDate' | 'priority'
>;

/**
 * How many tasks the Garage tab badge shows: every overdue task, plus critical
 * and high tasks due within three days. Undated tasks never count.
 */
export function countGarageBadge(tasks: readonly BadgeTask[], now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let count = 0;
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const due = new Date(task.dueDate);
    const daysUntil = Math.floor((due.getTime() - today.getTime()) / 86400000);
    // Overdue tasks
    if (daysUntil < 0) {
      count++;
    }
    // Critical/high due within 3 days
    else if (daysUntil <= 3 && (task.priority === 'critical' || task.priority === 'high')) {
      count++;
    }
  }
  return count;
}
