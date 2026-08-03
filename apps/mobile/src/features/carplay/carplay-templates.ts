// Pure builders for the CarPlay live-ride panel. No React, no native, no store —
// just (ride fields + units) → a CPInformationTemplate model. Keeps the
// glanceable hierarchy and state vocabulary testable in isolation.

import { MaintenanceTaskStatus, type MeasurementSystem } from '@motovault/types';
import type { CPInformationTemplateModel } from '../../../modules/carplay/src';
import { getRelativeDueDate } from '../../lib/health-score';
import type { StartMode } from '../../stores/carplay.store';
import {
  elevationUnitLabel,
  formatDistance,
  formatElapsed,
  formatElevationValue,
  formatSpeed,
  speedUnitLabel,
} from '../../utils/ride-formatters';

export type CarPlayPanelState = 'recording' | 'autoPaused' | 'acquiring' | 'idle';

// Head-unit action ids. Shared by buildActions (which stamps them onto the
// CPInformationTemplate buttons) and the coordinator's onAction dispatcher, so the
// command vocabulary is defined once and checked exhaustively (no magic strings).
export const CARPLAY_ACTION = {
  start: 'start',
  pause: 'pause',
  resume: 'resume',
  stop: 'stop',
  cancelStop: 'cancelStop',
  bike: 'bike',
} as const;

// The persistent "Bike" nav-bar button on the Ride panel (pushes the bike-status
// list). Kept constant across every state so it never churns the rebuild key.
const RIDE_HEADER_ACTIONS = [{ id: CARPLAY_ACTION.bike, title: 'Bike' }];

export type CarPlayActionId = (typeof CARPLAY_ACTION)[keyof typeof CARPLAY_ACTION];

export interface PanelSnapshot {
  state: CarPlayPanelState;
  speed: string;
  distance: string;
  movingTime: string;
  climb: string;
  /** The single self-prioritizing row-4 shown while riding (see pickHeadsUp). */
  headsUp: HeadsUpRow;
  startMode: StartMode;
  /**
   * The ride has been stationary long enough that the rider probably forgot to stop
   * it. Surfaced in the title so a glance at the CarPlay screen is enough — the
   * phone notification is easy to miss on a bike, and Stop is already on this panel.
   */
  forgotToStopPending: boolean;
}

export interface RideInput {
  status: 'idle' | 'recording' | 'paused' | 'ended';
  recordingSubState: 'moving' | 'stopped';
  /** meters */
  distance: number;
  /** seconds */
  elapsedTime: number;
  /** meters climbed (ascent) */
  elevationGain: number;
  /** meters per second */
  speed: number;
  /** TODO(carplay): real GPS-lock signal (parent open question). */
  gpsLocked: boolean;
  /** Mirrors `rideMMKV.getForgotToStopPending()` — set by the auto-pause machine. */
  forgotToStopPending?: boolean;
  startMode: StartMode;
  /** Open-recall count for the active bike (0 when none / unknown). Drives the heads-up row. */
  recallCount: number;
  /** Active bike's odometer in km — used to detect mileage-overdue service. */
  currentMileage?: number | null;
  /** Active bike's maintenance tasks — used to pick the heads-up service row. */
  tasks: HeadsUpTask[];
}

const DASH = '—';

/**
 * Ascent-only elevation string: "↑640 m". Descent is intentionally dropped from the
 * head unit — two numbers in one row is the least-glanceable element on the panel
 * (the 2-second glance budget). Descent stays in the phone ride-summary. This string
 * is the fallback rung of the heads-up row (see pickHeadsUp).
 */
function formatClimb(gain: number, system: MeasurementSystem): string {
  return `↑${formatElevationValue(gain, system)} ${elevationUnitLabel(system)}`;
}

// --- Heads-up row (self-prioritizing row 4 while riding) ---

// A pending task due within this many days reads as "due soon" on the panel. Kept in
// sync with the app's near-term reminder horizon (remind30d/remind7d cadence); 14d is
// the middle ground that surfaces a service before it lapses without crying wolf.
export const DUE_SOON_DAYS = 14;

// Row labels for each rung of the heads-up ladder (no magic strings; hardcoded English
// to match the rest of the CarPlay surface — see carplay-bike-status header).
export const HEADS_UP_LABEL = {
  recall: 'Recall',
  overdue: 'Overdue',
  service: 'Service',
  climb: 'Climb',
} as const;

// Glance-safe cap for a task title folded into a single head-unit row.
const MAX_HEADS_UP_DETAIL = 26;

/** A maintenance task, reduced to the fields the heads-up picker needs. */
export interface HeadsUpTask {
  title: string;
  status: string;
  /** ISO date; null when the task is mileage-only. */
  dueDate?: string | null;
  /** Odometer (km) at which the task falls due; null when date-only. */
  targetMileage?: number | null;
}

/** The bike/maintenance inputs the picker reads (threaded in by the coordinator). */
export interface HeadsUpInput {
  recallCount: number;
  currentMileage?: number | null;
  tasks: HeadsUpTask[];
}

/** A resolved heads-up row: one label + one value (glance budget). */
export interface HeadsUpRow {
  title: string;
  detail: string;
}

function truncateDetail(s: string): string {
  return s.length > MAX_HEADS_UP_DETAIL ? `${s.slice(0, MAX_HEADS_UP_DETAIL - 1)}…` : s;
}

function isActiveTask(t: HeadsUpTask): boolean {
  return (
    t.status === MaintenanceTaskStatus.PENDING || t.status === MaintenanceTaskStatus.IN_PROGRESS
  );
}

/** Overdue by date OR by mileage — either qualifies for the overdue rung. */
function isOverdueTask(t: HeadsUpTask, currentMileage: number | null | undefined): boolean {
  if (t.dueDate && getRelativeDueDate(t.dueDate).isOverdue) return true;
  if (t.targetMileage != null && currentMileage != null && currentMileage >= t.targetMileage) {
    return true;
  }
  return false;
}

// Most-overdue-first: date-overdue tasks sort by how negative daysAway is; a
// mileage-only overdue task (no dueDate) sorts after them (key 0).
function overdueSortKey(t: HeadsUpTask): number {
  return t.dueDate ? getRelativeDueDate(t.dueDate).daysAway : 0;
}

/**
 * Pure priority picker for the single heads-up row (row 4 while riding). First match
 * wins: open recall → service overdue → service due soon → the climb fallback. The
 * coordinator threads the bike/task data in — this never fetches, touches a store, or
 * calls native. `climbFallback` is the pre-formatted ascent string (rung d).
 */
export function pickHeadsUp(input: HeadsUpInput, climbFallback: string): HeadsUpRow {
  if (input.recallCount > 0) {
    const n = input.recallCount;
    return { title: HEADS_UP_LABEL.recall, detail: `${n} open recall${n === 1 ? '' : 's'}` };
  }

  const active = input.tasks.filter(isActiveTask);

  const overdue = active
    .filter((t) => isOverdueTask(t, input.currentMileage))
    .sort((a, b) => overdueSortKey(a) - overdueSortKey(b))[0];
  if (overdue) return { title: HEADS_UP_LABEL.overdue, detail: truncateDetail(overdue.title) };

  const dueSoon = active
    .filter((t) => t.dueDate)
    .map((t) => ({ task: t, days: getRelativeDueDate(t.dueDate as string).daysAway }))
    .filter(({ days }) => days >= 0 && days <= DUE_SOON_DAYS)
    .sort((a, b) => a.days - b.days)[0];
  if (dueSoon) {
    return {
      title: HEADS_UP_LABEL.service,
      detail: truncateDetail(`${dueSoon.task.title} · in ${dueSoon.days}d`),
    };
  }

  return { title: HEADS_UP_LABEL.climb, detail: climbFallback };
}

// State word shown in the title. Glyph/color live on the phone side; the CarPlay
// title is text (system-rendered), so the word carries the state.
const STATE_WORD: Record<CarPlayPanelState, string> = {
  recording: 'RECORDING',
  autoPaused: 'AUTO-PAUSED',
  acquiring: 'ACQUIRING GPS',
  idle: 'READY',
};

// Title shown while a Stop is armed and awaiting confirmation (R17 stop guard).
const STOP_CONFIRM_TITLE = 'STOP RIDE?';

// Title shown when the ride looks forgotten. Ranks BELOW the stop-confirm title:
// an armed Stop is an in-progress rider action and must never be overwritten by an
// advisory prompt.
const FORGOT_TO_STOP_TITLE = 'STILL RIDING?';

const MODE_LABEL: Record<StartMode, string> = {
  automatic: 'Automatic',
  manual: 'Manual',
  phoneFirst: 'Phone-first',
};

export function deriveState(
  input: Pick<RideInput, 'status' | 'recordingSubState' | 'gpsLocked'>,
): CarPlayPanelState {
  // Manual pause always reads as paused — never regress to "acquiring" (which
  // would strip the Resume control and strand the rider). Only an actively
  // recording ride that hasn't locked GPS yet shows "acquiring".
  if (input.status === 'paused') return 'autoPaused';
  if (input.status === 'recording') {
    if (!input.gpsLocked) return 'acquiring';
    if (input.recordingSubState === 'stopped') return 'autoPaused';
    return 'recording';
  }
  return 'idle';
}

export function deriveSnapshot(input: RideInput, system: MeasurementSystem): PanelSnapshot {
  const state = deriveState(input);
  // Before lock, show dashes — never a zero that reads as a real ride.
  const live = state !== 'acquiring' && state !== 'idle';
  const climb = live
    ? formatClimb(input.elevationGain, system)
    : `${DASH} ${elevationUnitLabel(system)}`;
  return {
    state,
    speed: live ? formatSpeed(input.speed, system) : `${DASH} ${speedUnitLabel(system)}`,
    distance: live
      ? formatDistance(input.distance, system)
      : `${DASH} ${system === 'imperial' ? 'mi' : 'km'}`,
    movingTime: live ? formatElapsed(input.elapsedTime) : `${DASH}:${DASH}`,
    climb,
    // The heads-up row only applies while riding; before a ride (idle/acquiring) the
    // Climb row is shown as-is with its dashed placeholder.
    headsUp: live
      ? pickHeadsUp(
          {
            recallCount: input.recallCount,
            currentMileage: input.currentMileage,
            tasks: input.tasks,
          },
          climb,
        )
      : { title: HEADS_UP_LABEL.climb, detail: climb },
    startMode: input.startMode,
    // Only meaningful for a live ride — an idle panel must never prompt.
    forgotToStopPending: live && input.forgotToStopPending === true,
  };
}

export function buildPanelItems(s: PanelSnapshot, stopArmed = false): CPInformationTemplateModel {
  // Title carries the state word only. Numerics live in rows, not the title: the
  // CarPlay InformationTemplate fixes its title at construction, so fusing a
  // constantly-ticking value into it would force a full re-push on every GPS tick.
  // Rows refresh in place (updateItems); the title/actions re-push only on a real
  // state transition. The template caps at 4 rows: while riding, speed + distance
  // lead (the live hero values); before a ride, the Mode row replaces speed (which
  // would only be a dash) so the rider can see the arming mode.
  const live = s.state === 'recording' || s.state === 'autoPaused';
  const items = live
    ? [
        { title: 'Speed', detail: s.speed },
        { title: 'Distance', detail: s.distance },
        { title: 'Moving', detail: s.movingTime },
        // Row 4 is the self-prioritizing heads-up row: recall > overdue > due-soon > climb.
        { title: s.headsUp.title, detail: s.headsUp.detail },
      ]
    : [
        { title: 'Distance', detail: s.distance },
        { title: 'Moving', detail: s.movingTime },
        { title: 'Climb', detail: s.climb },
        { title: 'Mode', detail: MODE_LABEL[s.startMode] },
      ];
  if (stopArmed) {
    // R17 stop guard: a single Stop press arms this confirm rather than ending the
    // ride outright. "Keep Riding" leads (the safe default) so an accidental tap on
    // a glance surface never loses a ride; "End Ride" is the deliberate second tap.
    return {
      title: STOP_CONFIRM_TITLE,
      items,
      actions: [
        { id: CARPLAY_ACTION.cancelStop, title: 'Keep Riding' },
        { id: CARPLAY_ACTION.stop, title: 'End Ride' },
      ],
      headerActions: RIDE_HEADER_ACTIONS,
    };
  }
  return {
    // Forgotten-ride prompt replaces the state word (which would read "AUTO-PAUSED"
    // — indistinguishable from a traffic light). Actions are left untouched: Stop and
    // Resume are already on the panel, so the title is the whole change needed, and
    // swapping the action set on an advisory would move controls under the rider's
    // thumb mid-glance.
    title: s.forgotToStopPending ? FORGOT_TO_STOP_TITLE : STATE_WORD[s.state],
    items,
    actions: buildActions(s.state, s.startMode),
    headerActions: RIDE_HEADER_ACTIONS,
  };
}

export function buildActions(
  state: CarPlayPanelState,
  startMode: StartMode,
): CPInformationTemplateModel['actions'] {
  switch (state) {
    case 'recording':
      return [
        { id: CARPLAY_ACTION.pause, title: 'Pause' },
        { id: CARPLAY_ACTION.stop, title: 'Stop' },
      ];
    case 'autoPaused':
      return [
        { id: CARPLAY_ACTION.resume, title: 'Resume' },
        { id: CARPLAY_ACTION.stop, title: 'Stop' },
      ];
    case 'acquiring':
      return [{ id: CARPLAY_ACTION.stop, title: 'Stop' }];
    default:
      // idle: manual offers Start; automatic shows no control (no duplicate start)
      return startMode === 'manual' ? [{ id: CARPLAY_ACTION.start, title: 'Start Ride' }] : [];
  }
}
