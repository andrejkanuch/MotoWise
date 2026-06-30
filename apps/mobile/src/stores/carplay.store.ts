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
      // Default to manual: the automatic auto-start gate (U7) is not shipped yet,
      // so 'automatic' surfaces no Start control and a ride can never begin from
      // the head unit. Manual gives the rider the explicit Start Ride button.
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
      version: 1,
      // v0 installs defaulted to 'automatic' (auto-start unshipped → dead end on
      // CarPlay). Coerce the dead default to 'manual' once; rides set explicitly to
      // automatic are left as-is so we don't override a deliberate choice.
      migrate: (persisted, version) => {
        const state = persisted as Partial<CarPlayState> | undefined;
        if (version < 1 && state?.startMode === 'automatic') {
          return { ...state, startMode: 'manual' };
        }
        return state;
      },
      storage: createJSONStorage(() => createZustandMMKVStorage('carplay-companion')),
      partialize: partializeCarPlayState,
    },
  ),
);
