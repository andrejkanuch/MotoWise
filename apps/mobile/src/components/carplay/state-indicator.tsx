// Canonical ride-state vocabulary shared across the CarPlay tile, the phone
// banner, the status sheet, and the cue legend — one vocabulary the rider learns
// once (design spec §1). State is NEVER color-only: glyph + word carry it,
// color is reinforcement.

import { CircleDot, LocateFixed, Pause, Square } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEditorialTheme } from '../../theme/editorial';

export type RideStateKey = 'recording' | 'autoPaused' | 'paused' | 'acquiring' | 'saved' | 'stop';

type Glyph = ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

// glyph + tint-token resolver per state. `tintKey` maps to an editorial token.
const STATE_CONFIG: Record<
  RideStateKey,
  { word: string; Glyph: Glyph; tintKey: 'warm2' | 'success' | 'info' | 'danger' }
> = {
  recording: { word: 'RECORDING', Glyph: CircleDot, tintKey: 'warm2' },
  autoPaused: { word: 'AUTO-PAUSED', Glyph: Pause, tintKey: 'warm2' },
  paused: { word: 'PAUSED', Glyph: Pause, tintKey: 'warm2' },
  acquiring: { word: 'ACQUIRING GPS', Glyph: LocateFixed, tintKey: 'info' },
  saved: { word: 'SAVED', Glyph: CircleDot, tintKey: 'success' },
  stop: { word: 'STOP', Glyph: Square, tintKey: 'danger' },
};

export function stateTint(
  state: RideStateKey,
  c: ReturnType<typeof useEditorialTheme>['t'],
): string {
  return c[STATE_CONFIG[state].tintKey];
}

export function stateWord(state: RideStateKey): string {
  return STATE_CONFIG[state].word;
}

export function StateGlyph({
  state,
  size = 20,
  color,
}: {
  state: RideStateKey;
  size?: number;
  color?: string;
}) {
  const { t: c } = useEditorialTheme();
  const cfg = STATE_CONFIG[state];
  const tintColor = color ?? c[cfg.tintKey];
  return <cfg.Glyph size={size} color={tintColor} strokeWidth={2} />;
}
