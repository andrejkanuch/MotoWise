// CarPlay companion preferences — start mode + confirmation-cue settings.
// Persisted to MMKV (same pattern as auth.store). Read by the Hub (U9), the cue
// screen (U10), and — once it ships — the native coordinator's auto-start gate (U7).

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';

export type StartMode = 'automatic' | 'manual' | 'phoneFirst';
export type CueTone = 'mechanical' | 'chime' | 'voice';

interface CarPlayState {
  startMode: StartMode;
  audioCue: boolean;
  hapticCue: boolean;
  tone: CueTone;
  setStartMode: (mode: StartMode) => void;
  setAudioCue: (enabled: boolean) => void;
  setHapticCue: (enabled: boolean) => void;
  setTone: (tone: CueTone) => void;
}

export function partializeCarPlayState(state: CarPlayState) {
  return {
    startMode: state.startMode,
    audioCue: state.audioCue,
    hapticCue: state.hapticCue,
    tone: state.tone,
  };
}

export const useCarPlayStore = create<CarPlayState>()(
  persist(
    (set) => ({
      startMode: 'automatic',
      audioCue: true,
      hapticCue: true,
      tone: 'mechanical',
      setStartMode: (startMode) => set({ startMode }),
      setAudioCue: (audioCue) => set({ audioCue }),
      setHapticCue: (hapticCue) => set({ hapticCue }),
      setTone: (tone) => set({ tone }),
    }),
    {
      name: 'carplay-companion',
      storage: createJSONStorage(() => createZustandMMKVStorage('carplay-companion')),
      partialize: partializeCarPlayState,
    },
  ),
);
