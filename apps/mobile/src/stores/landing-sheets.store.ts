import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';

/**
 * What the landing-sheet queue (lib/landing-sheet-queue.ts) remembers across
 * cold sessions on this install: the session the rider landed from onboarding
 * in, and the landing sheets still owed to them (a sheet deferred by a
 * higher one waits here for the next cold session).
 */
interface LandingSheetsState {
  landingSessionId: string | null;
  /** Landing sheet ids (`LANDING_SHEET` values) not shown or ruled out yet. */
  owed: string[];
  noteLanding: (sessionId: string, sheets: readonly string[]) => void;
  settle: (sheet: string) => void;
}

const STORE_VERSION = 1;

export const useLandingSheetsStore = create<LandingSheetsState>()(
  persist(
    (set, get) => ({
      landingSessionId: null,
      owed: [],
      noteLanding: (sessionId, sheets) => set({ landingSessionId: sessionId, owed: [...sheets] }),
      settle: (sheet) => {
        if (!get().owed.includes(sheet)) return;
        set({ owed: get().owed.filter((owed) => owed !== sheet) });
      },
    }),
    {
      name: 'landing-sheets',
      version: STORE_VERSION,
      storage: createJSONStorage(() => createZustandMMKVStorage('landing-sheets')),
      partialize: ({ landingSessionId, owed }) => ({ landingSessionId, owed }),
    },
  ),
);
