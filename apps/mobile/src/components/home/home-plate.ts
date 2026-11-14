/**
 * Home's bike plate: which task the plate counts down to, and the plate's copy.
 * Pure — no React. Distances are the rider's raw odometer values; `unit` is a
 * label and a threshold only, nothing is converted.
 */

import { MaintenanceTaskSource } from '@motovault/graphql';
import type { TFunction } from 'i18next';
import {
  DUE_DIMENSION,
  DUE_DIRECTION,
  DUE_DISPLAY,
  DUE_STATE,
  type DueState,
  type HubUnit,
} from '../../lib/bike-hub/constants';
import { formatOdometer, hasOdometer } from '../../lib/bike-hub/format';
import {
  dueUrgency,
  getTaskDue,
  isActiveTask,
  isDueNow,
  type TaskDue,
} from '../../lib/bike-hub/task-due';
import { PLATE_STATE, type PlateState } from '../ui/bike-plate';
import type { TaskItem } from './home-types';

export interface RankedHomeTask {
  task: TaskItem;
  due: TaskDue;
}

/** A task without a `source` (an older cache entry) counts as the rider's own. */
const SOURCE_FALLBACK = MaintenanceTaskSource.User;

/** Shown in place of the figure when the bike has no odometer yet. */
const NO_FIGURE = '—';

const PLATE_STATE_OF: Record<DueState, PlateState> = {
  [DUE_STATE.OVERDUE]: PLATE_STATE.OVERDUE,
  [DUE_STATE.SOON]: PLATE_STATE.DUE,
  [DUE_STATE.LATER]: PLATE_STATE.READY,
  [DUE_STATE.SOMEDAY]: PLATE_STATE.READY,
};

const STATE_LABEL_KEY = {
  [PLATE_STATE.READY]: 'home.readyToRideBadge',
  [PLATE_STATE.DUE]: 'home.plateStateDue',
  [PLATE_STATE.OVERDUE]: 'home.plateStateOverdue',
} as const satisfies Record<PlateState, string>;

interface RankContext {
  bikeId: string;
  /** The bike's odometer, RAW in the rider's unit. */
  odometer: number | null | undefined;
  unit: HubUnit;
  today: Date;
}

/** The bike's open tasks that have a date or target odometer, most urgent first. */
export function rankBikeTasks(tasks: readonly TaskItem[], context: RankContext): RankedHomeTask[] {
  const { bikeId, odometer, unit, today } = context;
  return tasks
    .filter((task) => task.motorcycleId === bikeId && isActiveTask(task))
    .map((task) => ({
      task,
      due: getTaskDue(
        {
          dueDate: task.dueDate,
          targetMileage: task.targetMileage,
          source: task.source ?? SOURCE_FALLBACK,
        },
        { odometer, today, unit },
      ),
    }))
    .filter(({ due }) => due.state !== DUE_STATE.SOMEDAY)
    .sort((a, b) => dueUrgency(a.due, unit) - dueUrgency(b.due, unit));
}

export interface PlateCopy {
  state: PlateState;
  figure: string;
  unit?: string;
  caption: string;
  stateLabel: string;
}

interface CopyContext {
  t: TFunction;
  language: string;
  unit: HubUnit;
  odometer: number | null | undefined;
}

/**
 * The plate for the bike's most urgent task, or — with nothing due — a ready
 * plate showing the odometer.
 */
export function describePlate(next: RankedHomeTask | undefined, context: CopyContext): PlateCopy {
  const { t, language, unit, odometer } = context;
  const limit = next?.due.primary;

  if (!next || !limit) {
    return {
      state: PLATE_STATE.READY,
      figure: hasOdometer(odometer) ? formatOdometer(odometer, language) : NO_FIGURE,
      unit: hasOdometer(odometer) ? unit : undefined,
      caption: t('home.noServiceDue'),
      stateLabel: t(STATE_LABEL_KEY[PLATE_STATE.READY]),
    };
  }

  const state = PLATE_STATE_OF[next.due.state];
  const task = next.task.title;

  // A passed schedule task: no count of days, the plate keeps the odometer.
  if (isDueNow(next.due)) {
    return {
      state,
      figure: hasOdometer(odometer) ? formatOdometer(odometer, language) : NO_FIGURE,
      unit: hasOdometer(odometer) ? unit : undefined,
      caption: t('home.plateCaptionDueNow', { task }),
      stateLabel: t(STATE_LABEL_KEY[state]),
    };
  }
  const isTime = limit.dimension === DUE_DIMENSION.TIME;
  const caption =
    limit.direction === DUE_DIRECTION.PAST
      ? t('home.plateCaptionLate', { task })
      : limit.display === DUE_DISPLAY.ABSOLUTE
        ? t('home.plateCaptionAt', { task })
        : t('home.plateCaptionTo', { task });

  return {
    state,
    figure: isTime ? String(limit.amount) : formatOdometer(limit.amount, language),
    unit: isTime ? t('home.plateDayUnit', { count: limit.amount }) : unit,
    caption,
    stateLabel: t(STATE_LABEL_KEY[state]),
  };
}
