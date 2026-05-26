import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';

interface WhatsNewState {
  lastSeenVersion: string | null;
  setLastSeenVersion: (version: string) => void;
}

export const useWhatsNewStore = create<WhatsNewState>()(
  persist(
    (set) => ({
      lastSeenVersion: null,
      setLastSeenVersion: (lastSeenVersion) => set({ lastSeenVersion }),
    }),
    {
      name: 'whats-new',
      storage: createJSONStorage(() => createZustandMMKVStorage('whats-new')),
    },
  ),
);
