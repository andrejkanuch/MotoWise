import { z } from 'zod';
import { BlogGuideDifficulty, BlogPostType } from '../constants/enums';

/**
 * Per-type `typeData` schemas (plan KTD3). Each mirrors the columns of its
 * per-type table (blog_post_guide/maintenance/trip/gear), minus `post_id`. The
 * GraphQL layer surfaces these as an untyped `typeData: JSON`; this discriminated
 * union is the single typed boundary consumers parse through (`parseBlogTypeData`).
 *
 * Adding a content type = add its `as const` to BlogPostType, its per-type table
 * in a migration, and a variant here. Nothing else in the read/search path changes.
 */

const difficulties = Object.values(BlogGuideDifficulty) as [string, ...string[]];

/** Free-form per-type overflow column (`meta jsonb`). */
const metaSchema = z.record(z.string(), z.unknown()).default({});

export const GuideTypeDataSchema = z.object({
  type: z.literal(BlogPostType.GUIDE),
  difficulty: z.enum(difficulties).nullish(),
  meta: metaSchema,
});
export type GuideTypeData = z.infer<typeof GuideTypeDataSchema>;

export const MaintenanceTypeDataSchema = z.object({
  type: z.literal(BlogPostType.MAINTENANCE),
  make: z.string().nullish(),
  model: z.string().nullish(),
  variant: z.string().nullish(),
  datasetModels: z.array(z.string()).default([]),
  applicableModels: z.array(z.string()).default([]),
  meta: metaSchema,
});
export type MaintenanceTypeData = z.infer<typeof MaintenanceTypeDataSchema>;

export const TripTypeDataSchema = z.object({
  type: z.literal(BlogPostType.TRIP),
  distanceKm: z.number().nonnegative().nullish(),
  countryCodes: z.array(z.string()).default([]),
  routeGpx: z.string().nullish(),
  meta: metaSchema,
});
export type TripTypeData = z.infer<typeof TripTypeDataSchema>;

export const GearTypeDataSchema = z.object({
  type: z.literal(BlogPostType.GEAR),
  brand: z.string().nullish(),
  model: z.string().nullish(),
  rating: z.number().min(0).max(5).nullish(),
  priceEur: z.number().nonnegative().nullish(),
  verdict: z.string().nullish(),
  meta: metaSchema,
});
export type GearTypeData = z.infer<typeof GearTypeDataSchema>;

/** Discriminated union over `type` — one parse entry point for all content types. */
export const BlogTypeDataSchema = z.discriminatedUnion('type', [
  GuideTypeDataSchema,
  MaintenanceTypeDataSchema,
  TripTypeDataSchema,
  GearTypeDataSchema,
]);
export type BlogTypeData = z.infer<typeof BlogTypeDataSchema>;

/**
 * Parse an untyped `typeData` JSON payload (as it arrives from GraphQL) into the
 * typed discriminated union. Throws on shape/`type` mismatch — call this at every
 * consumer boundary instead of reading `typeData.*` raw (plan U4 guardrail).
 */
export function parseBlogTypeData(input: unknown): BlogTypeData {
  return BlogTypeDataSchema.parse(input);
}
