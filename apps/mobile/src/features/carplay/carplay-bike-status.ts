// Pure builder for the CarPlay Bike-status list. No React, no native, no store —
// just (active bike + tasks + ride motion + units) → a CPListModel.
// Keeps the row hierarchy and copy testable in isolation.
//
// Head-unit strings are hardcoded English to match the rest of the CarPlay surface
// (carplay-templates.ts is the same). Localizing all CarPlay head-unit copy is one
// deferred cleanup, not split across features (see the U8 plan, U4).

import { type MeasurementSystem, mileageUnitLabel } from '@motovault/types';
import type { CPListModel, CPListRow } from '../../../modules/carplay/src';
import { getRelativeDueDate } from '../../lib/health-score';

export const BIKE_LABEL = {
  title: 'Bike',
  nextService: 'Next service',
  mileage: 'Mileage',
  recalls: 'Recalls',
  stopToRefresh: 'Stop to refresh',
  noBike: 'No bike set',
  noRecalls: 'None',
  loadError: "Couldn't load",
  loadErrorDetail: 'Reopen to retry',
} as const;

const DASH = '—';
// Only pending / in-progress tasks are candidates for "next service".
const ACTIVE_STATUSES = new Set(['pending', 'in_progress']);
const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export interface BikeStatusTask {
  title: string;
  dueDate?: string | null;
  priority: string;
  status: string;
}

export interface BikeStatusBike {
  nickname?: string | null;
  make: string;
  model: string;
  currentMileage?: number | null;
  recallCount: number;
}

export interface BikeStatusInput {
  /** True while actively recording and moving — collapses to a single refresh row (R20). */
  moving: boolean;
  bike: BikeStatusBike | null;
  tasks: BikeStatusTask[];
}

/** English relative-due string (head-unit copy is hardcoded — see file header). */
function formatDueShort(dueDate: string): string {
  const { isOverdue, daysAway } = getRelativeDueDate(dueDate);
  if (isOverdue) return `${Math.abs(daysAway)}d overdue`;
  if (daysAway === 0) return 'due today';
  if (daysAway === 1) return 'due tomorrow';
  return `in ${daysAway}d`;
}

/**
 * Most-urgent active task: overdue first, then soonest due date, then higher
 * priority for ties. Mirrors the home-screen next-service selection — computeHealthScore
 * returns only aggregate counts, not the task itself, so the pick lives here.
 */
function pickNextService(tasks: BikeStatusTask[]): BikeStatusTask | null {
  const candidates = tasks.filter((t) => ACTIVE_STATUSES.has(t.status) && t.dueDate);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const da = getRelativeDueDate(a.dueDate as string).daysAway;
    const db = getRelativeDueDate(b.dueDate as string).daysAway;
    if (da !== db) return da - db; // most overdue / soonest first
    // Unknown priorities sort lowest (0) so a recognized priority always wins a tie.
    return (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
  })[0];
}

function mileageDetail(bike: BikeStatusBike, system: MeasurementSystem): string {
  const mileage = bike.currentMileage;
  if (mileage == null) return DASH;
  // current_mileage is stored raw in the user's unit; only the label follows system.
  return `${mileage.toLocaleString()} ${mileageUnitLabel(system)}`;
}

function nextServiceDetail(tasks: BikeStatusTask[]): string {
  const task = pickNextService(tasks);
  if (!task?.dueDate) return DASH;
  return `${task.title} · ${formatDueShort(task.dueDate)}`;
}

function recallsDetail(bike: BikeStatusBike): string {
  return bike.recallCount > 0 ? `${bike.recallCount}` : BIKE_LABEL.noRecalls;
}

/** (bike status + motion + units) → the pushed Bike-list model. */
export function buildBikeStatus(input: BikeStatusInput, system: MeasurementSystem): CPListModel {
  // R20: while moving, never show stale/network values — a single call to action.
  if (input.moving) {
    return { title: BIKE_LABEL.title, rows: [{ title: BIKE_LABEL.stopToRefresh, detail: '' }] };
  }
  if (!input.bike) {
    return { title: BIKE_LABEL.title, rows: [{ title: BIKE_LABEL.noBike, detail: '' }] };
  }
  const rows: CPListRow[] = [
    { title: BIKE_LABEL.nextService, detail: nextServiceDetail(input.tasks) },
    { title: BIKE_LABEL.mileage, detail: mileageDetail(input.bike, system) },
    { title: BIKE_LABEL.recalls, detail: recallsDetail(input.bike) },
  ];
  return { title: BIKE_LABEL.title, rows };
}

/** Recoverable error state — a load failure shows this instead of a stale placeholder. */
export function buildBikeError(): CPListModel {
  return {
    title: BIKE_LABEL.title,
    rows: [{ title: BIKE_LABEL.loadError, detail: BIKE_LABEL.loadErrorDetail }],
  };
}
