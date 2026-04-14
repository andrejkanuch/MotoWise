import { z } from 'zod';

/** Row from `places` (partial selects used by web explore). */
export const BrowsePlaceDbRowSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  country_code: z.string(),
  region_code: z.string().nullable(),
  slug: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  route_count: z.number().nullable().optional(),
});
export type BrowsePlaceDbRow = z.infer<typeof BrowsePlaceDbRowSchema>;

/** CamelCase place shape for country/region listings (web explore). */
export const BrowsePlaceSchema = z.object({
  id: z.string(),
  kind: z.enum(['country', 'region', 'city']),
  name: z.string(),
  countryCode: z.string(),
  regionCode: z.string().nullable(),
  slug: z.string(),
  parentId: z.string().nullable(),
  routeCount: z.number(),
});
export type BrowsePlace = z.infer<typeof BrowsePlaceSchema>;

/** Row from `routes` for rating-sorted lists (region/country explore). */
export const RouteListDbRowSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  distance_m: z.number(),
  elevation_gain_m: z.number().nullable(),
  surface_type: z.string().nullable(),
  curvature_index: z.number().nullable(),
  rating_avg: z.number().nullable(),
  rating_count: z.number(),
  slug: z.string().nullable(),
  country_code: z.string().nullable(),
  region_code: z.string().nullable(),
});
export type RouteListDbRow = z.infer<typeof RouteListDbRowSchema>;

export const RouteListItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  displayName: z.string().nullable(),
  distanceM: z.number(),
  elevationGainM: z.number().nullable(),
  surfaceType: z.string().nullable(),
  curvatureIndex: z.number().nullable(),
  ratingAvg: z.number().nullable(),
  ratingCount: z.number(),
  slug: z.string().nullable(),
  countryCode: z.string().nullable(),
  regionSlug: z.string().nullable(),
});
export type RouteListItem = z.infer<typeof RouteListItemSchema>;

/** Row from `routes` for /explore staff picks + top routes. */
export const ExploreRouteDbRowSchema = RouteListDbRowSchema.extend({
  description: z.string().nullable(),
  is_motovault_pick: z.boolean(),
  editorial_description: z.string().nullable(),
});
export type ExploreRouteDbRow = z.infer<typeof ExploreRouteDbRowSchema>;
