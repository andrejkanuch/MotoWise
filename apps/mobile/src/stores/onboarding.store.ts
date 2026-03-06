import type { ExperienceLevel } from '@motolearn/types';
import { create } from 'zustand';

interface BikeData {
  year: number;
  make: string;
  makeId: number;
  model: string;
  nickname?: string;
}

interface OnboardingState {
  experienceLevel: ExperienceLevel | null;
  bikeData: BikeData | null;
  ridingGoals: string[];
  setExperienceLevel: (level: ExperienceLevel) => void;
  setBikeData: (data: BikeData | null) => void;
  setRidingGoals: (goals: string[]) => void;
  reset: () => void;
}

const initialState = {
  experienceLevel: null as ExperienceLevel | null,
  bikeData: null as BikeData | null,
  ridingGoals: [] as string[],
};

export const useOnboardingStore = create<OnboardingState>()(
  (set, _get, store) => ({
    ...initialState,
    setExperienceLevel: (level) => set({ experienceLevel: level }),
    setBikeData: (data) => set({ bikeData: data }),
    setRidingGoals: (goals) => set({ ridingGoals: goals }),
    reset: () => set(store.getInitialState(), true),
  }),
);
