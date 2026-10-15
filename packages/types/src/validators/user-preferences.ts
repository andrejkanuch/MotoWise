import { z } from 'zod';
import {
  ExperienceLevel,
  LearningFormat,
  MaintenanceStyle,
  RidingFrequency,
  RidingGoal,
} from '../constants/enums';
import { FeedbackContactSchema } from './feedback';
import { nullishToUndefined } from './nullish';

const experienceLevelValues = Object.values(ExperienceLevel) as [string, ...string[]];
const ridingGoalValues = Object.values(RidingGoal) as [string, ...string[]];
const ridingFrequencyValues = Object.values(RidingFrequency) as [string, ...string[]];
const maintenanceStyleValues = Object.values(MaintenanceStyle) as [string, ...string[]];
const learningFormatValues = Object.values(LearningFormat) as [string, ...string[]];

export const UserPreferencesSchema = z
  .object({
    onboardingCompleted: nullishToUndefined(z.boolean()),
    experienceLevel: nullishToUndefined(z.enum(experienceLevelValues)),
    ridingGoals: nullishToUndefined(z.array(z.enum(ridingGoalValues)).max(10)),
    ridingFrequency: nullishToUndefined(z.enum(ridingFrequencyValues)),
    maintenanceStyle: nullishToUndefined(z.enum(maintenanceStyleValues)),
    learningFormats: nullishToUndefined(z.array(z.enum(learningFormatValues)).max(4)),
    feedbackContact: nullishToUndefined(FeedbackContactSchema),
  })
  .passthrough();

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
