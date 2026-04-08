import { z } from 'zod';

// --- Condition Tags ---

export const CONDITION_TAGS = {
  GOOD_SURFACE: 'Good Surface',
  GRAVEL_HAZARD: 'Gravel Hazard',
  CONSTRUCTION: 'Construction',
  LOW_TRAFFIC: 'Low Traffic',
  HEAVY_TRAFFIC: 'Heavy Traffic',
  SCENIC: 'Scenic',
  TECHNICAL_CURVES: 'Technical Curves',
} as const;

export const ConditionTagSchema = z.enum([
  'Good Surface',
  'Gravel Hazard',
  'Construction',
  'Low Traffic',
  'Heavy Traffic',
  'Scenic',
  'Technical Curves',
]);

export type ConditionTag = z.infer<typeof ConditionTagSchema>;

// --- Create Route Review ---

export const CreateRouteReviewInputSchema = z.object({
  routeId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(500).optional(),
  conditionTags: z.array(ConditionTagSchema).optional(),
  bikeId: z.string().uuid().optional(),
});

export type CreateRouteReviewInput = z.infer<typeof CreateRouteReviewInputSchema>;

// --- Save Route ---

export const SaveRouteInputSchema = z.object({
  routeId: z.string().uuid(),
});

export type SaveRouteInput = z.infer<typeof SaveRouteInputSchema>;

// --- Join Premium Waitlist ---

export const JoinPremiumWaitlistInputSchema = z.object({
  feature: z.enum(['offline_routes', 'premium_general']),
});

export type JoinPremiumWaitlistInput = z.infer<typeof JoinPremiumWaitlistInputSchema>;
