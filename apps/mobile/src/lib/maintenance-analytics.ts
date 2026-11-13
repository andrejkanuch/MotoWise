/**
 * Where a maintenance task was marked done, on `maintenance_task_completed`.
 * The notification "Mark done" action completed tasks without reporting them,
 * so completions from a reminder were invisible in PostHog.
 */
export const MAINTENANCE_COMPLETION_SURFACE = {
  COMPLETE_TASK_SCREEN: 'complete_task_screen',
  REMINDER_NOTIFICATION: 'reminder_notification',
} as const;

/**
 * `source` on `maintenance_task_completed` (issue 365 T05d), in the board's
 * vocabulary (board/05 P05.2): completions a future Home plate sheet writes
 * (`plate_sheet`, added with it) are read apart from the ones the rider logs.
 */
export const MAINTENANCE_COMPLETION_SOURCE = {
  TASK_SCREEN: 'task_screen',
  OTHER: 'other',
} as const;

/** `surface` + `source` of each place that completes a task, spread into the event. */
export const MAINTENANCE_COMPLETION = {
  COMPLETE_TASK_SCREEN: {
    surface: MAINTENANCE_COMPLETION_SURFACE.COMPLETE_TASK_SCREEN,
    source: MAINTENANCE_COMPLETION_SOURCE.TASK_SCREEN,
  },
  REMINDER_NOTIFICATION: {
    surface: MAINTENANCE_COMPLETION_SURFACE.REMINDER_NOTIFICATION,
    source: MAINTENANCE_COMPLETION_SOURCE.OTHER,
  },
} as const;

/** `context` on `oem_schedule_imported`: where the import was started. */
export const OEM_IMPORT_CONTEXT = {
  ONBOARDING: 'onboarding',
  BIKE_HUB: 'bike_hub',
} as const;
