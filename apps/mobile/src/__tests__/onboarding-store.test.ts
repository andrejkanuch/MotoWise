jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { useOnboardingStore } from '../stores/onboarding.store';

beforeEach(() => {
  useOnboardingStore.getState().reset();
});

describe('useOnboardingStore', () => {
  describe('initial state', () => {
    it('has null riderType', () => {
      expect(useOnboardingStore.getState().riderType).toBeNull();
    });

    it('has null bikeData', () => {
      expect(useOnboardingStore.getState().bikeData).toBeNull();
    });

    it('has empty goals array', () => {
      expect(useOnboardingStore.getState().goals).toEqual([]);
    });

    it('has null measurementSystem', () => {
      expect(useOnboardingStore.getState().measurementSystem).toBeNull();
    });

    it('has null currency', () => {
      expect(useOnboardingStore.getState().currency).toBeNull();
    });

    it('has maintenanceReminders enabled by default', () => {
      expect(useOnboardingStore.getState().maintenanceReminders).toBe(true);
    });

    it('has seasonalTips enabled by default', () => {
      expect(useOnboardingStore.getState().seasonalTips).toBe(true);
    });

    it('has recallAlerts enabled by default', () => {
      expect(useOnboardingStore.getState().recallAlerts).toBe(true);
    });
  });

  describe('setters', () => {
    it('sets riderType', () => {
      useOnboardingStore.getState().setRiderType('daily_rider');
      expect(useOnboardingStore.getState().riderType).toBe('daily_rider');
    });

    it('sets bikeData', () => {
      const bike = { year: 2023, make: 'BMW', makeId: 449, model: 'R 1250 GS' };
      useOnboardingStore.getState().setBikeData(bike);
      expect(useOnboardingStore.getState().bikeData).toEqual(bike);
    });

    it('sets bikeData to null', () => {
      useOnboardingStore
        .getState()
        .setBikeData({ year: 2023, make: 'BMW', makeId: 449, model: 'GS' });
      useOnboardingStore.getState().setBikeData(null);
      expect(useOnboardingStore.getState().bikeData).toBeNull();
    });

    it('sets goals array', () => {
      useOnboardingStore.getState().setGoals(['maintenance', 'expenses', 'rides']);
      expect(useOnboardingStore.getState().goals).toEqual(['maintenance', 'expenses', 'rides']);
    });

    it('sets measurementSystem', () => {
      useOnboardingStore.getState().setMeasurementSystem('metric');
      expect(useOnboardingStore.getState().measurementSystem).toBe('metric');
    });

    it('sets currency', () => {
      useOnboardingStore.getState().setCurrency('EUR');
      expect(useOnboardingStore.getState().currency).toBe('EUR');
    });

    it('sets maintenanceReminders', () => {
      useOnboardingStore.getState().setMaintenanceReminders(false);
      expect(useOnboardingStore.getState().maintenanceReminders).toBe(false);
    });

    it('sets seasonalTips', () => {
      useOnboardingStore.getState().setSeasonalTips(false);
      expect(useOnboardingStore.getState().seasonalTips).toBe(false);
    });

    it('sets recallAlerts', () => {
      useOnboardingStore.getState().setRecallAlerts(false);
      expect(useOnboardingStore.getState().recallAlerts).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets all fields to initial state', () => {
      useOnboardingStore.getState().setRiderType('tourer');
      useOnboardingStore
        .getState()
        .setBikeData({ year: 2024, make: 'Ducati', makeId: 1, model: 'Panigale' });
      useOnboardingStore.getState().setGoals(['maintenance', 'trips']);
      useOnboardingStore.getState().setMeasurementSystem('imperial');
      useOnboardingStore.getState().setCurrency('GBP');
      useOnboardingStore.getState().setMaintenanceReminders(false);
      useOnboardingStore.getState().setSeasonalTips(false);
      useOnboardingStore.getState().setRecallAlerts(false);

      useOnboardingStore.getState().reset();

      const state = useOnboardingStore.getState();
      expect(state.riderType).toBeNull();
      expect(state.bikeData).toBeNull();
      expect(state.goals).toEqual([]);
      expect(state.measurementSystem).toBeNull();
      expect(state.currency).toBeNull();
      expect(state.maintenanceReminders).toBe(true);
      expect(state.seasonalTips).toBe(true);
      expect(state.recallAlerts).toBe(true);
    });
  });

  describe('persist migration v3 → v4', () => {
    const { migrate } = (
      useOnboardingStore as unknown as {
        persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } };
      }
    ).persist.getOptions();

    it('returns initial state for null persisted state', () => {
      const result = migrate(null, 3) as Record<string, unknown>;
      expect(result).toMatchObject({
        riderType: null,
        goals: [],
        measurementSystem: null,
      });
    });

    it('removes V1 fields from persisted state', () => {
      const v3State = {
        experienceLevel: 'intermediate',
        ridingGoals: ['commuting'],
        ridingFrequency: 'weekly',
        maintenanceStyle: 'diy',
        learningFormats: ['quick_tips'],
        annualRepairSpend: '200_500',
        reminderChannel: 'push',
        weeklySummary: false,
        lastServiceDate: 'under_1mo',
        maintenanceReminders: true,
        seasonalTips: true,
        recallAlerts: true,
        currency: 'EUR',
        bikeData: null,
      };

      const result = migrate(v3State, 3) as Record<string, unknown>;

      expect(result.experienceLevel).toBeUndefined();
      expect(result.ridingGoals).toBeUndefined();
      expect(result.ridingFrequency).toBeUndefined();
      expect(result.maintenanceStyle).toBeUndefined();
      expect(result.learningFormats).toBeUndefined();
      expect(result.annualRepairSpend).toBeUndefined();
      expect(result.reminderChannel).toBeUndefined();
      expect(result.weeklySummary).toBeUndefined();
      expect(result.lastServiceDate).toBeUndefined();

      expect(result.riderType).toBeNull();
      expect(result.goals).toEqual([]);
      expect(result.measurementSystem).toBeNull();
      expect(result.currency).toBe('EUR');
      expect(result.maintenanceReminders).toBe(true);
    });

    it('strips removed fields from bikeData', () => {
      const v3State = {
        experienceLevel: 'beginner',
        bikeData: {
          year: 2023,
          make: 'BMW',
          makeId: 449,
          model: 'R 1250 GS',
          type: 'touring',
          currentMileage: 5000,
          mileageUnit: 'km',
          photoUri: 'file://photo.jpg',
        },
        maintenanceReminders: true,
        seasonalTips: false,
        recallAlerts: true,
        currency: null,
      };

      const result = migrate(v3State, 3) as Record<string, unknown>;
      const bikeData = result.bikeData as Record<string, unknown>;

      expect(bikeData.year).toBe(2023);
      expect(bikeData.make).toBe('BMW');
      expect(bikeData.makeId).toBe(449);
      expect(bikeData.model).toBe('R 1250 GS');
      expect(bikeData.photoUri).toBe('file://photo.jpg');
      expect(bikeData.type).toBeUndefined();
      expect(bikeData.currentMileage).toBeUndefined();
      expect(bikeData.mileageUnit).toBeUndefined();
    });

    it('does not run migration for version 4 state', () => {
      const v4State = {
        riderType: 'tourer',
        goals: ['maintenance', 'rides'],
        measurementSystem: 'metric',
        maintenanceReminders: true,
        seasonalTips: true,
        recallAlerts: true,
        currency: 'EUR',
        bikeData: null,
      };

      const result = migrate(v4State, 4) as Record<string, unknown>;
      expect(result.riderType).toBe('tourer');
      expect(result.goals).toEqual(['maintenance', 'rides']);
    });
  });
});
