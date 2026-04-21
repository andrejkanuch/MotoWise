import { z } from 'zod';
import { SurfaceTypeSchema } from './route';
import { TripDifficultySchema, WaypointTypeSchema } from './trip';

// --- Helpers ---

/** Strip HTML tags from user-provided text (XSS prevention for JSONB content rendered on web) */
const stripHtml = (v: string) => v.replace(/<[^>]*>/g, '');

// --- Discover Trip Status ---

export const DiscoverTripStatusSchema = z.enum(['published', 'hidden', 'flagged', 'unpublished']);
export type DiscoverTripStatus = z.infer<typeof DiscoverTripStatusSchema>;

// --- Discover Trip Waypoint (JSONB contract) ---
// Every service method reading JSONB waypoints must z.array(DiscoverTripWaypointSchema).parse()

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

export const PublishTripToDiscoverInputSchema = z.object({
  tripId: z.string().uuid(),
});
export type PublishTripToDiscoverInput = z.infer<typeof PublishTripToDiscoverInputSchema>;

// --- Discover Trips Filter ---

export const DiscoverTripsFilterSchema = z.object({
  country: z.string().min(2).max(2).optional(),
  difficulty: TripDifficultySchema.optional(),
  dayCountMin: z.number().int().min(1).optional(),
  dayCountMax: z.number().int().min(1).optional(),
  surfaceType: SurfaceTypeSchema.optional(),
  searchText: z.string().max(200).trim().optional(),
});
export type DiscoverTripsFilter = z.infer<typeof DiscoverTripsFilterSchema>;

// --- Create Discover Trip Review ---

export const CreateDiscoverTripReviewInputSchema = z.object({
  discoverTripId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(500).transform(stripHtml).optional(),
  conditionTags: z.array(z.string().max(50)).max(10).optional(),
  bikeId: z.string().uuid().optional(),
});
export type CreateDiscoverTripReviewInput = z.infer<typeof CreateDiscoverTripReviewInputSchema>;

// --- Moderate Discover Trip (Admin) ---

export const ModerateDiscoverTripInputSchema = z.object({
  discoverTripId: z.string().uuid(),
  status: z.enum(['published', 'hidden', 'flagged']),
});
export type ModerateDiscoverTripInput = z.infer<typeof ModerateDiscoverTripInputSchema>;
