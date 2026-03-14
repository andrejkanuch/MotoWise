import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
