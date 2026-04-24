import type { Currency, MeasurementSystem, OnboardingGoal, RiderType } from '@motovault/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface BikeData {
  year: number;
  make: string;
  makeId: number;
  model: string;
  nickname?: string;
  photoUri?: string;
}

interface OnboardingState {
  riderType: RiderType | null;
  bikeData: BikeData | null;
  goals: OnboardingGoal[];
  measurementSystem: MeasurementSystem | null;
  maintenanceReminders: boolean;
  seasonalTips: boolean;
  recallAlerts: boolean;
  currency: Currency | null;
  setRiderType: (type: RiderType) => void;
  setBikeData: (data: BikeData | null) => void;
  setGoals: (goals: OnboardingGoal[]) => void;
  setMeasurementSystem: (system: MeasurementSystem) => void;
  setMaintenanceReminders: (enabled: boolean) => void;
  setSeasonalTips: (enabled: boolean) => void;
  setRecallAlerts: (enabled: boolean) => void;
  setCurrency: (currency: Currency) => void;
  reset: () => void;
}

const initialState = {
  riderType: null as RiderType | null,
  bikeData: null as BikeData | null,
  goals: [] as OnboardingGoal[],
  measurementSystem: null as MeasurementSystem | null,
  maintenanceReminders: true,
  seasonalTips: true,
  recallAlerts: true,
  currency: null as Currency | null,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, _get, store) => ({
      ...initialState,
      setRiderType: (type) => set({ riderType: type }),
      setBikeData: (data) => set({ bikeData: data }),
      setGoals: (goals) => set({ goals }),
      setMeasurementSystem: (system) => set({ measurementSystem: system }),
      setMaintenanceReminders: (enabled) => set({ maintenanceReminders: enabled }),
      setSeasonalTips: (enabled) => set({ seasonalTips: enabled }),
      setRecallAlerts: (enabled) => set({ recallAlerts: enabled }),
      setCurrency: (currency) => set({ currency }),
      reset: () => set(store.getInitialState(), true),
    }),
    {
      name: 'onboarding-state',
      version: 4,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({
        setRiderType,
        setBikeData,
        setGoals,
        setMeasurementSystem,
        setMaintenanceReminders,
        setSeasonalTips,
        setRecallAlerts,
        setCurrency,
        reset,
        ...data
      }) => data,
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object')
          return initialState as unknown as OnboardingState;

        const state = persistedState as Record<string, unknown>;

        // V3 → V4: Map old fields to new structure
        if (version < 4) {
          // Map experienceLevel → riderType (best effort)
          state.riderType = state.riderType ?? null;
          state.goals = state.goals ?? [];
          state.measurementSystem = state.measurementSystem ?? null;

          // Clean up removed V1/V2/V3 fields
          delete state.experienceLevel;
          delete state.ridingGoals;
          delete state.ridingFrequency;
          delete state.maintenanceStyle;
          delete state.learningFormats;
          delete state.annualRepairSpend;
          delete state.reminderChannel;
          delete state.weeklySummary;
          delete state.lastServiceDate;

          // Simplify bikeData if it exists
          if (state.bikeData && typeof state.bikeData === 'object') {
            const bd = state.bikeData as Record<string, unknown>;
            delete bd.type;
            delete bd.currentMileage;
            delete bd.mileageUnit;
          }
        }

        return state as unknown as OnboardingState;
      },
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            console.error('[OnboardingStore] Migration/rehydration failed:', error);
          }
        };
      },
    },
  ),
);
