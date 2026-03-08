import { z } from 'zod';
import {
  ExperienceLevel,
  LearningFormat,
  MaintenanceStyle,
  RidingFrequency,
  RidingGoal,
} from '../constants/enums';

const experienceLevelValues = Object.values(ExperienceLevel) as [string, ...string[]];
const ridingGoalValues = Object.values(RidingGoal) as [string, ...string[]];
const ridingFrequencyValues = Object.values(RidingFrequency) as [string, ...string[]];
const maintenanceStyleValues = Object.values(MaintenanceStyle) as [string, ...string[]];
const learningFormatValues = Object.values(LearningFormat) as [string, ...string[]];

export const UserPreferencesSchema = z
  .object({
    onboardingCompleted: z.boolean().optional(),
    experienceLevel: z.enum(experienceLevelValues).optional(),
    ridingGoals: z.array(z.enum(ridingGoalValues)).max(10).optional(),
    ridingFrequency: z.enum(ridingFrequencyValues).optional(),
    maintenanceStyle: z.enum(maintenanceStyleValues).optional(),
    learningFormats: z.array(z.enum(learningFormatValues)).max(4).optional(),
  })
  .passthrough();

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
