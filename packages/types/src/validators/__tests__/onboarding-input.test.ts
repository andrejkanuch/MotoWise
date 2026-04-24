import { describe, expect, it } from 'vitest';
import { CompleteOnboardingInputSchema } from '../onboarding-input';

describe('CompleteOnboardingInputSchema', () => {
  const validInput = {
    riderType: 'daily_rider',
    goals: ['maintenance', 'expenses'],
  };

  it('accepts valid minimal input', () => {
    const result = CompleteOnboardingInputSchema.parse(validInput);
    expect(result.riderType).toBe('daily_rider');
    expect(result.goals).toEqual(['maintenance', 'expenses']);
  });

  it('accepts all rider types', () => {
    for (const type of ['daily_rider', 'tourer', 'wrench', 'collector']) {
      const result = CompleteOnboardingInputSchema.parse({ ...validInput, riderType: type });
      expect(result.riderType).toBe(type);
    }
  });

  it('rejects invalid rider type', () => {
    expect(() =>
      CompleteOnboardingInputSchema.parse({ ...validInput, riderType: 'invalid' }),
    ).toThrow();
  });

  it('accepts all goal values', () => {
    const allGoals = ['maintenance', 'expenses', 'rides', 'trips', 'history', 'recalls'];
    const result = CompleteOnboardingInputSchema.parse({ ...validInput, goals: allGoals });
    expect(result.goals).toEqual(allGoals);
  });

  it('accepts empty goals array', () => {
    const result = CompleteOnboardingInputSchema.parse({ ...validInput, goals: [] });
    expect(result.goals).toEqual([]);
  });

  it('rejects invalid goal value', () => {
    expect(() =>
      CompleteOnboardingInputSchema.parse({ ...validInput, goals: ['invalid_goal'] }),
    ).toThrow();
  });

  it('accepts optional measurementSystem', () => {
    const result = CompleteOnboardingInputSchema.parse({
      ...validInput,
      measurementSystem: 'metric',
    });
    expect(result.measurementSystem).toBe('metric');
  });

  it('accepts imperial measurement system', () => {
    const result = CompleteOnboardingInputSchema.parse({
      ...validInput,
      measurementSystem: 'imperial',
    });
    expect(result.measurementSystem).toBe('imperial');
  });

  it('rejects invalid measurement system', () => {
    expect(() =>
      CompleteOnboardingInputSchema.parse({ ...validInput, measurementSystem: 'invalid' }),
    ).toThrow();
  });

  it('accepts optional notification booleans with defaults', () => {
    const result = CompleteOnboardingInputSchema.parse(validInput);
    expect(result.maintenanceReminders).toBe(true);
    expect(result.seasonalTips).toBe(false);
    expect(result.recallAlerts).toBe(false);
  });

  it('accepts explicit notification booleans', () => {
    const result = CompleteOnboardingInputSchema.parse({
      ...validInput,
      maintenanceReminders: false,
      seasonalTips: true,
      recallAlerts: true,
    });
    expect(result.maintenanceReminders).toBe(false);
    expect(result.seasonalTips).toBe(true);
    expect(result.recallAlerts).toBe(true);
  });

  it('accepts optional bike fields', () => {
    const result = CompleteOnboardingInputSchema.parse({
      ...validInput,
      bikeMake: 'BMW',
      bikeModel: 'R 1250 GS',
      bikeYear: 2023,
    });
    expect(result.bikeMake).toBe('BMW');
    expect(result.bikeModel).toBe('R 1250 GS');
    expect(result.bikeYear).toBe(2023);
  });

  it('rejects bike year below 1900', () => {
    expect(() => CompleteOnboardingInputSchema.parse({ ...validInput, bikeYear: 1899 })).toThrow();
  });

  it('rejects bike year above 2030', () => {
    expect(() => CompleteOnboardingInputSchema.parse({ ...validInput, bikeYear: 2031 })).toThrow();
  });

  it('accepts optional currency', () => {
    const result = CompleteOnboardingInputSchema.parse({ ...validInput, currency: 'EUR' });
    expect(result.currency).toBe('EUR');
  });

  it('rejects invalid currency code', () => {
    expect(() =>
      CompleteOnboardingInputSchema.parse({ ...validInput, currency: 'INVALID' }),
    ).toThrow();
  });

  it('accepts optional bikeNickname', () => {
    const result = CompleteOnboardingInputSchema.parse({
      ...validInput,
      bikeNickname: 'Adventure',
    });
    expect(result.bikeNickname).toBe('Adventure');
  });

  it('rejects bikeNickname over 50 characters', () => {
    expect(() =>
      CompleteOnboardingInputSchema.parse({
        ...validInput,
        bikeNickname: 'A'.repeat(51),
      }),
    ).toThrow();
  });

  it('accepts valid bikePhotoUrl', () => {
    const result = CompleteOnboardingInputSchema.parse({
      ...validInput,
      bikePhotoUrl: 'https://storage.example.com/photos/bike.jpg',
    });
    expect(result.bikePhotoUrl).toBe('https://storage.example.com/photos/bike.jpg');
  });

  it('rejects invalid bikePhotoUrl', () => {
    expect(() =>
      CompleteOnboardingInputSchema.parse({ ...validInput, bikePhotoUrl: 'not-a-url' }),
    ).toThrow();
  });

  it('requires riderType', () => {
    expect(() => CompleteOnboardingInputSchema.parse({ goals: ['maintenance'] })).toThrow();
  });

  it('requires goals', () => {
    expect(() => CompleteOnboardingInputSchema.parse({ riderType: 'tourer' })).toThrow();
  });

  it('accepts full valid input', () => {
    const fullInput = {
      riderType: 'wrench',
      goals: ['maintenance', 'history', 'recalls'],
      measurementSystem: 'metric',
      maintenanceReminders: true,
      seasonalTips: true,
      recallAlerts: true,
      bikeMake: 'Ducati',
      bikeModel: 'Multistrada V4',
      bikeYear: 2024,
      bikeNickname: 'Red Devil',
      bikePhotoUrl: 'https://storage.example.com/photo.jpg',
      currency: 'EUR',
    };
    const result = CompleteOnboardingInputSchema.parse(fullInput);
    expect(result.riderType).toBe('wrench');
    expect(result.goals).toHaveLength(3);
    expect(result.bikeMake).toBe('Ducati');
    expect(result.currency).toBe('EUR');
  });
});
