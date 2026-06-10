import type {
  AnnualRepairSpend,
  Currency,
  ExperienceLevel,
  LastServiceDate,
  MaintenanceStyle,
  MileageUnit,
  MotorcycleType,
  ReminderChannel,
  RidingFrequency,
  RidingGoal,
} from '@motovault/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { OnboardingRoute } from '../config/onboarding';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';

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
  /**
   * Variant B "stay on top of" multi-select (concern ids). Drives the Reveal's
   * emphasis bias and paywall value-prop ordering. Client-side only (no server
   * field yet — informs day-0 personalization, not stored preferences).
   */
  stayOnTopOf: string[];
  /** Pre-bike mileage captured in B's "last service" step (km/mi by unit). */
  preBikeMileage: number | null;
  preBikeMileageUnit: MileageUnit | null;
  maintenanceStyle: MaintenanceStyle | null;
  annualRepairSpend: AnnualRepairSpend | null;
  maintenanceReminders: boolean;
  reminderChannel: ReminderChannel | null;
  seasonalTips: boolean;
  recallAlerts: boolean;
  weeklySummary: boolean;
  lastServiceDate: LastServiceDate | null;
  currency: Currency | null;
  /** OEM schedule IDs the user accepted in the maintenance swipe screen */
  acceptedOemScheduleIds: string[];
  /** V2: tracks last completed screen for resume-after-kill */
  lastCompletedScreen: OnboardingRoute | null;
  setAcceptedOemScheduleIds: (ids: string[]) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setBikeData: (data: BikeData | null) => void;
  setRidingGoals: (goals: RidingGoal[]) => void;
  setRidingFrequency: (frequency: RidingFrequency) => void;
  setStayOnTopOf: (ids: string[]) => void;
  setPreBikeMileage: (mileage: number | null, unit: MileageUnit | null) => void;
  setMaintenanceStyle: (style: MaintenanceStyle) => void;
  setAnnualRepairSpend: (spend: AnnualRepairSpend) => void;
  setMaintenanceReminders: (enabled: boolean) => void;
  setReminderChannel: (channel: ReminderChannel) => void;
  setSeasonalTips: (enabled: boolean) => void;
  setRecallAlerts: (enabled: boolean) => void;
  setWeeklySummary: (enabled: boolean) => void;
  setLastServiceDate: (date: LastServiceDate) => void;
  setCurrency: (currency: Currency) => void;
  setLastCompletedScreen: (screen: OnboardingRoute) => void;
  reset: () => void;
}

const initialState = {
  experienceLevel: null as ExperienceLevel | null,
  bikeData: null as BikeData | null,
  ridingGoals: [] as RidingGoal[],
  ridingFrequency: null as RidingFrequency | null,
  stayOnTopOf: [] as string[],
  preBikeMileage: null as number | null,
  preBikeMileageUnit: null as MileageUnit | null,
  maintenanceStyle: null as MaintenanceStyle | null,
  annualRepairSpend: null as AnnualRepairSpend | null,
  maintenanceReminders: true,
  reminderChannel: null as ReminderChannel | null,
  seasonalTips: true,
  recallAlerts: true,
  weeklySummary: false,
  lastServiceDate: null as LastServiceDate | null,
  currency: null as Currency | null,
  acceptedOemScheduleIds: [] as string[],
  lastCompletedScreen: null as OnboardingRoute | null,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, _get, store) => ({
      ...initialState,
      setExperienceLevel: (level) => set({ experienceLevel: level }),
      setBikeData: (data) => set({ bikeData: data }),
      setRidingGoals: (goals) => set({ ridingGoals: goals }),
      setRidingFrequency: (frequency) => set({ ridingFrequency: frequency }),
      setStayOnTopOf: (ids) => set({ stayOnTopOf: ids }),
      setPreBikeMileage: (preBikeMileage, preBikeMileageUnit) =>
        set({ preBikeMileage, preBikeMileageUnit }),
      setMaintenanceStyle: (style) => set({ maintenanceStyle: style }),
      setAnnualRepairSpend: (spend) => set({ annualRepairSpend: spend }),
      setAcceptedOemScheduleIds: (ids) => set({ acceptedOemScheduleIds: ids }),
      setMaintenanceReminders: (enabled) => set({ maintenanceReminders: enabled }),
      setReminderChannel: (channel) => set({ reminderChannel: channel }),
      setSeasonalTips: (enabled) => set({ seasonalTips: enabled }),
      setRecallAlerts: (enabled) => set({ recallAlerts: enabled }),
      setWeeklySummary: (enabled) => set({ weeklySummary: enabled }),
      setLastServiceDate: (date) => set({ lastServiceDate: date }),
      setCurrency: (currency) => set({ currency }),
      setLastCompletedScreen: (screen) => set({ lastCompletedScreen: screen }),
      reset: () => set(store.getInitialState(), true),
    }),
    {
      name: 'onboarding-state',
      version: 6,
      storage: createJSONStorage(() => createZustandMMKVStorage('onboarding-store')),
      partialize: ({
        setExperienceLevel,
        setBikeData,
        setRidingGoals,
        setRidingFrequency,
        setStayOnTopOf,
        setPreBikeMileage,
        setMaintenanceStyle,
        setAnnualRepairSpend,
        setAcceptedOemScheduleIds,
        setMaintenanceReminders,
        setReminderChannel,
        setSeasonalTips,
        setRecallAlerts,
        setWeeklySummary,
        setLastServiceDate,
        setCurrency,
        setLastCompletedScreen,
        reset,
        ...data
      }) => data,
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object')
          return initialState as unknown as OnboardingState;

        const state = persistedState as Record<string, unknown>;

        // V4: Onboarding redesign — add lastCompletedScreen, handle v1→v2 reset
        if (version < 4) {
          // If store has no ridingGoals or is pre-v3, hard reset to clean v2 flow.
          // This catches users mid-v1-onboarding who would have broken state.
          // Note: onboardingCompleted lives in auth store, not here — don't check it.
          const goals = state.ridingGoals as string[] | undefined;
          if (!goals?.length || version < 3) {
            return initialState as unknown as OnboardingState;
          }
          // Otherwise append missing v4 fields
          state.lastCompletedScreen = null;
        }

        // V6: A/B 2026 — Variant B profiling fields.
        if (version < 6) {
          state.stayOnTopOf = state.stayOnTopOf ?? [];
          state.preBikeMileage = state.preBikeMileage ?? null;
          state.preBikeMileageUnit = state.preBikeMileageUnit ?? null;
        }

        if (version < 3) {
          state.currency = state.currency ?? null;
        }
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
