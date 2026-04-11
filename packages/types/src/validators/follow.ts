import { z } from 'zod';

export const FollowRiderInputSchema = z.object({
  targetUserId: z.string().uuid(),
});
export type FollowRiderInput = z.infer<typeof FollowRiderInputSchema>;

export const UnfollowRiderInputSchema = z.object({
  targetUserId: z.string().uuid(),
});
export type UnfollowRiderInput = z.infer<typeof UnfollowRiderInputSchema>;
