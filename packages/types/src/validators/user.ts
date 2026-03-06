import { z } from 'zod';

export const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  preferences: z.record(z.unknown()).optional(),
});
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
