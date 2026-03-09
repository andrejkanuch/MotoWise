import { z } from 'zod';
import {
  ExperienceLevel,
  LearningFormat,
  MaintenanceStyle,
  MotorcycleType,
  RidingFrequency,
  RidingGoal,
} from '../constants/enums';

const experienceLevelValues = Object.values(ExperienceLevel) as [string, ...string[]];
const ridingGoalValues = Object.values(RidingGoal) as [string, ...string[]];
const ridingFrequencyValues = Object.values(RidingFrequency) as [string, ...string[]];
const maintenanceStyleValues = Object.values(MaintenanceStyle) as [string, ...string[]];
const learningFormatValues = Object.values(LearningFormat) as [string, ...string[]];
const motorcycleTypeValues = Object.values(MotorcycleType) as [string, ...string[]];

export const CompleteOnboardingInputSchema = z.object({
  experienceLevel: z.enum(experienceLevelValues),
  ridingGoals: z.array(z.enum(ridingGoalValues)).min(0),
  ridingFrequency: z.enum(ridingFrequencyValues).optional(),
  maintenanceStyle: z.enum(maintenanceStyleValues).optional(),
  learningFormats: z.array(z.enum(learningFormatValues)).max(4),
  bike: z
    .object({
      year: z.number().int().min(1900).max(2030),
      make: z.string().min(1).max(100),
      makeId: z.number().int().positive(),
      model: z.string().min(1).max(100),
      nickname: z.string().max(50).optional(),
      type: z.enum(motorcycleTypeValues),
      currentMileage: z.number().int().min(0).max(999999),
    })
    .optional(),
});

export type CompleteOnboardingInput = z.infer<typeof CompleteOnboardingInputSchema>;
