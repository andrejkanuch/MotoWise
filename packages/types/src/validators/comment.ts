import { z } from 'zod';

// --- Comment Target Type ---

export const COMMENT_TARGET = {
  RIDE: 'ride',
  ROUTE: 'route',
  GROUP_RIDE: 'group_ride',
} as const;

export const CommentTargetSchema = z.enum(['ride', 'route', 'group_ride']);
export type CommentTarget = z.infer<typeof CommentTargetSchema>;

// --- Create Comment ---

export const CreateCommentInputSchema = z
  .object({
    rideId: z.string().uuid().optional(),
    routeId: z.string().uuid().optional(),
    groupRideId: z.string().uuid().optional(),
    parentCommentId: z.string().uuid().optional(),
    text: z.string().min(1).max(500),
  })
  .refine((d) => [d.rideId, d.routeId, d.groupRideId].filter(Boolean).length === 1, {
    message: 'Exactly one target (rideId, routeId, or groupRideId) must be provided',
  });

export type CreateCommentInput = z.infer<typeof CreateCommentInputSchema>;

// --- Flag Comment ---

export const FlagCommentInputSchema = z.object({
  commentId: z.string().uuid(),
});

export type FlagCommentInput = z.infer<typeof FlagCommentInputSchema>;
