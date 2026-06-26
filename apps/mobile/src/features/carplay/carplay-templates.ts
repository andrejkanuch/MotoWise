// Pure builders for the CarPlay live-ride panel. No React, no native, no store —
// just (ride fields + units) → a CPInformationTemplate model. Keeps the
// glanceable hierarchy and state vocabulary testable in isolation.

import type { MeasurementSystem } from '@motovault/types';
import type { CPInformationTemplateModel } from '../../../modules/carplay/src';
import type { StartMode } from '../../stores/carplay.store';
import { formatDistance, formatElapsed, formatElevation } from '../../utils/ride-formatters';

export type CarPlayPanelState = 'recording' | 'autoPaused' | 'acquiring' | 'idle';

export interface PanelSnapshot {
  state: CarPlayPanelState;
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
  if (input.status === 'recording' || input.status === 'paused') {
    if (!input.gpsLocked) return 'acquiring';
    if (input.status === 'paused' || input.recordingSubState === 'stopped') return 'autoPaused';
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
  const title = s.state === 'idle' ? STATE_WORD.idle : `${STATE_WORD[s.state]} · ${s.distance}`;
  const items = [
    { title: 'Moving', detail: s.movingTime },
    { title: 'Climb', detail: s.climb },
    { title: 'Mode', detail: MODE_LABEL[s.startMode] },
  ];
  return { title, items, actions: buildActions(s.state, s.startMode) };
}

export function buildActions(
  state: CarPlayPanelState,
  startMode: StartMode,
): CPInformationTemplateModel['actions'] {
  switch (state) {
    case 'recording':
      return [
        { id: 'pause', title: 'Pause' },
        { id: 'stop', title: 'Stop' },
      ];
    case 'autoPaused':
      return [
        { id: 'resume', title: 'Resume' },
        { id: 'stop', title: 'Stop' },
      ];
    case 'acquiring':
      return [{ id: 'stop', title: 'Stop' }];
    default:
      // idle: manual offers Start; automatic shows no control (no duplicate start)
      return startMode === 'manual' ? [{ id: 'start', title: 'Start Ride' }] : [];
  }
}
