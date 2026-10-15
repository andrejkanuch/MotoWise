import type { MaintenanceTasksByMotorcycleQuery } from '@motovault/graphql';

export type PreFlightTask = Pick<
  MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number],
  'title' | 'dueDate' | 'status'
>;

export const PRE_FLIGHT_BIKE_STATUS = {
  NO_BIKE: 'noBike',
  NO_TASKS: 'noTasks',
  OVERDUE: 'overdue',
  DUE_IN: 'dueIn',
  ALL_CLEAR: 'allClear',
} as const;

export type ChecklistLevel = 'ok' | 'warn' | 'na';

/** Within this many days an upcoming task is a warning, not ok. */
const WARN_WITHIN_DAYS = 7;

export type PreFlightBikeStatus =
  | { kind: typeof PRE_FLIGHT_BIKE_STATUS.NO_BIKE; level: 'na' }
  | { kind: typeof PRE_FLIGHT_BIKE_STATUS.NO_TASKS; level: 'na' }
  | { kind: typeof PRE_FLIGHT_BIKE_STATUS.OVERDUE; level: 'warn'; task: string }
  | { kind: typeof PRE_FLIGHT_BIKE_STATUS.DUE_IN; level: 'ok' | 'warn'; task: string; days: number }
  | { kind: typeof PRE_FLIGHT_BIKE_STATUS.ALL_CLEAR; level: 'ok' };

/**
 * The bike row of the pre-ride checklist: the first overdue task, else the
 * first upcoming one with its day count, else all clear. Tasks are read in the
 * order given.
 */
export function getPreFlightBikeStatus(
  motorcycleId: string | null | undefined,
  tasks: readonly PreFlightTask[],
  now: Date,
): PreFlightBikeStatus {
  if (!motorcycleId) return { kind: PRE_FLIGHT_BIKE_STATUS.NO_BIKE, level: 'na' };
  if (tasks.length === 0) return { kind: PRE_FLIGHT_BIKE_STATUS.NO_TASKS, level: 'na' };

  const overdue = tasks.filter(
    (task) => task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < now,
  );
  const upcoming = tasks.filter(
    (task) => task.status !== 'completed' && task.dueDate && new Date(task.dueDate) >= now,
  );

  if (overdue.length > 0) {
    const first = overdue[0];
    return { kind: PRE_FLIGHT_BIKE_STATUS.OVERDUE, level: 'warn', task: first.title };
  }

  if (upcoming.length > 0) {
    const first = upcoming[0];
    // dueDate is guaranteed non-null by the `upcoming` filter above.
    const daysUntil = Math.ceil(
      (new Date(first.dueDate ?? now).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      kind: PRE_FLIGHT_BIKE_STATUS.DUE_IN,
      level: daysUntil <= WARN_WITHIN_DAYS ? 'warn' : 'ok',
      task: first.title,
      days: daysUntil,
    };
  }

  return { kind: PRE_FLIGHT_BIKE_STATUS.ALL_CLEAR, level: 'ok' };
}
