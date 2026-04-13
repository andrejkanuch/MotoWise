import { z } from 'zod';

// --- Fuel Stop (from Overpass API) ---

export const FuelStopSchema = z.object({
  osmId: z.number(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  amenity: z.string(),
});
export type FuelStop = z.infer<typeof FuelStopSchema>;

// --- Fuel Range Summary ---

export const FuelRangeSummarySchema = z.object({
  effectiveRangeKm: z.number(),
  stopsRequired: z.number().int().min(0),
  summary: z.string(),
});
export type FuelRangeSummary = z.infer<typeof FuelRangeSummarySchema>;
