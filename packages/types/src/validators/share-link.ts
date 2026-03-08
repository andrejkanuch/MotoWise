import { z } from 'zod';

export const CreateShareLinkSchema = z.object({
  motorcycleId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});
export type CreateShareLink = z.infer<typeof CreateShareLinkSchema>;
