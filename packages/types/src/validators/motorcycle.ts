import { z } from 'zod';
import { MAX_MOTORCYCLE_YEAR, MIN_MOTORCYCLE_YEAR } from '../constants/limits';
import { nullishToUndefined } from './nullish';

/**
 * Shared refinement for motorcycle make/model strings.
 * Rejects values that are obviously not vehicle names (emails, URLs,
 * pure numbers) while still allowing custom/rare manufacturer names.
 */
export const MotorcycleMakeSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((v) => !v.includes('@'), 'Make cannot contain @')
  .refine((v) => !/^https?:\/\//i.test(v), 'Make cannot be a URL')
  .refine((v) => !/^\d+$/.test(v), 'Make cannot be only numbers');

export const CreateMotorcycleSchema = z.object({
  make: MotorcycleMakeSchema,
  model: z.string().min(1).max(100),
  year: z.number().int().min(MIN_MOTORCYCLE_YEAR).max(MAX_MOTORCYCLE_YEAR),
  nickname: z.string().max(50).optional(),
});
export type CreateMotorcycle = z.infer<typeof CreateMotorcycleSchema>;

// MOT-142: VIN format per ISO 3779 / SAE J853. 17 chars, excluding I, O, Q to avoid
// confusion with 1, 0, and 0. Matches the CHECK constraint in the migration.
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

export const UpdateMotorcycleSchema = z.object({
  make: nullishToUndefined(MotorcycleMakeSchema),
  model: nullishToUndefined(z.string().min(1).max(100)),
  year: nullishToUndefined(z.number().int().min(MIN_MOTORCYCLE_YEAR).max(MAX_MOTORCYCLE_YEAR)),
  nickname: z.string().max(50).nullable().optional(),
  isPrimary: nullishToUndefined(z.boolean()),
  primaryPhotoUrl: z.string().url().max(500).nullable().optional(),
  currentMileage: nullishToUndefined(z.number().int().min(0)),
  /**
   * @deprecated The mileage unit is now derived from the user's global
   * `measurementSystem` preference, not stored per bike. Label-only — no value
   * conversion. Kept for backward compatibility with existing rows/clients.
   */
  mileageUnit: nullishToUndefined(z.enum(['mi', 'km'])),
  purchasePrice: z.number().min(0).max(999999.99).nullable().optional(),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .nullable()
    .optional(),
  vin: z
    .string()
    .regex(VIN_REGEX, 'VIN must be 17 uppercase characters (no I, O, or Q)')
    .nullable()
    .optional(),
});
export type UpdateMotorcycle = z.infer<typeof UpdateMotorcycleSchema>;
