import type {
  ExperienceLevel,
  LearningFormat,
  MaintenanceStyle,
  MotorcycleType,
  RidingFrequency,
  RidingGoal,
} from '@motolearn/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface BikeData {
  year: number;
  make: string;
  makeId: number;
  model: string;
  nickname?: string;
  type: MotorcycleType;
  currentMileage: number;
}

interface OnboardingState {
  experienceLevel: ExperienceLevel | null;
  bikeData: BikeData | null;
  ridingGoals: RidingGoal[];
  ridingFrequency: RidingFrequency | null;
  maintenanceStyle: MaintenanceStyle | null;
  learningFormats: LearningFormat[];
  currentStep: number;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setBikeData: (data: BikeData | null) => void;
  setRidingGoals: (goals: RidingGoal[]) => void;
  setRidingFrequency: (frequency: RidingFrequency) => void;
  setMaintenanceStyle: (style: MaintenanceStyle) => void;
  setLearningFormats: (formats: LearningFormat[]) => void;
  setCurrentStep: (step: number) => void;
  reset: () => void;
}

const initialState = {
  experienceLevel: null as ExperienceLevel | null,
  bikeData: null as BikeData | null,
  ridingGoals: [] as RidingGoal[],
  ridingFrequency: null as RidingFrequency | null,
  maintenanceStyle: null as MaintenanceStyle | null,
  learningFormats: [] as LearningFormat[],
  currentStep: 0,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, _get, store) => ({
      ...initialState,
      setExperienceLevel: (level) => set({ experienceLevel: level }),
      setBikeData: (data) => set({ bikeData: data }),
      setRidingGoals: (goals) => set({ ridingGoals: goals }),
      setRidingFrequency: (frequency) => set({ ridingFrequency: frequency }),
      setMaintenanceStyle: (style) => set({ maintenanceStyle: style }),
      setLearningFormats: (formats) => set({ learningFormats: formats }),
      setCurrentStep: (step) => set({ currentStep: step }),
      reset: () => set(store.getInitialState(), true),
    }),
    {
      name: 'onboarding-state',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        experienceLevel: state.experienceLevel,
        bikeData: state.bikeData,
        ridingGoals: state.ridingGoals,
        ridingFrequency: state.ridingFrequency,
        maintenanceStyle: state.maintenanceStyle,
        learningFormats: state.learningFormats,
        currentStep: state.currentStep,
      }),
    },
  ),
);
