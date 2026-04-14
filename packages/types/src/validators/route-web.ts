import { z } from 'zod';

/** `RouteContributor` as returned by web GraphQL route queries. */
export const RouteContributorSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  publicUsername: z.string().nullish(),
  avatarUrl: z.string().nullish(),
});
export type RouteContributor = z.infer<typeof RouteContributorSchema>;

/** `routeDetail` query payload (by id). */
export const RouteDetailPayloadSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  polyline: z.string(),
  distanceM: z.number(),
  elevationGainM: z.number().nullish(),
  surfaceType: z.string().nullish(),
  curvatureIndex: z.number().nullish(),
  isMotovaultPick: z.boolean(),
  editorialDescription: z.string().nullish(),
  ratingAvg: z.number().nullish(),
  ratingCount: z.number(),
  commentCount: z.number(),
  status: z.string(),
  createdAt: z.string(),
  contributor: RouteContributorSchema,
});
export type RouteDetailPayload = z.infer<typeof RouteDetailPayloadSchema>;

/** `routeBySlug` payload for the web app’s slug page query (includes polyline + timestamps). */
export const RouteBySlugPagePayloadSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  polyline: z.string().nullish(),
  distanceM: z.number(),
  elevationGainM: z.number().nullish(),
  surfaceType: z.string().nullish(),
  curvatureIndex: z.number().nullish(),
  isMotovaultPick: z.boolean(),
  editorialDescription: z.string().nullish(),
  ratingAvg: z.number().nullish(),
  ratingCount: z.number(),
  commentCount: z.number(),
  status: z.string().nullish(),
  createdAt: z.string(),
  contributor: RouteContributorSchema,
});
export type RouteBySlugPagePayload = z.infer<typeof RouteBySlugPagePayloadSchema>;

export const RouteReviewAuthorSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  publicUsername: z.string().nullish(),
  avatarUrl: z.string().nullish(),
});
export type RouteReviewAuthor = z.infer<typeof RouteReviewAuthorSchema>;

export const RouteReviewBikeSchema = z.object({
  make: z.string(),
  model: z.string(),
  year: z.number(),
});
export type RouteReviewBike = z.infer<typeof RouteReviewBikeSchema>;

export const RouteReviewSchema = z.object({
  id: z.string(),
  rating: z.number(),
  text: z.string().nullish(),
  conditionTags: z.array(z.string()),
  createdAt: z.string(),
  author: RouteReviewAuthorSchema,
  bike: RouteReviewBikeSchema.nullish(),
});
export type RouteReview = z.infer<typeof RouteReviewSchema>;

export const RouteReviewsDataSchema = z.object({
  reviews: z.array(RouteReviewSchema),
  hasNextPage: z.boolean(),
  endCursor: z.string().nullish(),
  totalCount: z.number(),
});
export type RouteReviewsData = z.infer<typeof RouteReviewsDataSchema>;
