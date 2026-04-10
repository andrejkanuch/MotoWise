import { z } from 'zod';
import { Currency } from '../constants/enums';

const currencyValues = Object.values(Currency) as [string, ...string[]];

// MOT-137: Fuel fill-up log input.
// All quantities are stored normalised to metric units (km, litres).
// The client is responsible for converting from mi/gal before sending.
export const CreateFuelLogSchema = z.object({
  motorcycleId: z.string().uuid(),
  odometerKm: z.number().positive().max(9_999_999),
  fuelLitres: z.number().positive().max(1000),
  totalCost: z.number().min(0).max(99999.99).optional(),
  currency: z.enum(currencyValues).optional(),
  fuelType: z.enum(['regular', 'premium', 'diesel', 'e85']).optional(),
  isPartial: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  filledAt: z.string().datetime().optional(),
});
export type CreateFuelLog = z.infer<typeof CreateFuelLogSchema>;
