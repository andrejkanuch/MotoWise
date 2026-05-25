import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const mmkv = createMMKV({ id: 'whats-new' });

const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.remove(key),
};

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
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
