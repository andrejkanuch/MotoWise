/**
 * Where a maintenance task was marked done, on `maintenance_task_completed`.
 * The notification "Mark done" action completed tasks without reporting them,
 * so completions from a reminder were invisible in PostHog.
 */
export const MAINTENANCE_COMPLETION_SURFACE = {
  COMPLETE_TASK_SCREEN: 'complete_task_screen',
  REMINDER_NOTIFICATION: 'reminder_notification',
} as const;
