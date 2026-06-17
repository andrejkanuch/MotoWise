import { MileageUnit, MotorcycleType } from '@motovault/types';

// Mock AsyncStorage before importing the store
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}));

// The store now imports captureException from lib/analytics, which transitively
// pulls in native SDKs (Sentry / PostHog / fbsdk). Stub it out for this unit test.
jest.mock('../lib/analytics', () => ({
  captureException: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useOnboardingStore } = require('../stores/onboarding.store');

describe('OnboardingStore — bike data', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it('should start with null bikeData', () => {
    expect(useOnboardingStore.getState().bikeData).toBeNull();
  });

  it('should persist all bike fields when setBikeData is called', () => {
    const { setBikeData } = useOnboardingStore.getState();

    setBikeData({
      year: 2024,
      make: 'BMW',
      makeId: 449,
      model: 'R 1250 GS',
      type: MotorcycleType.DUAL_SPORT,
      currentMileage: 500,
      mileageUnit: MileageUnit.KM,
    });

    const stored = useOnboardingStore.getState().bikeData;
    expect(stored).not.toBeNull();
    expect(stored.year).toBe(2024);
    expect(stored.make).toBe('BMW');
    expect(stored.makeId).toBe(449);
    expect(stored.model).toBe('R 1250 GS');
    expect(stored.type).toBe('dual_sport');
    expect(stored.currentMileage).toBe(500);
    expect(stored.mileageUnit).toBe('km');
  });

  it('should clear bikeData when setBikeData(null) is called (skip)', () => {
    const { setBikeData } = useOnboardingStore.getState();

    setBikeData({
      year: 2023,
      make: 'Honda',
      makeId: 474,
      model: 'CB500F',
      type: MotorcycleType.STANDARD,
      currentMileage: 0,
      mileageUnit: MileageUnit.MI,
    });

    expect(useOnboardingStore.getState().bikeData).not.toBeNull();

    setBikeData(null);
    expect(useOnboardingStore.getState().bikeData).toBeNull();
  });

  it('should preserve experience and goals when bike data is set', () => {
    const store = useOnboardingStore.getState();
    store.setExperienceLevel('intermediate');
    store.setRidingGoals(['track_rides', 'manage_expenses']);
    store.setBikeData({
      year: 2022,
      make: 'Kawasaki',
      makeId: 485,
      model: 'Ninja 400',
      type: MotorcycleType.SPORTBIKE,
      currentMileage: 3000,
      mileageUnit: MileageUnit.MI,
    });

    const state = useOnboardingStore.getState();
    expect(state.experienceLevel).toBe('intermediate');
    expect(state.ridingGoals).toEqual(['track_rides', 'manage_expenses']);
    expect(state.bikeData.make).toBe('Kawasaki');
  });

  it('should build correct completeOnboarding payload with all bike fields', () => {
    const store = useOnboardingStore.getState();
    store.setExperienceLevel('advanced');
    store.setRidingGoals(['track_rides']);
    store.setBikeData({
      year: 2024,
      make: 'Ducati',
      makeId: 2032,
      model: 'Panigale V4',
      type: MotorcycleType.SPORTBIKE,
      currentMileage: 100,
      mileageUnit: MileageUnit.KM,
    });

    const { bikeData, experienceLevel, ridingGoals } = useOnboardingStore.getState();

    // Simulate what personalizing.tsx builds
    const input = {
      experienceLevel: experienceLevel ?? 'beginner',
      ridingGoals: ridingGoals.length > 0 ? ridingGoals : [],
      learningFormats: [] as string[],
      ...(bikeData && {
        ...(bikeData.make?.trim() && { bikeMake: bikeData.make.trim() }),
        ...(bikeData.model?.trim() && { bikeModel: bikeData.model.trim() }),
        ...(bikeData.type && { bikeType: bikeData.type }),
        bikeYear: bikeData.year,
        bikeMileage: bikeData.currentMileage,
        bikeMileageUnit: bikeData.mileageUnit,
      }),
    };

    expect(input.bikeMake).toBe('Ducati');
    expect(input.bikeModel).toBe('Panigale V4');
    expect(input.bikeType).toBe('sportbike');
    expect(input.bikeYear).toBe(2024);
    expect(input.bikeMileage).toBe(100);
    expect(input.bikeMileageUnit).toBe('km');
  });

  it('should omit bike fields when bikeData is null (skipped)', () => {
    const store = useOnboardingStore.getState();
    store.setExperienceLevel('beginner');
    store.setRidingGoals(['just_exploring']);
    store.setBikeData(null);

    const { bikeData } = useOnboardingStore.getState();

    const input = {
      experienceLevel: 'beginner',
      ridingGoals: ['just_exploring'],
      learningFormats: [] as string[],
      ...(bikeData && {
        bikeMake: bikeData.make,
        bikeModel: bikeData.model,
        bikeType: bikeData.type,
        bikeYear: bikeData.year,
      }),
    };

    expect(input).not.toHaveProperty('bikeMake');
    expect(input).not.toHaveProperty('bikeModel');
    expect(input).not.toHaveProperty('bikeType');
    expect(input).not.toHaveProperty('bikeYear');
  });
});
