import { z } from 'zod';
import { MAX_MOTORCYCLE_YEAR, MIN_MOTORCYCLE_YEAR } from '../constants/limits';

export const CreateMotorcycleSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(MIN_MOTORCYCLE_YEAR).max(MAX_MOTORCYCLE_YEAR),
  nickname: z.string().max(50).optional(),
});
export type CreateMotorcycle = z.infer<typeof CreateMotorcycleSchema>;

export const UpdateMotorcycleSchema = z.object({
  make: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  year: z.number().int().min(MIN_MOTORCYCLE_YEAR).max(MAX_MOTORCYCLE_YEAR).optional(),
  nickname: z.string().max(50).nullable().optional(),
  isPrimary: z.boolean().optional(),
  primaryPhotoUrl: z.string().url().max(500).nullable().optional(),
  currentMileage: z.number().int().min(0).optional(),
  mileageUnit: z.enum(['mi', 'km']).optional(),
});
export type UpdateMotorcycle = z.infer<typeof UpdateMotorcycleSchema>;
