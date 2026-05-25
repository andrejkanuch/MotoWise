import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const mmkv = createMMKV({ id: 'learn-onboarding' });

const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.remove(key),
};

interface LearnOnboardingState {
  dismissed: boolean;
  visitCount: number;
  dismiss: () => void;
  incrementVisit: () => void;
}

export const useLearnOnboardingStore = create<LearnOnboardingState>()(
  persist(
    (set, get) => ({
      dismissed: false,
      visitCount: 0,
      dismiss: () => set({ dismissed: true }),
      incrementVisit: () => {
        const next = get().visitCount + 1;
        set({ visitCount: next, dismissed: next >= 3 ? true : get().dismissed });
      },
    }),
    {
      name: 'learn-onboarding',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
