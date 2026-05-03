import { describe, expect, it } from 'vitest';
import { MotorcycleMakeSchema } from '../motorcycle';
import { CompleteOnboardingInputSchema } from '../onboarding-input';

const validBase = {
  experienceLevel: 'intermediate',
  ridingGoals: [],
  learningFormats: [],
};

describe('CompleteOnboardingInputSchema', () => {
  it('accepts valid minimal input', () => {
    const result = CompleteOnboardingInputSchema.parse(validBase);
    expect(result.experienceLevel).toBe('intermediate');
  });

  it('accepts valid input with bike data', () => {
    const result = CompleteOnboardingInputSchema.parse({
      ...validBase,
      bikeMake: 'Honda',
      bikeModel: 'CBR600RR',
      bikeYear: 2023,
      bikeType: 'sportbike',
    });
    expect(result.bikeMake).toBe('Honda');
  });

  it('accepts input without bikeMake (optional)', () => {
    const result = CompleteOnboardingInputSchema.parse(validBase);
    expect(result.bikeMake).toBeUndefined();
  });

  it('accepts input without bikeModel (optional)', () => {
    const result = CompleteOnboardingInputSchema.parse({
      ...validBase,
      bikeMake: 'Honda',
    });
    expect(result.bikeModel).toBeUndefined();
  });

  it('rejects bikeMake containing @ (email-like input)', () => {
    expect(() =>
      CompleteOnboardingInputSchema.parse({
        ...validBase,
        bikeMake: 'review@motovault.app',
      }),
    ).toThrow();
  });

  it('rejects empty bikeModel string', () => {
    expect(() =>
      CompleteOnboardingInputSchema.parse({
        ...validBase,
        bikeMake: 'Honda',
        bikeModel: '',
      }),
    ).toThrow();
  });

  it('accepts empty ridingGoals array', () => {
    const result = CompleteOnboardingInputSchema.parse(validBase);
    expect(result.ridingGoals).toEqual([]);
  });

  it('accepts empty learningFormats array', () => {
    const result = CompleteOnboardingInputSchema.parse(validBase);
    expect(result.learningFormats).toEqual([]);
  });
});

describe('MotorcycleMakeSchema', () => {
  it('accepts normal make names', () => {
    expect(MotorcycleMakeSchema.parse('Honda')).toBe('Honda');
    expect(MotorcycleMakeSchema.parse('Harley-Davidson')).toBe('Harley-Davidson');
    expect(MotorcycleMakeSchema.parse('BMW')).toBe('BMW');
  });

  it('rejects email addresses', () => {
    expect(() => MotorcycleMakeSchema.parse('user@example.com')).toThrow('Make cannot contain @');
  });

  it('rejects URLs', () => {
    expect(() => MotorcycleMakeSchema.parse('https://honda.com')).toThrow('Make cannot be a URL');
  });

  it('rejects pure numbers', () => {
    expect(() => MotorcycleMakeSchema.parse('12345')).toThrow('Make cannot be only numbers');
  });

  it('accepts alphanumeric makes (not pure numbers)', () => {
    expect(MotorcycleMakeSchema.parse('KTM 1290')).toBe('KTM 1290');
  });

  it('rejects empty string', () => {
    expect(() => MotorcycleMakeSchema.parse('')).toThrow();
  });
});
