import { z } from 'zod';

// --- Difficulty Levels ---

export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MODERATE: 'moderate',
  HARD: 'hard',
  EXPERT: 'expert',
} as const;

// --- Route Filters ---
// Note: SURFACE_TYPES is exported from ./route.ts

export const RouteFiltersSchema = z
  .object({
    minKm: z.number().min(0).optional(),
    maxKm: z.number().max(1000).optional(),
    minElevationM: z.number().min(0).optional(),
    maxElevationM: z.number().max(5000).optional(),
    difficulty: z.array(z.enum(['easy', 'moderate', 'hard', 'expert'])).optional(),
    surface: z.array(z.enum(['paved', 'mixed', 'off-road'])).optional(),
    countryCode: z.string().optional(),
    regionCode: z.string().optional(),
  })
  .refine((d) => !d.minKm || !d.maxKm || d.minKm <= d.maxKm, {
    message: 'minKm must be <= maxKm',
  });

export type RouteFilters = z.infer<typeof RouteFiltersSchema>;
