// Pure builders for the CarPlay live-ride panel. No React, no native, no store —
// just (ride fields + units) → a CPInformationTemplate model. Keeps the
// glanceable hierarchy and state vocabulary testable in isolation.

import type { MeasurementSystem } from '@motovault/types';
import type { CPInformationTemplateModel } from '../../../modules/carplay/src';
import type { StartMode } from '../../stores/carplay.store';
import {
  formatDistance,
  formatElapsed,
  formatElevation,
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
} as const;

export type CarPlayActionId = (typeof CARPLAY_ACTION)[keyof typeof CARPLAY_ACTION];

export interface PanelSnapshot {
  state: CarPlayPanelState;
  speed: string;
  distance: string;
  movingTime: string;
  climb: string;
  startMode: StartMode;
}

export interface RideInput {
  status: 'idle' | 'recording' | 'paused' | 'ended';
  recordingSubState: 'moving' | 'stopped';
  /** meters */
  distance: number;
  /** seconds */
  elapsedTime: number;
  /** meters */
  elevationGain: number;
  /** meters per second */
  speed: number;
  /** TODO(carplay): real GPS-lock signal (parent open question). */
  gpsLocked: boolean;
  startMode: StartMode;
}

const DASH = '—';

// State word shown in the title. Glyph/color live on the phone side; the CarPlay
// title is text (system-rendered), so the word carries the state.
const STATE_WORD: Record<CarPlayPanelState, string> = {
  recording: 'RECORDING',
  autoPaused: 'AUTO-PAUSED',
  acquiring: 'ACQUIRING GPS',
  idle: 'READY',
};

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
  return {
    state,
    speed: live ? formatSpeed(input.speed, system) : `${DASH} ${speedUnitLabel(system)}`,
    distance: live
      ? formatDistance(input.distance, system)
      : `${DASH} ${system === 'imperial' ? 'mi' : 'km'}`,
    movingTime: live ? formatElapsed(input.elapsedTime) : `${DASH}:${DASH}`,
    climb: live
      ? formatElevation(input.elevationGain, system)
      : `${DASH} ${system === 'imperial' ? 'ft' : 'm'}`,
    startMode: input.startMode,
  };
}

export function buildPanelItems(s: PanelSnapshot): CPInformationTemplateModel {
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
        { title: 'Climb', detail: s.climb },
      ]
    : [
        { title: 'Distance', detail: s.distance },
        { title: 'Moving', detail: s.movingTime },
        { title: 'Climb', detail: s.climb },
        { title: 'Mode', detail: MODE_LABEL[s.startMode] },
      ];
  return { title: STATE_WORD[s.state], items, actions: buildActions(s.state, s.startMode) };
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
