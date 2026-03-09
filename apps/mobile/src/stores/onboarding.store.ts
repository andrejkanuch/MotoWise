import type {
  AnnualRepairSpend,
  ExperienceLevel,
  LastServiceDate,
  LearningFormat,
  MaintenanceStyle,
  MileageUnit,
  MotorcycleType,
  ReminderChannel,
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
  mileageUnit: MileageUnit;
  photoUri?: string;
}

interface OnboardingState {
  experienceLevel: ExperienceLevel | null;
  bikeData: BikeData | null;
  ridingGoals: RidingGoal[];
  ridingFrequency: RidingFrequency | null;
  maintenanceStyle: MaintenanceStyle | null;
  learningFormats: LearningFormat[];
  annualRepairSpend: AnnualRepairSpend | null;
  maintenanceReminders: boolean;
  reminderChannel: ReminderChannel | null;
  seasonalTips: boolean;
  recallAlerts: boolean;
  weeklySummary: boolean;
  lastServiceDate: LastServiceDate | null;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setBikeData: (data: BikeData | null) => void;
  setRidingGoals: (goals: RidingGoal[]) => void;
  setRidingFrequency: (frequency: RidingFrequency) => void;
  setMaintenanceStyle: (style: MaintenanceStyle) => void;
  setLearningFormats: (formats: LearningFormat[]) => void;
  setAnnualRepairSpend: (spend: AnnualRepairSpend) => void;
  setMaintenanceReminders: (enabled: boolean) => void;
  setReminderChannel: (channel: ReminderChannel) => void;
  setSeasonalTips: (enabled: boolean) => void;
  setRecallAlerts: (enabled: boolean) => void;
  setWeeklySummary: (enabled: boolean) => void;
  setLastServiceDate: (date: LastServiceDate) => void;
  reset: () => void;
}

const initialState = {
  experienceLevel: null as ExperienceLevel | null,
  bikeData: null as BikeData | null,
  ridingGoals: [] as RidingGoal[],
  ridingFrequency: null as RidingFrequency | null,
  maintenanceStyle: null as MaintenanceStyle | null,
  learningFormats: [] as LearningFormat[],
  annualRepairSpend: null as AnnualRepairSpend | null,
  maintenanceReminders: true,
  reminderChannel: null as ReminderChannel | null,
  seasonalTips: true,
  recallAlerts: true,
  weeklySummary: false,
  lastServiceDate: null as LastServiceDate | null,
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
      setAnnualRepairSpend: (spend) => set({ annualRepairSpend: spend }),
      setMaintenanceReminders: (enabled) => set({ maintenanceReminders: enabled }),
      setReminderChannel: (channel) => set({ reminderChannel: channel }),
      setSeasonalTips: (enabled) => set({ seasonalTips: enabled }),
      setRecallAlerts: (enabled) => set({ recallAlerts: enabled }),
      setWeeklySummary: (enabled) => set({ weeklySummary: enabled }),
      setLastServiceDate: (date) => set({ lastServiceDate: date }),
      reset: () => set(store.getInitialState(), true),
    }),
    {
      name: 'onboarding-state',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        experienceLevel: state.experienceLevel,
        bikeData: state.bikeData,
        ridingGoals: state.ridingGoals,
        ridingFrequency: state.ridingFrequency,
        maintenanceStyle: state.maintenanceStyle,
        learningFormats: state.learningFormats,
        annualRepairSpend: state.annualRepairSpend,
        maintenanceReminders: state.maintenanceReminders,
        reminderChannel: state.reminderChannel,
        seasonalTips: state.seasonalTips,
        recallAlerts: state.recallAlerts,
        weeklySummary: state.weeklySummary,
        lastServiceDate: state.lastServiceDate,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          state.annualRepairSpend = state.annualRepairSpend ?? null;
          state.maintenanceReminders = state.maintenanceReminders ?? true;
          state.reminderChannel = state.reminderChannel ?? null;
          state.seasonalTips = state.seasonalTips ?? true;
          state.recallAlerts = state.recallAlerts ?? true;
          state.weeklySummary = state.weeklySummary ?? false;
          state.lastServiceDate = state.lastServiceDate ?? null;
        }
        return state as unknown as OnboardingState;
      },
    },
  ),
);
