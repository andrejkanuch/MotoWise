import { z } from 'zod';
import { Currency, MeasurementSystem } from '../constants/enums';
import { nullishToUndefined } from './nullish';
import { UserPreferencesSchema } from './user-preferences';

const currencyValues = Object.values(Currency) as [string, ...string[]];
const measurementValues = Object.values(MeasurementSystem) as [string, ...string[]];

export const UpdateUserSchema = z.object({
  fullName: nullishToUndefined(z.string().min(1).max(200)),
  preferences: nullishToUndefined(UserPreferencesSchema),
  currency: nullishToUndefined(z.enum(currencyValues)),
  measurementSystem: nullishToUndefined(z.enum(measurementValues)),
});
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
