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

export function migrateCarPlayState(persisted: unknown, version: number) {
  const state = persisted as Partial<CarPlayState> | undefined;
  if (version < 2 && state?.startMode && state.startMode !== 'manual') {
    return { ...state, startMode: 'manual' as const };
  }
  return state;
}

export const useCarPlayStore = create<CarPlayState>()(
  persist(
    (set) => ({
      // Manual is the only start mode that is built: 'automatic' (the auto-start
      // gate, U7) and 'phoneFirst' are shown as "Coming soon" and cannot be picked.
      startMode: 'manual',
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
      version: 2,
      // v0 installs defaulted to 'automatic'; v1 kept an explicit 'automatic' or
      // 'phoneFirst'. Neither mode is built (no Start control on the head unit), so
      // every stored mode other than 'manual' becomes 'manual'.
      migrate: migrateCarPlayState,
      storage: createJSONStorage(() => createZustandMMKVStorage('carplay-companion')),
      partialize: partializeCarPlayState,
    },
  ),
);
