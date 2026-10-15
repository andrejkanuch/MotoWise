import type { MaintenanceTasksByMotorcycleQuery } from '@motovault/graphql';
import { daysUntil } from '../../utils/days-until';

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

/** Within this many calendar days an upcoming task is a warning, not ok. */
const WARN_WITHIN_DAYS = 7;

export type PreFlightBikeStatus =
  | { kind: typeof PRE_FLIGHT_BIKE_STATUS.NO_BIKE; level: 'na' }
  | { kind: typeof PRE_FLIGHT_BIKE_STATUS.NO_TASKS; level: 'na' }
  | { kind: typeof PRE_FLIGHT_BIKE_STATUS.OVERDUE; level: 'warn'; task: string }
  | { kind: typeof PRE_FLIGHT_BIKE_STATUS.DUE_IN; level: 'ok' | 'warn'; task: string; days: number }
  | { kind: typeof PRE_FLIGHT_BIKE_STATUS.ALL_CLEAR; level: 'ok' };

/**
 * The bike row of the pre-ride checklist: the first overdue task, else the
 * first upcoming one with its day count, else all clear. Days are calendar
 * days in the rider's time zone: overdue means the due date has passed, so a
 * task due today is "due in 0d", not overdue. Tasks are read in the order given.
 */
export function getPreFlightBikeStatus(
  motorcycleId: string | null | undefined,
  tasks: readonly PreFlightTask[],
  now: Date,
): PreFlightBikeStatus {
  if (!motorcycleId) return { kind: PRE_FLIGHT_BIKE_STATUS.NO_BIKE, level: 'na' };
  if (tasks.length === 0) return { kind: PRE_FLIGHT_BIKE_STATUS.NO_TASKS, level: 'na' };

  const dated = tasks.flatMap((task) =>
    task.status !== 'completed' && task.dueDate
      ? [{ title: task.title, days: daysUntil(task.dueDate, now) }]
      : [],
  );

  const overdue = dated.find(({ days }) => days < 0);
  if (overdue) {
    return { kind: PRE_FLIGHT_BIKE_STATUS.OVERDUE, level: 'warn', task: overdue.title };
  }

  const upcoming = dated.find(({ days }) => days >= 0);
  if (upcoming) {
    return {
      kind: PRE_FLIGHT_BIKE_STATUS.DUE_IN,
      level: upcoming.days <= WARN_WITHIN_DAYS ? 'warn' : 'ok',
      task: upcoming.title,
      days: upcoming.days,
    };
  }

  return { kind: PRE_FLIGHT_BIKE_STATUS.ALL_CLEAR, level: 'ok' };
}
