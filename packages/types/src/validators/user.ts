import { z } from 'zod';
import { Currency, MeasurementSystem } from '../constants/enums';
import { UserPreferencesSchema } from './user-preferences';

const currencyValues = Object.values(Currency) as [string, ...string[]];
const measurementValues = Object.values(MeasurementSystem) as [string, ...string[]];

export const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  preferences: UserPreferencesSchema.optional(),
  currency: z.enum(currencyValues).optional(),
  measurementSystem: z.enum(measurementValues).optional(),
});
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
