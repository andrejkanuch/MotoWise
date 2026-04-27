// @deprecated — Use trip.ts with isTemplate filter instead. Kept for backward compat during migration.

import { z } from 'zod';
import {
  type ConditionTag,
  ConditionTagSchema,
  type CreateTripReviewInput,
  CreateTripReviewInputSchema,
  type ModerateTripTemplateInput,
  ModerateTripTemplateInputSchema,
  type PublishAsTemplateInput,
  PublishAsTemplateInputSchema,
  SurfaceTypeInputSchema,
  TripDifficultySchema,
  type TripTemplateFilters,
  TripTemplateFiltersSchema,
  type TripTemplateWaypoint,
  TripTemplateWaypointSchema,
  WaypointTypeSchema,
} from './trip';

// --- Helpers ---

/** Strip HTML tags from user-provided text (XSS prevention for JSONB content rendered on web) */
const stripHtml = (v: string) => v.replace(/<[^>]*>/g, '');

// --- Discover Trip Status ---
// @deprecated — templates use isFlagged boolean + publishedAt instead

export const DiscoverTripStatusSchema = z.enum(['published', 'hidden', 'flagged', 'unpublished']);
export type DiscoverTripStatus = z.infer<typeof DiscoverTripStatusSchema>;

// --- Discover Trip Waypoint (JSONB contract) ---
// @deprecated — Use TripTemplateWaypointSchema from trip.ts

export const DiscoverTripWaypointSchema = z.object({
  sortOrder: z.number().int(),
  dayIndex: z.number().int().min(0),
  type: WaypointTypeSchema,
  name: z.string().min(1).max(200).transform(stripHtml),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().max(1000).transform(stripHtml).nullable().optional(),
});
export type DiscoverTripWaypoint = z.infer<typeof DiscoverTripWaypointSchema>;

// --- Publish Trip to Discover ---
// @deprecated — Use PublishAsTemplateInputSchema from trip.ts

export const PublishTripToDiscoverInputSchema = z.object({
  tripId: z.string().uuid(),
});
export type PublishTripToDiscoverInput = z.infer<typeof PublishTripToDiscoverInputSchema>;

// --- Discover Trips Filter ---
// @deprecated — Use TripTemplateFiltersSchema from trip.ts

export const DiscoverTripsFilterSchema = z.object({
  country: z.string().min(2).max(2).optional(),
  difficulty: TripDifficultySchema.optional(),
  dayCountMin: z.number().int().min(1).optional(),
  dayCountMax: z.number().int().min(1).optional(),
  surfaceType: SurfaceTypeInputSchema.optional(),
  searchText: z.string().max(200).trim().optional(),
});
export type DiscoverTripsFilter = z.infer<typeof DiscoverTripsFilterSchema>;

// --- Create Discover Trip Review ---
// @deprecated — Use CreateTripReviewInputSchema from trip.ts

export const CreateDiscoverTripReviewInputSchema = z.object({
  discoverTripId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(500).transform(stripHtml).optional(),
  conditionTags: z.array(z.string().max(50)).max(10).optional(),
  bikeId: z.string().uuid().optional(),
});
export type CreateDiscoverTripReviewInput = z.infer<typeof CreateDiscoverTripReviewInputSchema>;

// --- Moderate Discover Trip (Admin) ---
// @deprecated — Use ModerateTripTemplateInputSchema from trip.ts

export const ModerateDiscoverTripInputSchema = z.object({
  discoverTripId: z.string().uuid(),
  status: z.enum(['published', 'hidden', 'flagged']),
});
export type ModerateDiscoverTripInput = z.infer<typeof ModerateDiscoverTripInputSchema>;

// --- Re-exports for migration convenience ---
// Consumers can import the new unified types from here during the transition.

export {
  // Schemas
  TripTemplateWaypointSchema,
  PublishAsTemplateInputSchema,
  CreateTripReviewInputSchema,
  TripTemplateFiltersSchema,
  ModerateTripTemplateInputSchema,
  ConditionTagSchema,
  // Types
  type TripTemplateWaypoint,
  type PublishAsTemplateInput,
  type CreateTripReviewInput,
  type TripTemplateFilters,
  type ModerateTripTemplateInput,
  type ConditionTag,
};
