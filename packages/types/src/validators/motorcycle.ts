import { z } from 'zod';
import { MAX_MOTORCYCLE_YEAR, MIN_MOTORCYCLE_YEAR } from '../constants/limits';

export const CreateMotorcycleSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(MIN_MOTORCYCLE_YEAR).max(MAX_MOTORCYCLE_YEAR),
  nickname: z.string().max(50).optional(),
});
export type CreateMotorcycle = z.infer<typeof CreateMotorcycleSchema>;
