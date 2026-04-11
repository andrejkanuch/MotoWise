import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
