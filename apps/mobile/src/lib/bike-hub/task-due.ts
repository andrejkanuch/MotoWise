import {
  type MaintenancePriority,
  MaintenanceTaskSource,
  MaintenanceTaskStatus,
  type MaintenanceTasksByMotorcycleQuery,
} from '@motovault/graphql';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import {
  DUE_DAY_PRECISION_DAYS,
  DUE_DIMENSION,
  DUE_DIRECTION,
  DUE_DISPLAY,
  DUE_SOON_DAYS,
  DUE_SOON_DISTANCE,
  DUE_STATE,
  DUE_TONE,
  type DueDimension,
  type DueDirection,
  type DueDisplay,
  type DueState,
  type DueTone,
  type HubUnit,
} from './constants';
import { hasOdometer } from './format';

type Task = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];

export type TaskDueInput = Pick<Task, 'dueDate' | 'targetMileage' | 'source'>;

export interface DueContext {
  /** The bike's current odometer, RAW in the bike's unit. `null` when never set. */
  odometer: number | null | undefined;
  today: Date;
  /** Picks the due-soon threshold and the label. Values are never converted. */
  unit: HubUnit;
}

/** One limit of a task (its date or its target odometer) relative to now. */
export interface DueLimit {
  dimension: DueDimension;
  direction: DueDirection;
  /** Days or distance, always ≥ 0. For `ABSOLUTE` the target odometer itself. */
  amount: number;
  display: DueDisplay;
  /** The task's due date (ISO) for time limits, else `null`. */
  date: string | null;
}

export interface TaskDue {
  state: DueState;
  /** The limit the due line leads with; `null` only for `SOMEDAY`. */
  primary: DueLimit | null;
  secondary: DueLimit | null;
  tone: DueTone;
  /** True when the task comes from the manufacturer schedule ("Honda schedule"). */
  fromSchedule: boolean;
}

const PRIORITY_RANK: Record<MaintenancePriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const ACTIVE_STATUSES: readonly MaintenanceTaskStatus[] = [
  MaintenanceTaskStatus.Pending,
  MaintenanceTaskStatus.InProgress,
];

function timeDisplay(days: number): DueDisplay {
  if (days <= DUE_SOON_DAYS) return DUE_DISPLAY.RELATIVE;
  if (days <= DUE_DAY_PRECISION_DAYS) return DUE_DISPLAY.DAY;
  return DUE_DISPLAY.MONTH;
}

function timeLimit(dueDate: string | null | undefined, today: Date): DueLimit | null {
  if (!dueDate) return null;
  const days = differenceInCalendarDays(parseISO(dueDate), today);
  if (Number.isNaN(days)) return null;
  // A task due today has not passed yet.
  if (days < 0) {
    return {
      dimension: DUE_DIMENSION.TIME,
      direction: DUE_DIRECTION.PAST,
      amount: -days,
      display: DUE_DISPLAY.RELATIVE,
      date: dueDate,
    };
  }
  return {
    dimension: DUE_DIMENSION.TIME,
    direction: DUE_DIRECTION.AHEAD,
    amount: days,
    display: timeDisplay(days),
    date: dueDate,
  };
}

function distanceLimit(
  targetMileage: number | null | undefined,
  odometer: number | null | undefined,
): DueLimit | null {
  if (targetMileage == null) return null;
  // A never-set odometer (null or the 0 a new bike starts at) gives no distance
  // to go: show the target itself ("at 40,000 km"), not "in 40,000 km".
  if (!hasOdometer(odometer)) {
    return {
      dimension: DUE_DIMENSION.DISTANCE,
      direction: DUE_DIRECTION.AHEAD,
      amount: targetMileage,
      display: DUE_DISPLAY.ABSOLUTE,
      date: null,
    };
  }
  const remaining = targetMileage - odometer;
  return {
    dimension: DUE_DIMENSION.DISTANCE,
    direction: remaining <= 0 ? DUE_DIRECTION.PAST : DUE_DIRECTION.AHEAD,
    amount: Math.abs(remaining),
    display: DUE_DISPLAY.RELATIVE,
    date: null,
  };
}

/**
 * A limit's distance from now in "due-soon windows": 1 = exactly at the edge of
 * the window (30 days ≙ 2,000 km / 1,200 mi). This is how a date and a distance
 * are compared (plan Open question 15). Negative when passed; an `ABSOLUTE`
 * limit cannot be placed and sorts last.
 */
function windows(limit: DueLimit, unit: HubUnit): number {
  if (limit.display === DUE_DISPLAY.ABSOLUTE) return Number.POSITIVE_INFINITY;
  const size = limit.dimension === DUE_DIMENSION.TIME ? DUE_SOON_DAYS : DUE_SOON_DISTANCE[unit];
  const ratio = limit.amount / size;
  return limit.direction === DUE_DIRECTION.PAST ? -ratio : ratio;
}

function isPast(limit: DueLimit | null): limit is DueLimit {
  return limit?.direction === DUE_DIRECTION.PAST;
}

/** Orders the two limits: a passed limit leads (date before distance), else the closer one, ties to time. */
function orderLimits(
  time: DueLimit | null,
  distance: DueLimit | null,
  unit: HubUnit,
): [DueLimit | null, DueLimit | null] {
  if (!time || !distance) return [time ?? distance, null];
  if (isPast(time)) return [time, distance];
  if (isPast(distance)) return [distance, time];
  return windows(distance, unit) < windows(time, unit) ? [distance, time] : [time, distance];
}

/**
 * Where a task stands against its date and its target odometer.
 *
 * Overdue when the date has passed OR the odometer has reached the target. The
 * tone follows the leading limit: late when anything has passed, soon inside the
 * due-soon window, otherwise plain. Nothing is converted — `unit` only selects
 * the threshold.
 */
export function getTaskDue(task: TaskDueInput, context: DueContext): TaskDue {
  const { odometer, today, unit } = context;
  const fromSchedule = task.source === MaintenanceTaskSource.Oem;
  const [primary, secondary] = orderLimits(
    timeLimit(task.dueDate, today),
    distanceLimit(task.targetMileage, odometer),
    unit,
  );

  if (!primary) {
    return {
      state: DUE_STATE.SOMEDAY,
      primary: null,
      secondary: null,
      tone: DUE_TONE.PLAIN,
      fromSchedule,
    };
  }
  if (isPast(primary) || isPast(secondary)) {
    return { state: DUE_STATE.OVERDUE, primary, secondary, tone: DUE_TONE.LATE, fromSchedule };
  }
  if (windows(primary, unit) <= 1) {
    return { state: DUE_STATE.SOON, primary, secondary, tone: DUE_TONE.SOON, fromSchedule };
  }
  return { state: DUE_STATE.LATER, primary, secondary, tone: DUE_TONE.PLAIN, fromSchedule };
}

/** Pending or in progress — the tasks that can be due. */
export function isActiveTask(task: Pick<Task, 'status'>): boolean {
  return ACTIVE_STATUSES.includes(task.status);
}

/**
 * Sort key for "nearest due": the most overdue limit first, then the closest
 * upcoming one; undated tasks last.
 */
export function dueUrgency(due: TaskDue, unit: HubUnit): number {
  const limits = [due.primary, due.secondary].filter((limit): limit is DueLimit => limit !== null);
  if (limits.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...limits.map((limit) => windows(limit, unit)));
}

export interface RankedTask<T extends Pick<Task, 'priority'>> {
  task: T;
  due: TaskDue;
}

/** Priority descending, then nearest due (spec §2 "Sort within a group"). */
export function compareTasksForAttention<T extends Pick<Task, 'priority'>>(
  a: RankedTask<T>,
  b: RankedTask<T>,
  unit: HubUnit,
): number {
  const byPriority = PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
  if (byPriority !== 0) return byPriority;
  return dueUrgency(a.due, unit) - dueUrgency(b.due, unit);
}

/** Priority descending — for listing the priorities an overflow row covers. */
export function comparePriority(a: MaintenancePriority, b: MaintenancePriority): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b];
}
