import { z } from 'zod';
import { ExperienceLevel } from '../constants/enums';

const experienceLevelValues = Object.values(ExperienceLevel) as [string, ...string[]];

export const UserPreferencesSchema = z
  .object({
    onboardingCompleted: z.boolean().optional(),
    experienceLevel: z.enum(experienceLevelValues).optional(),
    ridingGoals: z.array(z.string().max(50)).max(10).optional(),
  })
  .strict();

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
