import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SubscriptionState {
  isAvailable: boolean;
  isPro: boolean;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  isLoading: boolean;
  setAvailable: (available: boolean) => void;
  setPro: (isPro: boolean) => void;
  setTrialing: (isTrialing: boolean, daysLeft?: number | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      isAvailable: false,
      isPro: false,
      isTrialing: false,
      trialDaysLeft: null,
      isLoading: false,
      setAvailable: (isAvailable) => set({ isAvailable }),
      setPro: (isPro) => set({ isPro }),
      setTrialing: (isTrialing, trialDaysLeft = null) => set({ isTrialing, trialDaysLeft }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'subscription-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isPro: state.isPro,
        isTrialing: state.isTrialing,
      }),
    },
  ),
);
