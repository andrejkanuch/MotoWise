import { z } from 'zod';

/** Input for `TouristAttraction` JSON-LD on public route pages. */
export const RouteForJsonLdSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  editorialDescription: z.string().nullable(),
  distanceM: z.number(),
  elevationGainM: z.number().nullable(),
  surfaceType: z.string().nullable(),
  ratingAvg: z.number().nullable(),
  ratingCount: z.number(),
  startLat: z.number(),
  startLng: z.number(),
  countryCode: z.string(),
  regionSlug: z.string(),
  slug: z.string(),
  countryName: z.string(),
  regionName: z.string(),
});
export type RouteForJsonLd = z.infer<typeof RouteForJsonLdSchema>;

/** Input for region `Place` JSON-LD on explore pages. */
export const RegionForJsonLdSchema = z.object({
  name: z.string(),
  countryCode: z.string(),
  regionSlug: z.string(),
  countryName: z.string(),
  description: z.string().optional(),
});
export type RegionForJsonLd = z.infer<typeof RegionForJsonLdSchema>;

/** One entry for `BreadcrumbList` JSON-LD (`name` + absolute `url`). */
export const JsonLdBreadcrumbItemSchema = z.object({
  name: z.string(),
  url: z.string(),
});
export type JsonLdBreadcrumbItem = z.infer<typeof JsonLdBreadcrumbItemSchema>;
