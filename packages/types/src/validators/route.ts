import { z } from 'zod';

// --- Surface Type ---
// Canonical definition is now in trip.ts. Re-export for backward compat.
export { SURFACE_TYPES, type SurfaceType, SurfaceTypeSchema, SurfaceTypeInputSchema } from './trip';

// Re-import for local use in this file
import { SurfaceTypeInputSchema } from './trip';

// --- Share Ride to Discover ---

export const ShareRideToDiscoverInputSchema = z.object({
  rideId: z.string().uuid(),
  name: z.string().max(200).optional(),
  surfaceType: SurfaceTypeInputSchema.optional(),
});

export type ShareRideToDiscoverInput = z.infer<typeof ShareRideToDiscoverInputSchema>;

// --- Discover Routes Filter ---

export const LengthRangeSchema = z.enum(['under50', '50to100', '100to200', '200to500', 'over500']);

export const ElevationRangeSchema = z.enum(['flat', 'moderate', 'mountainous']);

export const DiscoverRoutesFilterSchema = z.object({
  bounds: z
    .object({
      ne: z.object({ lat: z.number(), lng: z.number() }),
      sw: z.object({ lat: z.number(), lng: z.number() }),
    })
    .optional(),
  nearLat: z.number().optional(),
  nearLng: z.number().optional(),
  radiusKm: z.number().min(10).max(500).optional(),
  lengthRanges: z.array(LengthRangeSchema).optional(),
  surfaceTypes: z.array(
    z.enum(['paved', 'mixed', 'off-road', 'off_road']).transform((v) => (v === 'off_road' ? 'off-road' : v)),
  ).optional(),
  elevationRanges: z.array(ElevationRangeSchema).optional(),
  highlyRatedOnly: z.boolean().optional(),
  bikeCategory: z.string().optional(),
  minTwistScore: z.number().int().min(1).max(10).optional(),
  surfaceRecency: z.number().int().min(1).optional(),
});

export type DiscoverRoutesFilter = z.infer<typeof DiscoverRoutesFilterSchema>;

// --- Route Slug Params (URL validation) ---

export const RouteSlugParamsSchema = z.object({
  country: z.string().min(2).max(2), // ISO 3166-1 alpha-2
  region: z.string().min(1).max(10), // ISO 3166-2 subdivision
  slug: z.string().min(1).max(200),
});
export type RouteSlugParams = z.infer<typeof RouteSlugParamsSchema>;
