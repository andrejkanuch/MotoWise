import { z } from 'zod';

// --- Comment Target Type ---

export const COMMENT_TARGET = {
  RIDE: 'ride',
  ROUTE: 'route',
  GROUP_RIDE: 'group_ride',
  TRIP: 'trip',
} as const;

export const CommentTargetSchema = z.enum(['ride', 'route', 'group_ride', 'trip']);
export type CommentTarget = z.infer<typeof CommentTargetSchema>;

// --- Create Comment ---

// Target/parent ids use `.nullish()` (not `.optional()`): these arrive from
// GraphQL `nullable: true` args, where unused targets are sent as explicit
// `null` — `.optional()` rejects null ("Expected string, received null").
export const CreateCommentInputSchema = z
  .object({
    rideId: z.string().uuid().nullish(),
    routeId: z.string().uuid().nullish(),
    groupRideId: z.string().uuid().nullish(),
    tripId: z.string().uuid().nullish(),
    parentCommentId: z.string().uuid().nullish(),
    text: z.string().min(1).max(500),
  })
  .refine((d) => [d.rideId, d.routeId, d.groupRideId, d.tripId].filter(Boolean).length === 1, {
    message: 'Exactly one target (rideId, routeId, groupRideId, or tripId) must be provided',
  });

export type CreateCommentInput = z.infer<typeof CreateCommentInputSchema>;

// --- Get Comments target (exactly one of the four target ids) ---

export const GetCommentsTargetSchema = z
  .object({
    rideId: z.string().uuid().nullish(),
    routeId: z.string().uuid().nullish(),
    groupRideId: z.string().uuid().nullish(),
    tripId: z.string().uuid().nullish(),
  })
  .refine((d) => [d.rideId, d.routeId, d.groupRideId, d.tripId].filter(Boolean).length === 1, {
    message: 'Exactly one target (rideId, routeId, groupRideId, or tripId) must be provided',
  });

export type GetCommentsTarget = z.infer<typeof GetCommentsTargetSchema>;

// --- Flag Comment ---

export const FlagCommentInputSchema = z.object({
  commentId: z.string().uuid(),
});

export type FlagCommentInput = z.infer<typeof FlagCommentInputSchema>;
