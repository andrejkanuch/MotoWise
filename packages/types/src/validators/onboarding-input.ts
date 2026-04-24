import { z } from 'zod';
import { Currency, MeasurementSystem, OnboardingGoal, RiderType } from '../constants/enums';

const riderTypeValues = Object.values(RiderType) as [string, ...string[]];
const onboardingGoalValues = Object.values(OnboardingGoal) as [string, ...string[]];
const currencyValues = Object.values(Currency) as [string, ...string[]];
const measurementSystemValues = Object.values(MeasurementSystem) as [string, ...string[]];

export const CompleteOnboardingInputSchema = z.object({
  riderType: z.enum(riderTypeValues),
  goals: z.array(z.enum(onboardingGoalValues)).min(0),
  measurementSystem: z.enum(measurementSystemValues).optional(),
  maintenanceReminders: z.boolean().optional().default(true),
  seasonalTips: z.boolean().optional().default(false),
  recallAlerts: z.boolean().optional().default(false),
  bikeMake: z.string().min(1).max(100).optional(),
  bikeModel: z.string().min(1).max(100).optional(),
  bikeYear: z.number().int().min(1900).max(2030).optional(),
  bikeNickname: z.string().max(50).optional(),
  bikePhotoUrl: z.string().url().max(500).optional(),
  currency: z.enum(currencyValues).optional(),
});

export type CompleteOnboardingInput = z.infer<typeof CompleteOnboardingInputSchema>;
