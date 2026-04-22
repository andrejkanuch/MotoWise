import { z } from 'zod';

// --- Condition Tags ---
// Canonical definition is now in trip.ts. Re-export for backward compat.
export { CONDITION_TAGS, type ConditionTag, ConditionTagSchema } from './trip';

// Re-import for local use in this file
import { ConditionTagSchema } from './trip';

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
